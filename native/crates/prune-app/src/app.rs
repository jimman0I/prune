//! The app: state, messages, update and view.
//!
//! Nothing here ticks while the window is still. Keyboard, wheel and window
//! events arrive through the root [`listener`] rather than a subscription,
//! later launches through a task started at boot, and the frame clock
//! (`window::frames`) is subscribed to only while a transition is moving.
//! At rest [`App::subscription`] is empty, which is what lets an idle
//! Prune sit at 0% CPU.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use iced::keyboard::{self, Key, Modifiers, key::Named};
use iced::widget::{container, row, space, stack};
use iced::{Background, Element, Event, Length, Size, Subscription, Task, mouse, window};
use serde_json::Value;

use prune_core::i18n::Catalog;
use prune_core::settings::{self, Settings, ThemeChoice};

use crate::listener::listener;
use crate::motion::{STANDARD, Tween};
use crate::rail::{self, COLLAPSED_WIDTH, EXPANDED_WIDTH, Rail};
use crate::screen::{self, Screen};
use crate::shortcut::{KeyPress, Shortcut, match_shortcut};
use crate::theme::{self, Palette};
use crate::tray::{self, CloseAction, Tray, TrayCommand};
use crate::window_state::{self, Rect, WindowState};
use crate::zoom::{self, ZoomAction};

/// 3.x's rail timing (NavRail.jsx): width 320 ms, closing after 100 ms;
/// labels fade over 200 ms, starting 100 ms into an open; the mark slides
/// over 300 ms. All on cubic-bezier(0.4, 0, 0.2, 1), which is also
/// Tailwind's default for the labels' `transition-opacity`.
const WIDTH_MS: u64 = 320;
const CLOSE_DELAY_MS: u64 = 100;
const LABEL_MS: u64 = 200;
const LABEL_DELAY_MS: u64 = 100;
const MARK_MS: u64 = 300;

/// What the app starts from. `Default` is a fresh profile with no window
/// state, as the tests use.
#[derive(Debug, Clone, Default)]
pub struct Startup {
    pub settings: Settings,
    /// `window-state.json` as read, if it was.
    pub window_state: Option<Value>,
    /// Where to save window state; `None` never writes.
    pub window_state_path: Option<PathBuf>,
    /// Windows' "apps use light theme", if readable.
    pub os_light: Option<bool>,
    /// Windows' "show animations" is off.
    pub reduced_motion: bool,
    /// Set by `PRUNE_TRACE_STARTUP=1`: when the process started.
    pub trace_startup: Option<Instant>,
}

/// A key press, in the shape 3.x's shortcut code reads (`event.key`,
/// `event.code` and the modifier flags).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyInput {
    pub key: String,
    pub code: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub meta: bool,
}

impl KeyInput {
    /// Ctrl + `key` on the physical key `code` (for tests and docs).
    pub fn ctrl(key: &str, code: &str) -> Self {
        KeyInput { key: key.into(), code: code.into(), ctrl: true, alt: false, shift: false, meta: false }
    }

    /// A named key with no modifiers (`"Tab"`, `"Enter"`, `" "`).
    pub fn named(key: &str) -> Self {
        KeyInput { key: key.into(), code: String::new(), ctrl: false, alt: false, shift: false, meta: false }
    }

    fn from_event(event: &keyboard::Event) -> Option<Self> {
        let keyboard::Event::KeyPressed { modified_key, physical_key, modifiers, .. } = event else {
            return None;
        };
        let key = match modified_key {
            Key::Character(c) => c.to_string(),
            Key::Named(Named::Tab) => "Tab".into(),
            Key::Named(Named::Enter) => "Enter".into(),
            Key::Named(Named::Space) => " ".into(),
            _ => return None,
        };
        let code = match physical_key {
            keyboard::key::Physical::Code(code) => format!("{code:?}"),
            keyboard::key::Physical::Unidentified(_) => String::new(),
        };
        Some(KeyInput {
            key,
            code,
            ctrl: modifiers.control(),
            alt: modifiers.alt(),
            shift: modifiers.shift(),
            meta: modifiers.logo(),
        })
    }
}

