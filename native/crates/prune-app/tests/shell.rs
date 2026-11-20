//! The window shell: navigation, 3.x's keyboard shortcuts, idle without a
//! subscription, and a second launch handing over to the first.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use prune_app::app::{App, Message, Startup, Wheel, min_client_size};
use prune_app::screen::Screen;
use prune_app::shortcut::{KeyPress, Shortcut, match_shortcut};
use prune_app::zoom::ZoomAction;

fn app() -> App {
    App::new(Startup::default())
}

#[test]
fn navigate_sets_screen() {
    let mut app = app();
    assert_eq!(app.screen(), Screen::Dashboard);
    for screen in Screen::ORDER {
        let _ = app.update(Message::Navigate(screen));
        assert_eq!(app.screen(), screen);
    }
}

#[test]
fn screen_order_and_ids_match_3x() {
    // frontend/src/lib/screenOrder.js
    let ids: Vec<_> = Screen::ORDER.iter().map(Screen::key).collect();
    assert_eq!(
        ids,
        ["dashboard", "diskmap", "applications", "quarantine", "startup", "duplicates", "deepclean", "settings"]
    );
    // NavRail.jsx's NAV_KEYS
    let keys: Vec<_> = Screen::ORDER.iter().map(Screen::nav_key).collect();
    assert_eq!(
        keys,
        [
            "nav.dashboard",
            "nav.diskMap",
            "nav.applications",
            "nav.quarantine",
            "nav.startup",
            "nav.duplicates",
            "nav.deepClean",
            "nav.settings"
        ]
    );
}

/// 3.x's `press(key, over)`: no modifiers, focus on a plain element.
fn press(key: &str) -> KeyPress<'_> {
    KeyPress { key, code: "", ctrl: false, meta: false, shift: false, alt: false, typing: false }
}

fn ctrl(key: &str) -> KeyPress<'_> {
    KeyPress { ctrl: true, ..press(key) }
}

/// Every case in frontend/src/lib/shortcutMatch.test.js.
#[test]
fn shortcuts_match_3x() {
    // finds the search box on Ctrl+K and Ctrl+F
    assert_eq!(match_shortcut(&ctrl("k")), Some(Shortcut::Search));
    assert_eq!(match_shortcut(&ctrl("f")), Some(Shortcut::Search));
    // accepts Cmd as well as Ctrl
    assert_eq!(match_shortcut(&KeyPress { meta: true, ..press("k") }), Some(Shortcut::Search));
    // opens settings on Ctrl+comma
    assert_eq!(match_shortcut(&ctrl(",")), Some(Shortcut::Settings));
    // opens the shortcut list on Ctrl+slash
    assert_eq!(match_shortcut(&ctrl("/")), Some(Shortcut::Help));
    assert_eq!(match_shortcut(&KeyPress { shift: true, ..ctrl("?") }), Some(Shortcut::Help));
    // ignores the key on its own
    assert_eq!(match_shortcut(&press("k")), None);
    assert_eq!(match_shortcut(&press(",")), None);
    // is not case sensitive
    assert_eq!(match_shortcut(&ctrl("K")), Some(Shortcut::Search));
    // stays out of the way while typing in a field
    assert_eq!(match_shortcut(&KeyPress { typing: true, ..ctrl("f") }), None);
    assert_eq!(match_shortcut(&KeyPress { typing: true, ..ctrl("k") }), None);
    // still opens settings from inside a field
    assert_eq!(match_shortcut(&KeyPress { typing: true, ..ctrl(",") }), Some(Shortcut::Settings));
    // ignores a chord with Alt in it (Ctrl+Alt is AltGr)
    assert_eq!(match_shortcut(&KeyPress { alt: true, ..ctrl("k") }), None);
    assert_eq!(match_shortcut(&KeyPress { alt: true, ..ctrl(",") }), None);
    // jumps to the Nth screen on Ctrl+1 to Ctrl+8
    for n in 1..=8 {
        let key = n.to_string();
        assert_eq!(match_shortcut(&ctrl(&key)), Some(Shortcut::Screen(n)));
    }
    // claims neither Ctrl+9 nor Ctrl+0 nor a bare digit
    assert_eq!(match_shortcut(&ctrl("9")), None);
    assert_eq!(match_shortcut(&ctrl("0")), None);
    assert_eq!(match_shortcut(&press("3")), None);
    // does not jump screens while typing in a field, or on a chord with Alt
    assert_eq!(match_shortcut(&KeyPress { typing: true, ..ctrl("2") }), None);
    assert_eq!(match_shortcut(&KeyPress { alt: true, ..ctrl("2") }), None);
    // finds Ctrl+1 by its physical key on AZERTY
    assert_eq!(match_shortcut(&KeyPress { code: "Digit1", ..ctrl("&") }), Some(Shortcut::Screen(1)));
    assert_eq!(match_shortcut(&KeyPress { code: "Digit2", ..ctrl("é") }), Some(Shortcut::Screen(2)));
    assert_eq!(match_shortcut(&KeyPress { code: "Numpad4", ..ctrl("4") }), Some(Shortcut::Screen(4)));
    // does not take Ctrl+Shift+digit by position, nor Digit0 or Digit9
    assert_eq!(match_shortcut(&KeyPress { code: "Digit1", shift: true, ..ctrl("!") }), None);
    assert_eq!(match_shortcut(&KeyPress { code: "Digit0", ..ctrl("à") }), None);
    assert_eq!(match_shortcut(&KeyPress { code: "Digit9", ..ctrl("ç") }), None);
    // still defers a positional digit to a focused field
    assert_eq!(match_shortcut(&KeyPress { code: "Digit1", typing: true, ..ctrl("&") }), None);
    // has no opinion about anything else
    assert_eq!(match_shortcut(&ctrl("s")), None);
}

/// The app applies them: Ctrl+8 is Settings, Ctrl+2 Disk Map, and Ctrl+,
/// reaches Settings while a text field has focus when nothing else does.
#[test]
fn shortcuts_drive_the_app() {
    let mut app = app();
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl("8", "Digit8")));
    assert_eq!(app.screen(), Screen::Settings);
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl("2", "Digit2")));
    assert_eq!(app.screen(), Screen::DiskMap);

    app.set_typing(true);
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl("1", "Digit1")));
    assert_eq!(app.screen(), Screen::DiskMap, "Ctrl+1 defers to a focused field");
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl(",", "Comma")));
    assert_eq!(app.screen(), Screen::Settings, "Ctrl+, works from a field");
}

#[test]
fn zoom_keys_and_wheel_step_the_level() {
    let mut app = app();
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl("=", "Equal")));
    assert_eq!(app.zoom_level(), 0.5);
    let _ = app.update(Message::Zoom(ZoomAction::In));
    assert_eq!(app.zoom_level(), 1.0);
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl("-", "Minus")));
    assert_eq!(app.zoom_level(), 0.5);
    let _ = app.update(Message::Key(prune_app::app::KeyInput::ctrl("0", "Digit0")));
    assert_eq!(app.zoom_level(), 0.0);
    assert!((app.scale_factor() - 1.0).abs() < 1e-6);
    let _ = app.update(Message::Zoom(ZoomAction::In));
    let _ = app.update(Message::Zoom(ZoomAction::In));
    assert!((app.scale_factor() - 1.2).abs() < 1e-6, "level 1 is Chromium's 1.2x");
    // Ctrl+wheel up zooms in, down zooms out.
    let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::CTRL));
    let _ = app.update(Message::Wheel(Wheel::Lines(1.0)));
    assert_eq!(app.zoom_level(), 1.5);
    let _ = app.update(Message::Wheel(Wheel::Lines(-1.0)));
    assert_eq!(app.zoom_level(), 1.0);
    let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::empty()));
    let _ = app.update(Message::Wheel(Wheel::Lines(1.0)));
    assert_eq!(app.zoom_level(), 1.0, "a plain wheel is not zoom");
}