/// One wheel event's vertical movement.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Wheel {
    /// Notches (a mouse wheel: 1.0 per click).
    Lines(f32),
    /// Pixels (touchpads, free-spinning wheels).
    Pixels(f32),
}

/// Pixels that count as one wheel notch (Windows' WHEEL_DELTA).
pub const PIXELS_PER_NOTCH: f32 = 120.0;

#[derive(Debug, Clone)]
pub enum Message {
    Navigate(Screen),
    /// The pointer entered (`true`) or left the rail.
    RailHover(bool),
    /// The pointer entered or left one row.
    ItemHover(Screen, bool),
    Zoom(ZoomAction),
    /// A frame, while something is moving.
    Tick(Instant),
    Key(KeyInput),
    Modifiers(Modifiers),
    /// A wheel turn; positive is away from the person. Zoom only with Ctrl.
    Wheel(Wheel),
    PointerPressed,
    WindowOpened(window::Id),
    /// The window is placed and painted; carries its HWND and whether to
    /// show it maximized.
    WindowPrepared(Option<isize>, bool),
    WindowChanged,
    WindowFocused,
    CloseRequested,
    SaveTimer,
    FirstFrame,
    FirstFramePresented,
    IconReady(window::Icon),
    /// A later launch's command line.
    SecondInstance(Vec<String>),
    /// The tray icon's click or menu.
    Tray(TrayCommand),
}

pub struct App {
    screen: Screen,
    catalog: Catalog,
    theme: ThemeChoice,
    dark: bool,
    reduced_motion: bool,
    rail_hover: bool,
    item_hover: Option<Screen>,
    focus: Option<Screen>,
    typing: bool,
    rail_width: Tween,
    label_opacity: Tween,
    mark_top: Tween,
    mark_share: Tween,
    zoom_level: f64,
    modifiers: Modifiers,
    window: Option<window::Id>,
    hwnd: Option<isize>,
    saved_window: Option<Value>,
    state_path: Option<PathBuf>,
    /// The last bounds read from the window, kept for a save when they
    /// cannot be read again.
    bounds: Option<Rect>,
    is_maximized: bool,
    save_pending: bool,
    last_change: Option<Instant>,
    trace_startup: Option<Instant>,
    /// The window has been placed and asked to show.
    shown: bool,
    /// A later launch asked to come forward before the window was shown
    /// (3.x's `revealRequested`).
    reveal_requested: bool,
    /// Ctrl+wheel travel not yet turned into a zoom step, in notches.
    wheel_travel: f32,
    first_frame_seen: bool,
    /// `minimizeToTray`: closing hides to the tray instead of quitting.
    minimize_to_tray: bool,
    /// The notification-area icon, once created (after the first frame).
    tray: Option<Tray>,
    /// Whether a tray icon exists; the tests set it without a real one.
    tray_present: bool,
    /// The window is hidden, waiting in the tray.
    hidden_to_tray: bool,
}

impl App {
    pub fn new(startup: Startup) -> Self {
        let Startup { settings, window_state, window_state_path, os_light, reduced_motion, trace_startup } = startup;
        let theme = settings::effective_theme(&settings);
        let minimize_to_tray = settings.minimize_to_tray;
        let screen = Screen::Dashboard;
        let (top, share) = rail::mark_anchor(screen);
        App {
            screen,
            catalog: Catalog::load(&settings.language),
            theme,
            dark: theme::is_dark(theme, os_light),
            reduced_motion,
            rail_hover: false,
            item_hover: None,
            focus: None,
            typing: false,
            rail_width: Tween::at(COLLAPSED_WIDTH),
            label_opacity: Tween::at(0.0),
            mark_top: Tween::at(top),
            mark_share: Tween::at(share),
            zoom_level: zoom::resolve_saved_zoom(window_state.as_ref()),
            modifiers: Modifiers::empty(),
            window: None,
            hwnd: None,
            saved_window: window_state,
            state_path: window_state_path,
            bounds: None,
            is_maximized: false,
            save_pending: false,
            last_change: None,
            trace_startup,
            shown: false,
            reveal_requested: false,
            wheel_travel: 0.0,
            first_frame_seen: false,
            minimize_to_tray,
            tray: None,
            tray_present: false,
            hidden_to_tray: false,
        }
    }