#[test]
fn ctrl_wheel_steps_once_per_notch_of_travel() {
    let mut app = app();
    let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::CTRL));
    // A touchpad swipe: many small pixel deltas, 120 px to a notch.
    for _ in 0..3 {
        let _ = app.update(Message::Wheel(Wheel::Pixels(40.0)));
    }
    assert_eq!(app.zoom_level(), 0.5, "3 x 40 px = 120 px is one step");
    for _ in 0..2 {
        let _ = app.update(Message::Wheel(Wheel::Pixels(40.0)));
    }
    assert_eq!(app.zoom_level(), 0.5, "80 px more is not yet a step");
    let ctrl_again = |app: &mut App| {
        let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::empty()));
        let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::CTRL));
    };
    ctrl_again(&mut app);
    // A free-spinning wheel reporting fractions of a line.
    for _ in 0..4 {
        let _ = app.update(Message::Wheel(Wheel::Lines(0.25)));
    }
    assert_eq!(app.zoom_level(), 1.0);
    // Turning back starts a fresh notch rather than cancelling travel.
    ctrl_again(&mut app);
    let _ = app.update(Message::Wheel(Wheel::Lines(0.5)));
    let _ = app.update(Message::Wheel(Wheel::Lines(-1.0)));
    assert_eq!(app.zoom_level(), 0.5);
    // A big flick moves one step per notch, not straight to the limit.
    let _ = app.update(Message::Wheel(Wheel::Pixels(240.0)));
    assert_eq!(app.zoom_level(), 1.5);
    // Letting go of Ctrl drops leftover travel.
    let _ = app.update(Message::Wheel(Wheel::Pixels(100.0)));
    let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::empty()));
    let _ = app.update(Message::Modifiers(iced::keyboard::Modifiers::CTRL));
    let _ = app.update(Message::Wheel(Wheel::Pixels(100.0)));
    assert_eq!(app.zoom_level(), 1.5);
}

#[test]
fn minimum_size_stays_900_by_560_at_any_zoom() {
    let frame = (16.0, 39.0);
    for level in [-2.0, -0.5, 0.0, 1.0, 3.0] {
        let min = min_client_size(frame, level);
        // iced multiplies the minimum by the zoom factor; the frame is added
        // by Windows unzoomed.
        let f = 1.2f32.powf(level as f32);
        assert!((min.width * f + frame.0 - 900.0).abs() < 0.01, "{level}: {min:?}");
        assert!((min.height * f + frame.1 - 560.0).abs() < 0.01, "{level}: {min:?}");
    }
}

#[test]
fn a_launch_before_the_window_shows_is_kept() {
    let mut app = app();
    let _ = app.update(Message::SecondInstance(vec!["Prune.exe".into()]));
    assert!(app.reveal_requested(), "remembered until the window is placed");
    let _ = app.update(Message::WindowPrepared(None, false));
    assert!(!app.reveal_requested(), "applied when shown");
    let mut quiet = App::new(Startup::default());
    let _ = quiet.update(Message::SecondInstance(vec!["Prune.exe".into(), "--start-minimized".into()]));
    assert!(!quiet.reveal_requested(), "a silent start never asks to come forward");
}

#[test]
fn saved_zoom_is_restored() {
    let app = App::new(Startup {
        window_state: Some(serde_json::json!({ "x": 0, "y": 0, "width": 1000, "height": 700, "zoomLevel": 1 })),
        ..Startup::default()
    });
    assert_eq!(app.zoom_level(), 1.0);
}

#[test]
fn tab_moves_keyboard_focus_through_the_rail() {
    let mut app = app();
    let tab = || Message::Key(prune_app::app::KeyInput::named("Tab"));
    let shift_tab = || Message::Key(prune_app::app::KeyInput { shift: true, ..prune_app::app::KeyInput::named("Tab") });
    assert_eq!(app.focused(), None);
    let _ = app.update(tab());
    assert_eq!(app.focused(), Some(Screen::Dashboard));
    assert!(app.rail_open(), "keyboard focus opens the rail");
    let _ = app.update(tab());
    assert_eq!(app.focused(), Some(Screen::DiskMap));
    let _ = app.update(shift_tab());
    let _ = app.update(shift_tab());
    assert_eq!(app.focused(), Some(Screen::Settings), "wraps");
    let _ = app.update(Message::Key(prune_app::app::KeyInput::named("Enter")));
    assert_eq!(app.screen(), Screen::Settings);
    let _ = app.update(Message::PointerPressed);
    assert_eq!(app.focused(), None, "a click ends keyboard focus");
    assert!(!app.rail_open());
}

/// Settle every animation by ticking well past its end.
fn settle(app: &mut App) {
    let t0 = Instant::now();
    let _ = app.update(Message::Tick(t0));
    let _ = app.update(Message::Tick(t0 + Duration::from_secs(2)));
}

#[test]
fn idle_has_no_subscription() {
    let mut app = app();
    assert_eq!(app.subscription().units(), 0, "nothing runs at start");

    let _ = app.update(Message::RailHover(true));
    assert!(app.subscription().units() > 0, "the rail is animating");
    settle(&mut app);
    assert_eq!(app.subscription().units(), 0, "idle after the rail opens");

    let _ = app.update(Message::Navigate(Screen::Startup));
    assert!(app.subscription().units() > 0, "the mark is sliding");
    settle(&mut app);
    let _ = app.update(Message::RailHover(false));
    settle(&mut app);
    assert_eq!(app.subscription().units(), 0, "idle after everything settles");
}

#[test]
fn reduced_motion_jumps_to_the_end() {
    let mut app = App::new(Startup { reduced_motion: true, ..Startup::default() });
    let _ = app.update(Message::RailHover(true));
    assert_eq!(app.subscription().units(), 0);
    assert_eq!(app.rail_width(), 200.0);
    let _ = app.update(Message::Navigate(Screen::Settings));
    assert_eq!(app.subscription().units(), 0);
}

#[test]
fn rail_width_follows_3x_timing() {
    let mut app = app();
    assert_eq!(app.rail_width(), 72.0);
    let _ = app.update(Message::RailHover(true));
    let t0 = Instant::now();
    let _ = app.update(Message::Tick(t0));
    let _ = app.update(Message::Tick(t0 + Duration::from_millis(160)));
    let mid = app.rail_width();
    assert!(mid > 72.0 && mid < 200.0, "halfway through the 320 ms open: {mid}");
    let _ = app.update(Message::Tick(t0 + Duration::from_millis(320)));
    assert_eq!(app.rail_width(), 200.0);

    // Closing waits 100 ms before it starts.
    let _ = app.update(Message::RailHover(false));
    let t1 = t0 + Duration::from_millis(400);
    let _ = app.update(Message::Tick(t1));
    let _ = app.update(Message::Tick(t1 + Duration::from_millis(90)));
    assert_eq!(app.rail_width(), 200.0, "still inside the close delay");
    let _ = app.update(Message::Tick(t1 + Duration::from_millis(420)));
    assert_eq!(app.rail_width(), 72.0);
}

#[test]
fn view_builds_for_every_screen() {
    let mut app = app();
    for screen in Screen::ORDER {
        let _ = app.update(Message::Navigate(screen));
        let _element = app.view();
    }
}

// ---- The real binary --------------------------------------------------

struct Profile(PathBuf);

impl Profile {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("prune-shell-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Profile(dir)
    }
    fn settings(&self) -> PathBuf {
        self.0.join("settings.json")
    }
}

impl Drop for Profile {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn prune(profile: &Profile) -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_Prune"));
    cmd.env("UNREVO_SETTINGS_PATH", profile.settings())
        .env("PRUNE_TRACE_STARTUP", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    cmd
}

/// Spawns Prune and forwards each stderr line to the returned channel.
fn spawn_logged(profile: &Profile) -> (Child, mpsc::Receiver<String>) {
    let mut child = prune(profile).spawn().expect("spawn Prune");
    let stderr = child.stderr.take().unwrap();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = tx.send(line);
        }
    });
    (child, rx)
}

fn wait_for_line(rx: &mpsc::Receiver<String>, needle: &str, timeout: Duration) -> Option<String> {
    let deadline = Instant::now() + timeout;
    while let Some(left) = deadline.checked_duration_since(Instant::now()) {
        match rx.recv_timeout(left) {
            Ok(line) if line.contains(needle) => return Some(line),
            Ok(_) => continue,
            Err(_) => return None,
        }
    }
    None
}