    /// The app plus the task that opens its window and listens for later
    /// launches.
    pub fn boot(
        startup: Startup,
        later_launches: iced::futures::channel::mpsc::UnboundedReceiver<Vec<String>>,
        tray_commands: iced::futures::channel::mpsc::UnboundedReceiver<TrayCommand>,
    ) -> (Self, Task<Message>) {
        let mut app = App::new(startup);
        app.trace("boot");
        let open = app.open_window();
        let launches = Task::run(later_launches, Message::SecondInstance);
        let tray = Task::run(tray_commands, Message::Tray);
        (app, Task::batch([open, launches, tray]))
    }

    /// Opens the main window hidden; it is shown once placed and painted
    /// (see `WindowPrepared`), so it never flashes at the wrong place or in
    /// the system's caption colour.
    fn open_window(&mut self) -> Task<Message> {
        let (id, open) = window::open(window::Settings {
            size: Size::new(window_state::DEFAULT_WIDTH as f32, window_state::DEFAULT_HEIGHT as f32),
            // Set once placed (`min_size_task`): a client-area minimum of
            // 900x560 now would push a saved 900x560 outer window larger.
            min_size: None,
            visible: false,
            exit_on_close_request: false,
            ..window::Settings::default()
        });
        self.window = Some(id);
        open.map(Message::WindowOpened)
    }

    pub fn screen(&self) -> Screen {
        self.screen
    }

    pub fn zoom_level(&self) -> f64 {
        self.zoom_level
    }

    /// The zoom as iced's scale factor; iced multiplies it with the
    /// display's own.
    pub fn scale_factor(&self) -> f32 {
        zoom::factor(self.zoom_level) as f32
    }

    /// Whether closing hides to the tray (the `minimizeToTray` setting).
    pub fn minimize_to_tray(&self) -> bool {
        self.minimize_to_tray
    }

    /// For the Settings screen when the setting changes.
    pub fn set_minimize_to_tray(&mut self, on: bool) {
        self.minimize_to_tray = on;
    }

    /// Whether the tray icon exists. Tests stand in for it with
    /// [`App::set_tray_present`].
    pub fn tray_present(&self) -> bool {
        self.tray_present
    }

    pub fn set_tray_present(&mut self, present: bool) {
        self.tray_present = present;
    }

    /// The window is hidden, waiting in the tray.
    pub fn hidden_to_tray(&self) -> bool {
        self.hidden_to_tray
    }

    /// A later launch asked to come forward before the window was shown.
    pub fn reveal_requested(&self) -> bool {
        self.reveal_requested
    }

    pub fn focused(&self) -> Option<Screen> {
        self.focus
    }

    /// Whether a text field has keyboard focus. Phase 1 has none; screens
    /// with fields set this as their fields gain and lose focus.
    pub fn set_typing(&mut self, typing: bool) {
        self.typing = typing;
    }

    /// Open on pointer hover or keyboard focus, as 3.x's `:hover` /
    /// `:has(:focus-visible)`.
    pub fn rail_open(&self) -> bool {
        self.rail_hover || self.focus.is_some()
    }

    pub fn rail_width(&self) -> f32 {
        self.rail_width.value()
    }

    pub fn palette(&self) -> &'static Palette {
        theme::palette(self.dark)
    }

    pub fn is_dark(&self) -> bool {
        self.dark
    }

    fn is_animating(&self) -> bool {
        [&self.rail_width, &self.label_opacity, &self.mark_top, &self.mark_share].iter().any(|t| t.is_moving())
    }

    /// The frame clock while something moves; nothing otherwise.
    pub fn subscription(&self) -> Subscription<Message> {
        if self.is_animating() { window::frames().map(Message::Tick) } else { Subscription::none() }
    }

    pub fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::Navigate(screen) => self.navigate(screen),
            Message::RailHover(hover) => {
                self.rail_hover = hover;
                self.sync_rail();
            }
            Message::ItemHover(screen, true) => self.item_hover = Some(screen),
            Message::ItemHover(screen, false) => {
                if self.item_hover == Some(screen) {
                    self.item_hover = None;
                }
            }
            Message::Zoom(action) => return self.zoom(action),
            Message::Tick(now) => {
                for t in [&mut self.rail_width, &mut self.label_opacity, &mut self.mark_top, &mut self.mark_share] {
                    t.tick(now);
                }
            }
            Message::Key(key) => return self.key(&key),
            Message::Modifiers(m) => {
                if !m.control() {
                    self.wheel_travel = 0.0;
                }
                self.modifiers = m;
            }
            Message::Wheel(wheel) => return self.wheel(wheel),
            Message::PointerPressed => {
                // A click is not keyboard focus (`:focus-visible`).
                if self.focus.take().is_some() {
                    self.sync_rail();
                }
            }
            Message::WindowOpened(id) => {
                self.trace("window-created");
                return self.prepare_window(id);
            }
            Message::WindowPrepared(hwnd, maximized) => {
                self.hwnd = hwnd;
                self.shown = true;
                self.trace("window-shown");
                let reveal = std::mem::take(&mut self.reveal_requested);
                let Some(id) = self.window else { return Task::none() };
                let mut show = window::set_mode(id, window::Mode::Windowed);
                if maximized {
                    show = show.chain(window::maximize(id, true));
                }
                if reveal {
                    show = show.chain(window::gain_focus(id));
                }
                return Task::batch([self.min_size_task(id), show]);
            }
            Message::WindowChanged => return self.window_changed(Instant::now()),
            Message::SaveTimer => return self.save_timer(Instant::now()),
            Message::WindowFocused => {
                // Both are Windows settings the person may have just changed.
                self.recheck_os_theme();
                self.reduced_motion = crate::motion::reduced_motion();
            }
            Message::CloseRequested => {
                self.save_window_state();
                if tray::close_action(self.minimize_to_tray, self.tray_present) == CloseAction::HideToTray {
                    self.hidden_to_tray = true;
                    return self.window.map_or_else(Task::none, |id| window::set_mode(id, window::Mode::Hidden));
                }
                return iced::exit();
            }
            Message::Tray(TrayCommand::Open) => return self.reveal(),
            Message::Tray(TrayCommand::Quit) => {
                self.save_window_state();
                return iced::exit();
            }
            Message::FirstFrame => {
                // A frame drawn while the window is still hidden is not one
                // anybody saw; the next one, after showing, is.
                if self.shown && !self.first_frame_seen {
                    self.first_frame_seen = true;
                    // The frame being drawn now is presented before the
                    // event loop next looks at the task queue.
                    let presented = Task::future(async {}).map(|()| Message::FirstFramePresented);
                    return Task::batch([presented, load_icon()]);
                }
            }
            Message::FirstFramePresented => {
                // Created now, not at boot, so it never delays the first frame.
                self.tray = Tray::create();
                self.tray_present = self.tray.is_some();
                if let Some(start) = self.trace_startup {
                    eprintln!("tray-created={}", self.tray_present);
                    eprintln!("first-frame-ms={:.1}", start.elapsed().as_secs_f64() * 1000.0);
                }
            }
            Message::IconReady(icon) => {
                if let Some(id) = self.window {
                    return window::set_icon(id, icon);
                }
            }
            Message::SecondInstance(args) => {
                if crate::single_instance::should_reveal(&args) {
                    eprintln!("focus-request");
                    if !self.shown {
                        // Placing and showing it will bring it forward.
                        self.reveal_requested = true;
                    } else {
                        return self.reveal();
                    }
                }
            }
        }
        Task::none()
    }

    /// 3.x's revealSteps: restore, show, focus. Also brings a window back
    /// from the tray.
    fn reveal(&mut self) -> Task<Message> {
        self.hidden_to_tray = false;
        let Some(id) = self.window.filter(|_| self.shown) else { return Task::none() };
        Task::batch([window::minimize(id, false), window::set_mode(id, window::Mode::Windowed), window::gain_focus(id)])
    }

    fn navigate(&mut self, screen: Screen) {
        if self.screen == screen {
            return;
        }
        self.screen = screen;
        let (top, share) = rail::mark_anchor(screen);
        let d = Duration::from_millis(MARK_MS);
        self.mark_top.set(top, d, Duration::ZERO, STANDARD, self.reduced_motion);
        self.mark_share.set(share, d, Duration::ZERO, STANDARD, self.reduced_motion);
    }

    /// Retargets the rail's width and labels after hover or focus changed.
    fn sync_rail(&mut self) {
        let rm = self.reduced_motion;
        let ms = Duration::from_millis;
        if self.rail_open() {
            self.rail_width.set(EXPANDED_WIDTH, ms(WIDTH_MS), Duration::ZERO, STANDARD, rm);
            self.label_opacity.set(1.0, ms(LABEL_MS), ms(LABEL_DELAY_MS), STANDARD, rm);
        } else {
            self.rail_width.set(COLLAPSED_WIDTH, ms(WIDTH_MS), ms(CLOSE_DELAY_MS), STANDARD, rm);
            self.label_opacity.set(0.0, ms(LABEL_MS), Duration::ZERO, STANDARD, rm);
        }
    }

    fn zoom(&mut self, action: ZoomAction) -> Task<Message> {
        let level = zoom::apply_zoom_action(self.zoom_level, Some(action));
        if level == self.zoom_level {
            return Task::none();
        }
        self.zoom_level = level;
        // 3.x saves the level with the bounds, debounced like a resize.
        let save = self.window_changed(Instant::now());
        // iced scales the minimum by the zoom; keep it 900x560 regardless.
        match self.window.filter(|_| self.shown) {
            Some(id) => Task::batch([save, self.min_size_task(id)]),
            None => save,
        }
    }

    /// Electron's `zoom-changed`: Ctrl+wheel with nothing else held, one
    /// step per notch. Movement is added up so a touchpad swipe or a
    /// free-spinning wheel steps once per notch's worth, not once per event.
    fn wheel(&mut self, wheel: Wheel) -> Task<Message> {
        let m = self.modifiers;
        if !m.control() || m.alt() || m.logo() {
            self.wheel_travel = 0.0;
            return Task::none();
        }
        let notches = match wheel {
            Wheel::Lines(y) => y,
            Wheel::Pixels(y) => y / PIXELS_PER_NOTCH,
        };
        if notches == 0.0 {
            return Task::none();
        }
        if self.wheel_travel != 0.0 && notches.signum() != self.wheel_travel.signum() {
            // Turning back starts a fresh notch.
            self.wheel_travel = 0.0;
        }
        self.wheel_travel += notches;
        let mut tasks = Vec::new();
        while self.wheel_travel.abs() >= 1.0 - 1e-4 {
            let action = if self.wheel_travel > 0.0 { ZoomAction::In } else { ZoomAction::Out };
            self.wheel_travel -= self.wheel_travel.signum();
            if self.wheel_travel.abs() < 1e-4 {
                self.wheel_travel = 0.0;
            }
            tasks.push(self.zoom(action));
        }
        Task::batch(tasks)
    }

    /// `PRUNE_TRACE_STARTUP=1`: how long since the process started.
    fn trace(&self, phase: &str) {
        if let Some(start) = self.trace_startup {
            eprintln!("trace {phase}-ms={:.1}", start.elapsed().as_secs_f64() * 1000.0);
        }
    }

    fn key(&mut self, k: &KeyInput) -> Task<Message> {
        // Zoom first: 3.x's shell takes these before the page sees them,
        // text field or not.
        if let Some(action) = zoom::zoom_action_for_input(&k.key, k.ctrl, k.alt, k.meta) {
            return self.zoom(action);
        }
        let press = KeyPress {
            key: &k.key,
            code: &k.code,
            ctrl: k.ctrl,
            meta: k.meta,
            shift: k.shift,
            alt: k.alt,
            typing: self.typing,
        };
        match match_shortcut(&press) {
            Some(Shortcut::Settings) => self.navigate(Screen::Settings),
            Some(Shortcut::Screen(n)) => self.navigate(Screen::ORDER[n - 1]),
            // The search box and the shortcut list arrive with their screens.
            Some(Shortcut::Search | Shortcut::Help) => {}
            None if !(k.ctrl || k.alt || k.meta) => self.focus_key(k),
            None => {}
        }
        Task::none()
    }

    /// Tab / Shift+Tab move keyboard focus through the rail (the only
    /// focusable things in Phase 1) and wrap; Enter or Space opens the
    /// focused screen.
    fn focus_key(&mut self, k: &KeyInput) {
        match k.key.as_str() {
            "Tab" => {
                let n = Screen::ORDER.len();
                let next = match (self.focus, k.shift) {
                    (None, false) => 0,
                    (None, true) => n - 1,
                    (Some(s), false) => (s.index() + 1) % n,
                    (Some(s), true) => (s.index() + n - 1) % n,
                };
                self.focus = Some(Screen::ORDER[next]);
                self.sync_rail();
            }
            "Enter" | " " => {
                if let Some(s) = self.focus {
                    self.navigate(s);
                }
            }
            _ => {}
        }
    }

    /// The window moved, resized or zoomed: save once things have been
    /// still for `SAVE_DEBOUNCE` (3.x's 500 ms debounce).
    fn window_changed(&mut self, now: Instant) -> Task<Message> {
        self.last_change = Some(now);
        if self.save_pending || self.state_path.is_none() {
            return Task::none();
        }
        self.save_pending = true;
        after(window_state::SAVE_DEBOUNCE, Message::SaveTimer)
    }

    fn save_timer(&mut self, now: Instant) -> Task<Message> {
        let quiet = self.last_change.map_or(window_state::SAVE_DEBOUNCE, |t| now.saturating_duration_since(t));
        if quiet < window_state::SAVE_DEBOUNCE {
            return after(window_state::SAVE_DEBOUNCE - quiet, Message::SaveTimer);
        }
        self.save_pending = false;
        self.save_window_state();
        Task::none()
    }

    /// Writes window-state.json now. Best effort, like 3.x: a failed save
    /// never blocks closing.
    fn save_window_state(&mut self) {
        self.read_bounds();
        let (Some(path), Some(bounds)) = (&self.state_path, self.bounds) else { return };
        let state = WindowState { bounds, is_maximized: self.is_maximized, zoom_level: self.zoom_level };
        let _ = window_state::save(path, &state);
    }

    #[cfg(windows)]
    fn read_bounds(&mut self) {
        if let Some((bounds, maximized)) = self.hwnd.and_then(|h| window_state::win32::read(hwnd(h))) {
            self.bounds = Some(bounds);
            self.is_maximized = maximized;
        }
    }

    #[cfg(not(windows))]
    fn read_bounds(&mut self) {}

    /// 3.x's minimum is the outer window (900×560 DIP); the window's own
    /// minimum is its client area, so the frame is taken off.
    fn min_size_task(&self, id: window::Id) -> Task<Message> {
        window::set_min_size(id, Some(min_client_size(self.min_outer(), self.frame_size(), self.zoom_level)))
    }

    /// 3.x's 900x560, or the work area of the window's monitor where that
    /// is smaller (see [`window_state::minimum_on`]).
    #[cfg(windows)]
    fn min_outer(&self) -> (f32, f32) {
        match self.hwnd.and_then(|h| window_state::win32::work_of(hwnd(h))) {
            Some(work) => {
                let (w, h) = window_state::minimum_on(&work);
                (w as f32, h as f32)
            }
            None => (window_state::MIN_WIDTH, window_state::MIN_HEIGHT),
        }
    }

    #[cfg(not(windows))]
    fn min_outer(&self) -> (f32, f32) {
        (window_state::MIN_WIDTH, window_state::MIN_HEIGHT)
    }

    #[cfg(windows)]
    fn frame_size(&self) -> (f32, f32) {
        self.hwnd.map_or((0.0, 0.0), |h| platform::frame_size(hwnd(h)))
    }

    #[cfg(not(windows))]
    fn frame_size(&self) -> (f32, f32) {
        (0.0, 0.0)
    }

    fn prepare_window(&mut self, id: window::Id) -> Task<Message> {
        let saved = self.saved_window.take();
        let dark = self.dark;
        window::run(id, move |w| platform::prepare(w, saved.as_ref(), dark))
            .map(|(hwnd, maximized)| Message::WindowPrepared(hwnd, maximized))
    }

    /// The theme follows Windows when set to System. Rechecked when the
    /// window gains focus (after the person changes it in Settings), which
    /// costs nothing while idle.
    fn recheck_os_theme(&mut self) {
        let dark = theme::is_dark(self.theme, theme::os_prefers_light());
        if dark != self.dark {
            self.dark = dark;
            #[cfg(windows)]
            if let Some(h) = self.hwnd {
                crate::titlebar::paint(hwnd(h), dark, self.palette());
            }
        }
    }

    pub fn view(&self) -> Element<'_, Message> {
        let p = self.palette();
        let page = row![space().width(COLLAPSED_WIDTH), screen::view(self.screen, &self.catalog, p)]
            .width(Length::Fill)
            .height(Length::Fill);
        let rail = rail::view(
            Rail {
                active: self.screen,
                focus: self.focus,
                hover: self.item_hover,
                width: self.rail_width.value(),
                label_opacity: self.label_opacity.value(),
                mark: (self.mark_top.value(), self.mark_share.value()),
                palette: p,
                catalog: &self.catalog,
            },
            rail::Events {
                navigate: Message::Navigate,
                rail_hover: Message::RailHover,
                item_hover: Message::ItemHover,
            },
            self.dark,
        );
        let root = container(stack![page, rail].width(Length::Fill).height(Length::Fill))
            .width(Length::Fill)
            .height(Length::Fill)
            .style(move |_| container::Style {
                background: Some(Background::Color(p.bg_base)),
                text_color: Some(p.text_primary),
                ..container::Style::default()
            });
        let first_frame_seen = self.first_frame_seen;
        listener(root, move |event, _captured| map_event(event, first_frame_seen)).into()
    }
}