fn wait_exit(child: &mut Child, timeout: Duration) -> Option<std::process::ExitStatus> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait().unwrap() {
            return Some(status);
        }
        if Instant::now() > deadline {
            return None;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// Asks every top-level window of `pid` to close, as the caption's close
/// button does.
#[cfg(windows)]
fn close_windows_of(pid: u32) {
    use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, PostMessageW, WM_CLOSE};
    use windows::core::BOOL;

    unsafe extern "system" fn each(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let mut owner = 0u32;
        // SAFETY: `owner` outlives the call.
        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut owner)) };
        if owner == lparam.0 as u32 {
            // SAFETY: posting to a window handle EnumWindows just gave us.
            let _ = unsafe { PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0)) };
        }
        true.into()
    }
    // SAFETY: the callback only reads its arguments.
    let _ = unsafe { EnumWindows(Some(each), LPARAM(pid as isize)) };
}

fn read_json(path: &Path) -> serde_json::Value {
    serde_json::from_slice(&std::fs::read(path).expect("window-state.json written")).expect("valid JSON")
}

#[cfg(windows)]
#[test]
fn second_instance_signals_first() {
    let profile = Profile::new("second");
    let (mut first, log) = spawn_logged(&profile);
    let frame = wait_for_line(&log, "first-frame-ms=", Duration::from_secs(30));
    assert!(frame.is_some(), "the first instance never drew a frame");

    let started = Instant::now();
    let mut second = prune(&profile).stderr(Stdio::null()).spawn().expect("spawn second");
    let status = wait_exit(&mut second, Duration::from_secs(2));
    let elapsed = started.elapsed();
    assert!(status.is_some_and(|s| s.success()), "second instance: {status:?} after {elapsed:?}");

    let focus = wait_for_line(&log, "focus-request", Duration::from_secs(2));

    close_windows_of(first.id());
    let closed = wait_exit(&mut first, Duration::from_secs(10));
    if closed.is_none() {
        let _ = first.kill();
    }
    assert!(focus.is_some(), "the first instance never logged focus-request");
    assert!(closed.is_some_and(|s| s.success()), "first instance on close: {closed:?}");
}

#[cfg(windows)]
#[test]
fn closing_saves_window_state_in_3x_shape() {
    let profile = Profile::new("close");
    let (mut child, log) = spawn_logged(&profile);
    let frame = wait_for_line(&log, "first-frame-ms=", Duration::from_secs(30));
    assert!(frame.is_some(), "never drew a frame");
    let ms: f64 = frame.unwrap().trim().trim_start_matches("first-frame-ms=").parse().expect("a number");
    assert!(ms > 0.0);

    close_windows_of(child.id());
    let status = wait_exit(&mut child, Duration::from_secs(10));
    if status.is_none() {
        let _ = child.kill();
    }
    assert!(status.is_some_and(|s| s.success()), "exit on close: {status:?}");

    let state = read_json(&profile.0.join("window-state.json"));
    let keys: Vec<_> = state.as_object().unwrap().keys().cloned().collect();
    assert_eq!(keys, ["x", "y", "width", "height", "isMaximized", "zoomLevel"]);
    assert_eq!(state["width"], 1280, "the 3.x default size, saved as DIP");
    assert_eq!(state["height"], 860);
    assert_eq!(state["isMaximized"], false);
    assert_eq!(state["zoomLevel"], 0);
    assert!(!profile.settings().exists(), "opening and closing never writes settings.json");
}

#[cfg(windows)]
#[test]
fn saved_bounds_and_zoom_come_back() {
    let profile = Profile::new("restore");
    let path = profile.0.join("window-state.json");
    std::fs::write(&path, r#"{"x":120,"y":90,"width":1000,"height":700,"isMaximized":false,"zoomLevel":1}"#).unwrap();
    let (mut child, log) = spawn_logged(&profile);
    assert!(wait_for_line(&log, "first-frame-ms=", Duration::from_secs(30)).is_some());
    close_windows_of(child.id());
    let status = wait_exit(&mut child, Duration::from_secs(10));
    if status.is_none() {
        let _ = child.kill();
    }
    assert!(status.is_some_and(|s| s.success()));
    let state = read_json(&path);
    assert_eq!(
        (&state["x"], &state["y"], &state["width"], &state["height"], &state["zoomLevel"]),
        (&serde_json::json!(120), &serde_json::json!(90), &serde_json::json!(1000), &serde_json::json!(700), &serde_json::json!(1))
    );
}