/// The window's minimum client size in iced's units, so that the outer
/// window stays at least `min_outer` DIP (3.x's 900x560, less on a smaller
/// work area). iced multiplies a minimum by the display scale and the app's
/// scale factor (the zoom), so the zoom is divided out; `frame` (caption
/// and borders, in DIP) is not zoomed.
pub fn min_client_size(min_outer: (f32, f32), frame: (f32, f32), zoom_level: f64) -> Size {
    let f = zoom::factor(zoom_level) as f32;
    Size::new((min_outer.0 - frame.0).max(1.0) / f, (min_outer.1 - frame.1).max(1.0) / f)
}

/// The runtime events the app acts on.
fn map_event(event: &Event, first_frame_seen: bool) -> Option<Message> {
    match event {
        Event::Keyboard(keyboard::Event::ModifiersChanged(m)) => Some(Message::Modifiers(*m)),
        Event::Keyboard(k) => KeyInput::from_event(k).map(Message::Key),
        Event::Mouse(mouse::Event::WheelScrolled { delta }) => Some(Message::Wheel(match delta {
            mouse::ScrollDelta::Lines { y, .. } => Wheel::Lines(*y),
            mouse::ScrollDelta::Pixels { y, .. } => Wheel::Pixels(*y),
        })),
        Event::Mouse(mouse::Event::ButtonPressed(_)) => Some(Message::PointerPressed),
        Event::Window(window::Event::Moved(_) | window::Event::Resized(_)) => Some(Message::WindowChanged),
        Event::Window(window::Event::Focused) => Some(Message::WindowFocused),
        Event::Window(window::Event::CloseRequested) => Some(Message::CloseRequested),
        Event::Window(window::Event::RedrawRequested(_)) if !first_frame_seen => Some(Message::FirstFrame),
        _ => None,
    }
}

/// `message` after `delay`, without a timer subscription. The wait runs on
/// its own short-lived thread; the debounce schedules at most one at a time.
fn after(delay: Duration, message: Message) -> Task<Message> {
    Task::future(async move {
        let (tx, rx) = iced::futures::channel::oneshot::channel();
        std::thread::spawn(move || {
            std::thread::sleep(delay);
            let _ = tx.send(());
        });
        let _ = rx.await;
        message
    })
}

/// The window icon, decoded off the UI thread after the first frame so it
/// never delays it.
fn load_icon() -> Task<Message> {
    Task::future(async { decode_icon() }).and_then(|icon| Task::done(Message::IconReady(icon)))
}

fn decode_icon() -> Option<window::Icon> {
    static PNG: &[u8] = include_bytes!("../../../../electron/build/icon.png");
    let (rgba, width, height) = tray::decode_png_rgba(PNG)?;
    window::icon::from_rgba(rgba, width, height).ok()
}

#[cfg(windows)]
fn hwnd(h: isize) -> windows::Win32::Foundation::HWND {
    windows::Win32::Foundation::HWND(h as *mut core::ffi::c_void)
}

/// The window work that needs the real HWND, run on the UI thread.
mod platform {
    use serde_json::Value;

    /// Places the hidden window where window-state.json says (or the 3.x
    /// default, centred) and paints its caption. Gives back the HWND and
    /// whether to show it maximized.
    #[cfg(windows)]
    pub fn prepare(w: &dyn iced::window::Window, saved: Option<&Value>, dark: bool) -> (Option<isize>, bool) {
        use crate::window_state::{resolve_window_state, win32};
        use iced::window::raw_window_handle::RawWindowHandle;

        let Ok(handle) = w.window_handle() else { return (None, false) };
        let RawWindowHandle::Win32(h) = handle.as_raw() else { return (None, false) };
        let raw = h.hwnd.get();
        let hwnd = super::hwnd(raw);
        let displays = win32::displays();
        let areas: Vec<_> = displays.iter().map(win32::Display::work_dip).collect();
        let resolved = resolve_window_state(saved, &areas);
        win32::place(hwnd, &resolved, &displays);
        crate::titlebar::paint(hwnd, dark, crate::theme::palette(dark));
        (Some(raw), resolved.is_maximized)
    }

    #[cfg(not(windows))]
    pub fn prepare(_: &dyn iced::window::Window, _: Option<&Value>, _: bool) -> (Option<isize>, bool) {
        (None, false)
    }

    /// The frame around the client area (caption and borders), in DIP.
    #[cfg(windows)]
    pub fn frame_size(hwnd: windows::Win32::Foundation::HWND) -> (f32, f32) {
        use windows::Win32::Foundation::RECT;
        use windows::Win32::UI::HiDpi::GetDpiForWindow;
        use windows::Win32::UI::WindowsAndMessaging::{GetClientRect, GetWindowRect};
        let (mut outer, mut inner) = (RECT::default(), RECT::default());
        // SAFETY: `hwnd` is this process's live window; out-pointers are locals.
        unsafe {
            if GetWindowRect(hwnd, &mut outer).is_err() || GetClientRect(hwnd, &mut inner).is_err() {
                return (0.0, 0.0);
            }
            let scale = GetDpiForWindow(hwnd).max(96) as f32 / 96.0;
            let w = (outer.right - outer.left) - (inner.right - inner.left);
            let h = (outer.bottom - outer.top) - (inner.bottom - inner.top);
            (w.max(0) as f32 / scale, h.max(0) as f32 / scale)
        }
    }
}
