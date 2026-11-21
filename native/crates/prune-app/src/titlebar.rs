//! The window's title bar, after 3.x's `frontend/src/components/TitleBar.jsx`
//! and the frame `electron/main.cjs` gives it.
//!
//! 3.x hides Electron's caption (`titleBarStyle: 'hidden'`) and draws its
//! own 40 px strip: `--bg-base`, a 1 px `--border-subtle` line along the
//! bottom (inside the 40, Tailwind's border-box), the 20 px logo 26 px in
//! (so its centre lines up with the rail's icons at x = 36), a 10 px gap,
//! and "PRUNE" in Geist 600 at 12.5 px with 0.14em tracking. Windows'
//! minimize, maximize and close sit over its right end (the
//! `titleBarOverlay`), each 46 px wide and the bar's full height, glyphs in
//! `symbolColor`. With zoom the bar is `round(40 × 1.2^level)` DIP tall
//! (`electron/zoom.cjs`'s `titleBarOverlayHeight`).
//!
//! 4.0 draws all of it, buttons included, and makes Windows treat it as a
//! caption: the window keeps its standard frame (resize borders, DWM
//! shadow, Snap), but `WM_NCCALCSIZE` gives the caption strip to the client
//! area and `WM_NCHITTEST` answers for it: `HTCAPTION` for the drag area
//! (so dragging, double-click to maximize and right-click for the system
//! menu are Windows' own), `HTMINBUTTON` / `HTMAXBUTTON` / `HTCLOSE` over
//! the buttons, and `HTTOP` along the top edge. `HTMAXBUTTON` is what makes
//! Windows 11 show the Snap Layouts flyout on hover. See [`win32`].

use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use iced::futures::channel::mpsc::{self, UnboundedReceiver, UnboundedSender};
use iced::widget::{column, container, row, space, stack, svg, text};
use iced::{Background, Color, Element, Length, alignment, font};

use crate::screen::geist;
use crate::theme::Palette;
use crate::zoom;

/// `h-10`, and `TITLEBAR_BASE_HEIGHT` in `electron/zoom.cjs`.
pub const BASE_HEIGHT: f32 = 40.0;
/// A Windows 11 caption button's width.
pub const BUTTON_WIDTH: f32 = 46.0;
/// `pl-[26px]`: the logo's centre lands on the rail icons' x = 36.
pub const LEFT_PAD: f32 = 26.0;
pub const LOGO_SIZE: f32 = 20.0;
/// `gap-2.5`.
pub const LOGO_GAP: f32 = 10.0;
/// `text-[12.5px]`.
pub const NAME_SIZE: f32 = 12.5;
/// `tracking-[0.14em]`.
pub const NAME_TRACKING: f32 = 0.14 * NAME_SIZE;
/// The caption glyphs' box (Segoe Fluent Icons' chrome glyphs at 10 px).
const GLYPH: f32 = 10.0;

/// The bar's height in DIP at a zoom level: `round(40 × 1.2^level)`, as
/// 3.x's `titleBarOverlayHeight`.
pub fn height(zoom_level: f64) -> f32 {
    (f64::from(BASE_HEIGHT) * zoom::factor(zoom_level)).round() as f32
}

/// One caption button's width in DIP at a zoom level; the whole bar zooms.
pub fn button_width(zoom_level: f64) -> f32 {
    (f64::from(BUTTON_WIDTH) * zoom::factor(zoom_level)).round() as f32
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Button {
    Minimize,
    Maximize,
    Close,
}

impl Button {
    /// Left to right.
    pub const ALL: [Button; 3] = [Button::Minimize, Button::Maximize, Button::Close];

    /// The button a non-client hit-test code names, if any.
    pub fn from_code(code: u32) -> Option<Button> {
        match code {
            HTMINBUTTON => Some(Button::Minimize),
            HTMAXBUTTON => Some(Button::Maximize),
            HTCLOSE => Some(Button::Close),
            _ => None,
        }
    }
}

/// What a point of the client area is to Windows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Hit {
    /// The app's own content.
    Client,
    /// The drag area.
    Caption,
    Button(Button),
    /// The top resize edge, which the removed caption no longer provides.
    Top,
    TopLeft,
    TopRight,
}

// The WM_NCHITTEST codes, as winuser.h has them (here so the mapping is
// testable on any platform).
pub const HTCLIENT: u32 = 1;
pub const HTCAPTION: u32 = 2;
pub const HTMINBUTTON: u32 = 8;
pub const HTMAXBUTTON: u32 = 9;
pub const HTTOP: u32 = 12;
pub const HTTOPLEFT: u32 = 13;
pub const HTTOPRIGHT: u32 = 14;
pub const HTCLOSE: u32 = 20;

impl Hit {
    /// The `WM_NCHITTEST` answer.
    pub fn code(self) -> u32 {
        match self {
            Hit::Client => HTCLIENT,
            Hit::Caption => HTCAPTION,
            Hit::Button(Button::Minimize) => HTMINBUTTON,
            Hit::Button(Button::Maximize) => HTMAXBUTTON,
            Hit::Button(Button::Close) => HTCLOSE,
            Hit::Top => HTTOP,
            Hit::TopLeft => HTTOPLEFT,
            Hit::TopRight => HTTOPRIGHT,
        }
    }
}

/// The client area as hit-testing sees it. Lengths are physical pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    /// The client area's width.
    pub width: f32,
    /// The display scale (DPI / 96).
    pub scale: f32,
    pub zoom_level: f64,
    pub maximized: bool,
    /// How far down from the top edge resizes (the frame's own thickness,
    /// `SM_CYSIZEFRAME + SM_CXPADDEDBORDER`). A maximized window has none.
    pub resize_band: f32,
}

/// What the client point `(x, y)` (physical pixels) is. The bar is
/// [`height`] × scale tall; the buttons are the last three
/// [`button_width`] × scale columns of it; the top `resize_band` pixels
/// resize unless the window is maximized (where the buttons reach the
/// screen's edge, as Windows' own do).
pub fn hit_test(x: f32, y: f32, f: &Frame) -> Hit {
    if !f.maximized && y < f.resize_band {
        return if x < f.resize_band {
            Hit::TopLeft
        } else if x >= f.width - f.resize_band {
            Hit::TopRight
        } else {
            Hit::Top
        };
    }
    if y >= height(f.zoom_level) * f.scale {
        return Hit::Client;
    }
    let from_right = f.width - x;
    let bw = button_width(f.zoom_level) * f.scale;
    match (from_right / bw).ceil() as i32 {
        ..=1 => Hit::Button(Button::Close),
        2 => Hit::Button(Button::Maximize),
        3 => Hit::Button(Button::Minimize),
        _ => Hit::Caption,
    }
}

/// A rectangle in screen pixels, as Win32's `RECT`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Edges {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Left,
    Top,
    Right,
    Bottom,
}

/// What an auto-hide taskbar keeps of a maximized window: enough of the
/// screen edge for the pointer to reach it and bring the taskbar up.
pub const AUTOHIDE_GAP: i32 = 2;

/// The client rectangle `WM_NCCALCSIZE` answers. `standard` is what the
/// default frame gives (borders and caption taken off `window_top`'s
/// window); the caption and top border go back to the client area, and the
/// left, right and bottom borders stay (they are Windows 10/11's invisible
/// resize borders, and they carry the shadow). A maximized window hangs
/// `resize_band` past every edge of the work area, so its client area
/// starts that far down instead; an auto-hide taskbar on `autohide` keeps a
/// [`AUTOHIDE_GAP`] there.
pub fn client_edges(
    window_top: i32,
    standard: Edges,
    maximized: bool,
    resize_band: i32,
    autohide: Option<Side>,
) -> Edges {
    let mut r = Edges { top: window_top, ..standard };
    if maximized {
        r.top += resize_band;
        match autohide {
            Some(Side::Top) => r.top += AUTOHIDE_GAP,
            Some(Side::Bottom) => r.bottom -= AUTOHIDE_GAP,
            Some(Side::Left) => r.left += AUTOHIDE_GAP,
            Some(Side::Right) => r.right -= AUTOHIDE_GAP,
            None => {}
        }
    }
    r
}

/// What the window procedure tells the app about the bar.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptionEvent {
    /// The pointer is over this button, or over none.
    Hover(Option<Button>),
    /// The left button went down on this button, or was let go.
    Pressed(Option<Button>),
    /// The window was maximized (`true`) or restored.
    Maximized(bool),
}

static SENDER: Mutex<Option<UnboundedSender<CaptionEvent>>> = Mutex::new(None);

/// The events from the window procedure, from now on. One app listens.
pub fn events() -> UnboundedReceiver<CaptionEvent> {
    let (tx, rx) = mpsc::unbounded();
    if let Ok(mut s) = SENDER.lock() {
        *s = Some(tx);
    }
    rx
}

fn send(event: CaptionEvent) {
    if let Ok(s) = SENDER.lock()
        && let Some(tx) = s.as_ref()
    {
        let _ = tx.unbounded_send(event);
    }
}

/// The zoom level hit-testing uses, kept in step by the app.
static ZOOM_BITS: AtomicU64 = AtomicU64::new(0);

pub fn set_zoom_level(level: f64) {
    ZOOM_BITS.store(level.to_bits(), Ordering::Relaxed);
}

pub fn zoom_level() -> f64 {
    f64::from_bits(ZOOM_BITS.load(Ordering::Relaxed))
}

// ---- Drawing --------------------------------------------------------------

/// Everything the bar draws from.
#[derive(Clone, Copy)]
pub struct Bar {
    pub palette: &'static Palette,
    pub dark: bool,
    pub zoom_level: f64,
    pub hover: Option<Button>,
    pub pressed: Option<Button>,
    pub maximized: bool,
}

/// Windows 11's caption button fills (`SubtleFillColorSecondary` on hover,
/// `...Tertiary` pressed) and its close red.
fn hover_fill(dark: bool) -> Color {
    if dark { Color::from_rgba8(255, 255, 255, 0.0605) } else { Color::from_rgba8(0, 0, 0, 0.0373) }
}

fn pressed_fill(dark: bool) -> Color {
    if dark { Color::from_rgba8(255, 255, 255, 0.0419) } else { Color::from_rgba8(0, 0, 0, 0.0241) }
}

pub const CLOSE_RED: Color = Color::from_rgb8(0xc4, 0x2b, 0x1c);

/// `src` painted over opaque `dst`.
pub fn over(src: Color, dst: Color) -> Color {
    let a = src.a;
    Color {
        r: src.r * a + dst.r * (1.0 - a),
        g: src.g * a + dst.g * (1.0 - a),
        b: src.b * a + dst.b * (1.0 - a),
        a: 1.0,
    }
}

/// A button's background and glyph colour. At rest the button is the bar
/// itself (3.x's overlay `color` is `--bg-base`, opaque, over the border);
/// the glyph is `symbolColor` (`--text-secondary`).
pub fn button_colors(bar: &Bar, button: Button) -> (Color, Color) {
    let p = bar.palette;
    let hot = bar.hover == Some(button);
    let down = hot && bar.pressed == Some(button);
    match button {
        Button::Close if down => (over(Color { a: 0.9, ..CLOSE_RED }, p.bg_base), Color { a: 0.85, ..Color::WHITE }),
        Button::Close if hot => (CLOSE_RED, Color::WHITE),
        _ if down => (over(pressed_fill(bar.dark), p.bg_base), p.text_secondary),
        _ if hot => (over(hover_fill(bar.dark), p.bg_base), p.text_secondary),
        _ => (p.bg_base, p.text_secondary),
    }
}

fn glyph_svg(body: &str) -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">{body}</svg>"#
    )
}

/// Windows 11's chrome glyphs (ChromeMinimize, ChromeMaximize,
/// ChromeRestore, ChromeClose), drawn on the half pixel so 1 px strokes
/// land on whole pixels at 100%.
const MINIMIZE: &str = r#"<path d="M0 5.5h10"/>"#;
const MAXIMIZE: &str = r#"<rect x="0.5" y="0.5" width="9" height="9" rx="1"/>"#;
const RESTORE: &str = r#"<rect x="0.5" y="2.5" width="7" height="7" rx="1"/><path d="M2.5 0.5h5a2 2 0 0 1 2 2v5"/>"#;
const CLOSE: &str = r#"<path d="M0.5 0.5l9 9M9.5 0.5l-9 9"/>"#;

static GLYPHS: std::sync::LazyLock<[svg::Handle; 4]> = std::sync::LazyLock::new(|| {
    [MINIMIZE, MAXIMIZE, RESTORE, CLOSE].map(|b| svg::Handle::from_memory(glyph_svg(b).into_bytes()))
});

/// 3.x's `frontend/public/logo.png`, box-filtered to 64 px (the 512 px
/// original would alias when drawn at 20), wrapped in an SVG so the
/// renderer's SVG path draws it: no image decoder is compiled in for one
/// small picture. `logo_asset_is_3x_logo` checks it against the original.
pub const LOGO_PNG: &[u8] = include_bytes!("../assets/logo-64.png");

pub fn logo_svg() -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><image width="20" height="20" href="data:image/png;base64,{}"/></svg>"#,
        base64(LOGO_PNG)
    )
}

static LOGO: std::sync::LazyLock<svg::Handle> =
    std::sync::LazyLock::new(|| svg::Handle::from_memory(logo_svg().into_bytes()));

/// Standard base64 with padding.
pub fn base64(bytes: &[u8]) -> String {
    const ABC: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = chunk.iter().enumerate().fold(0u32, |n, (i, &b)| n | (u32::from(b) << (16 - 8 * i)));
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(ABC[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

fn fill<'a, M: 'a>(color: Color) -> container::Container<'a, M> {
    container(space().width(Length::Fill).height(Length::Fill))
        .style(move |_| container::Style { background: Some(Background::Color(color)), ..container::Style::default() })
}

/// The bar, full width. Sizes are iced's logical units, which the zoom
/// scales, so the bar's DIP sizes are divided by the zoom factor here.
pub fn view<'a, M: 'a>(bar: Bar) -> Element<'a, M> {
    let p = bar.palette;
    let f = zoom::factor(bar.zoom_level) as f32;
    let h = height(bar.zoom_level) / f;
    // One device pixel at 100% display scale, whatever the zoom (a CSS
    // border at a fractional zoom is snapped to whole pixels too).
    let line = 1.0 / f;

    let logo = svg(LOGO.clone()).width(LOGO_SIZE).height(LOGO_SIZE);
    // iced text has no letter-spacing: each letter is its own text, set
    // 0.14em apart.
    let name = row("PRUNE".chars().map(|c| {
        text(c.to_string())
            .size(NAME_SIZE)
            .line_height(1.5)
            .font(geist(font::Weight::Semibold))
            .color(p.text_primary)
            .into()
    }))
    .spacing(NAME_TRACKING);
    let brand = row![logo, name]
        .spacing(LOGO_GAP)
        .padding(iced::Padding { left: LEFT_PAD, ..iced::Padding::ZERO })
        .align_y(alignment::Vertical::Center)
        .width(Length::Fill)
        .height(h - line);
    let ground = column![brand, fill(p.border_subtle).height(line)].width(Length::Fill).height(h);

    let bw = button_width(bar.zoom_level) / f;
    let buttons = row(Button::ALL.map(|b| {
        let (bg, ink) = button_colors(&bar, b);
        let glyph = match b {
            Button::Minimize => 0,
            Button::Maximize if bar.maximized => 2,
            Button::Maximize => 1,
            Button::Close => 3,
        };
        let icon =
            svg(GLYPHS[glyph].clone()).width(GLYPH).height(GLYPH).style(move |_, _| svg::Style { color: Some(ink) });
        container(icon)
            .center_x(bw)
            .center_y(h)
            .style(move |_| container::Style { background: Some(Background::Color(bg)), ..container::Style::default() })
            .into()
    }));
    let strip = row![space().width(Length::Fill), buttons].height(h);

    container(stack![ground, strip].width(Length::Fill).height(h))
        .width(Length::Fill)
        .height(h)
        .style(move |_| container::Style {
            background: Some(Background::Color(p.bg_base)),
            ..container::Style::default()
        })
        .into()
}

// ---- The window procedure --------------------------------------------------

/// The subclass that makes the bar a caption. Installed once on the main
/// window, on the UI thread, before it is first shown.
#[cfg(windows)]
pub mod win32 {
    use std::sync::atomic::{AtomicU8, Ordering};

    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
    use windows::Win32::Graphics::Dwm::{DWMWA_USE_IMMERSIVE_DARK_MODE, DwmSetWindowAttribute};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromWindow, ScreenToClient,
    };
    use windows::Win32::UI::HiDpi::{GetDpiForWindow, GetSystemMetricsForDpi};
    use windows::Win32::UI::Input::KeyboardAndMouse::{TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT, TrackMouseEvent};
    use windows::Win32::UI::Shell::{
        ABE_BOTTOM, ABE_LEFT, ABE_RIGHT, ABE_TOP, ABM_GETAUTOHIDEBAREX, ABM_GETSTATE, ABS_AUTOHIDE, APPBARDATA,
        DefSubclassProc, SHAppBarMessage, SetWindowSubclass,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClientRect, IsZoomed, MINMAXINFO, NCCALCSIZE_PARAMS, PostMessageW, SC_CLOSE, SC_MAXIMIZE, SC_MINIMIZE,
        SC_RESTORE, SIZE_MAXIMIZED, SIZE_RESTORED, SM_CXPADDEDBORDER, SM_CYSIZEFRAME, SWP_FRAMECHANGED, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER, SetWindowPos, WM_GETMINMAXINFO, WM_LBUTTONUP,
        WM_MOUSEMOVE, WM_NCCALCSIZE, WM_NCHITTEST, WM_NCLBUTTONDBLCLK, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP,
        WM_NCMOUSELEAVE, WM_NCMOUSEMOVE, WM_SIZE, WM_SYSCOMMAND,
    };

    use super::{Button, CaptionEvent, Edges, Frame, HTCLIENT, Side, client_edges, hit_test, send, zoom_level};

    const SUBCLASS_ID: usize = 0x5052_554e; // "PRUN"

    /// The button under the pointer and the one pressed, as 0 (none) or
    /// 1 + index. Only the UI thread touches them.
    static HOVER: AtomicU8 = AtomicU8::new(0);
    static PRESSED: AtomicU8 = AtomicU8::new(0);

    fn encode(b: Option<Button>) -> u8 {
        b.map_or(0, |b| 1 + Button::ALL.iter().position(|x| *x == b).unwrap_or(0) as u8)
    }

    fn decode(v: u8) -> Option<Button> {
        v.checked_sub(1).and_then(|i| Button::ALL.get(usize::from(i)).copied())
    }

    fn set_hover(b: Option<Button>) {
        if HOVER.swap(encode(b), Ordering::Relaxed) != encode(b) {
            send(CaptionEvent::Hover(b));
        }
    }

    fn set_pressed(b: Option<Button>) {
        if PRESSED.swap(encode(b), Ordering::Relaxed) != encode(b) {
            send(CaptionEvent::Pressed(b));
        }
    }

    /// Takes the caption over: subclasses the window and has Windows
    /// recompute its frame. `false` if the subclass could not be set, in
    /// which case the standard caption stays.
    pub fn install(hwnd: HWND) -> bool {
        // SAFETY: `hwnd` is this thread's live window; `proc_` stays valid
        // for the life of the process.
        let ok = unsafe { SetWindowSubclass(hwnd, Some(proc_), SUBCLASS_ID, 0) }.as_bool();
        if ok {
            let flags = SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_NOACTIVATE;
            // SAFETY: as above.
            let _ = unsafe { SetWindowPos(hwnd, None, 0, 0, 0, 0, flags) };
        }
        ok
    }

    /// Dark or light for what DWM still draws of the frame (the border and
    /// the shadow's edge on Windows 11). The caption itself is ours now.
    pub fn set_dark_frame(hwnd: HWND, dark: bool) {
        let v: i32 = dark.into();
        // SAFETY: the pointer is to a local of the size passed with it.
        let _ = unsafe { DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, (&raw const v).cast(), 4) };
    }

    /// The frame's thickness at the window's DPI: how far a maximized
    /// window hangs past the screen, and the top resize band.
    fn resize_band(hwnd: HWND) -> i32 {
        // SAFETY: plain metric reads.
        unsafe {
            let dpi = GetDpiForWindow(hwnd).max(96);
            GetSystemMetricsForDpi(SM_CYSIZEFRAME, dpi) + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi)
        }
    }

    /// The edge of the window's monitor with an auto-hide taskbar, if any.
    fn autohide_side(hwnd: HWND) -> Option<Side> {
        // SAFETY: out-structures are locals with their sizes set.
        unsafe {
            let mut abd = APPBARDATA { cbSize: size_of::<APPBARDATA>() as u32, ..Default::default() };
            if SHAppBarMessage(ABM_GETSTATE, &mut abd) as u32 & ABS_AUTOHIDE == 0 {
                return None;
            }
            let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
            if !GetMonitorInfoW(monitor, &mut info).as_bool() {
                return None;
            }
            [(ABE_TOP, Side::Top), (ABE_BOTTOM, Side::Bottom), (ABE_LEFT, Side::Left), (ABE_RIGHT, Side::Right)]
                .into_iter()
                .find(|&(edge, _)| {
                    let mut q = APPBARDATA {
                        cbSize: size_of::<APPBARDATA>() as u32,
                        uEdge: edge,
                        rc: info.rcMonitor,
                        ..Default::default()
                    };
                    SHAppBarMessage(ABM_GETAUTOHIDEBAREX, &mut q) != 0
                })
                .map(|(_, side)| side)
        }
    }

    fn to_edges(r: RECT) -> Edges {
        Edges { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }

    fn to_rect(e: Edges) -> RECT {
        RECT { left: e.left, top: e.top, right: e.right, bottom: e.bottom }
    }

    /// `GET_X_LPARAM` / `GET_Y_LPARAM`: signed, for screens left of or
    /// above the primary one.
    fn point(lparam: LPARAM) -> POINT {
        POINT { x: i32::from(lparam.0 as u16 as i16), y: i32::from((lparam.0 >> 16) as u16 as i16) }
    }

    fn hit_at(hwnd: HWND, lparam: LPARAM) -> u32 {
        let mut pt = point(lparam);
        let mut rc = RECT::default();
        // SAFETY: out-pointers are locals; `hwnd` is the subclassed window.
        unsafe {
            let _ = ScreenToClient(hwnd, &mut pt);
            if GetClientRect(hwnd, &mut rc).is_err() {
                return HTCLIENT;
            }
            let frame = Frame {
                width: (rc.right - rc.left) as f32,
                scale: GetDpiForWindow(hwnd).max(96) as f32 / 96.0,
                zoom_level: zoom_level(),
                maximized: IsZoomed(hwnd).as_bool(),
                resize_band: resize_band(hwnd) as f32,
            };
            hit_test(pt.x as f32, pt.y as f32, &frame).code()
        }
    }

    fn press(hwnd: HWND, b: Button) {
        // SAFETY: plain query of the subclassed window.
        let command = match b {
            Button::Minimize => SC_MINIMIZE,
            Button::Maximize if unsafe { IsZoomed(hwnd) }.as_bool() => SC_RESTORE,
            Button::Maximize => SC_MAXIMIZE,
            // WM_CLOSE through winit: the app decides (tray or quit).
            Button::Close => SC_CLOSE,
        };
        set_hover(None);
        // SAFETY: posting to the window this procedure belongs to.
        let _ = unsafe { PostMessageW(Some(hwnd), WM_SYSCOMMAND, WPARAM(command as usize), LPARAM(0)) };
    }

    unsafe extern "system" fn proc_(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        // SAFETY (for the whole body): Windows calls this with valid
        // arguments for `msg`; DefSubclassProc passes them on unchanged.
        let next = || unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
        let button = || Button::from_code(wparam.0 as u32);
        match msg {
            WM_NCCALCSIZE if wparam.0 != 0 => {
                // With wparam TRUE, lparam is an NCCALCSIZE_PARAMS whose
                // first rectangle is the proposed window rectangle on the
                // way in and the client rectangle on the way out.
                let params = lparam.0 as *mut NCCALCSIZE_PARAMS;
                // SAFETY: as above; no reference is held across `next()`.
                let window_top = unsafe { (*params).rgrc[0].top };
                let standard = next();
                if standard.0 != 0 {
                    return standard;
                }
                // SAFETY: plain query.
                let maximized = unsafe { IsZoomed(hwnd) }.as_bool();
                let side = if maximized { autohide_side(hwnd) } else { None };
                // SAFETY: as above.
                let rect = unsafe { &mut (*params).rgrc[0] };
                *rect = to_rect(client_edges(window_top, to_edges(*rect), maximized, resize_band(hwnd), side));
                LRESULT(0)
            }
            WM_NCHITTEST => {
                // The left, right and bottom borders are still Windows' own.
                let standard = next();
                if standard.0 != HTCLIENT as isize {
                    return standard;
                }
                LRESULT(hit_at(hwnd, lparam) as isize)
            }
            WM_NCMOUSEMOVE => {
                let b = button();
                if b.is_some() {
                    let mut track = TRACKMOUSEEVENT {
                        cbSize: size_of::<TRACKMOUSEEVENT>() as u32,
                        dwFlags: TME_LEAVE | TME_NONCLIENT,
                        hwndTrack: hwnd,
                        dwHoverTime: 0,
                    };
                    // SAFETY: `track` is a local with its size set.
                    let _ = unsafe { TrackMouseEvent(&mut track) };
                }
                if decode(PRESSED.load(Ordering::Relaxed)).is_some_and(|p| Some(p) != b) {
                    set_pressed(None);
                }
                set_hover(b);
                // On to DefWindowProc: Windows 11 runs Snap Layouts from it.
                next()
            }
            WM_NCMOUSELEAVE => {
                set_hover(None);
                set_pressed(None);
                next()
            }
            WM_MOUSEMOVE | WM_LBUTTONUP => {
                set_hover(None);
                set_pressed(None);
                next()
            }
            // Not DefWindowProc for the buttons: it would draw a classic
            // caption button over ours and run its own modal loop.
            WM_NCLBUTTONDOWN | WM_NCLBUTTONDBLCLK if button().is_some() => {
                set_hover(button());
                set_pressed(button());
                LRESULT(0)
            }
            WM_NCLBUTTONUP if button().is_some() => {
                let armed = decode(PRESSED.load(Ordering::Relaxed));
                set_pressed(None);
                if let Some(b) = button().filter(|b| armed == Some(*b)) {
                    press(hwnd, b);
                }
                LRESULT(0)
            }
            WM_GETMINMAXINFO => {
                // 3.x's 900x560 outer minimum (less on a smaller work
                // area), in this monitor's pixels.
                let r = next();
                if let Some(work) = crate::window_state::win32::work_of(hwnd) {
                    // SAFETY: plain query.
                    let (x, y) = crate::window_state::min_track_px(&work, unsafe { GetDpiForWindow(hwnd) });
                    // SAFETY: lparam is the MINMAXINFO Windows passes.
                    unsafe { (*(lparam.0 as *mut MINMAXINFO)).ptMinTrackSize = POINT { x, y } };
                }
                r
            }
            WM_SIZE => {
                match wparam.0 as u32 {
                    SIZE_MAXIMIZED => send(CaptionEvent::Maximized(true)),
                    SIZE_RESTORED => send(CaptionEvent::Maximized(false)),
                    _ => {}
                }
                next()
            }
            _ => next(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn height_is_3x_overlay_formula() {
        // electron/zoom.test.cjs: 40 at 100%, Chromium's 1.2x per step.
        assert_eq!(height(0.0), 40.0);
        assert_eq!(height(1.0), 48.0);
        assert_eq!(height(-1.0), 33.0);
        assert_eq!(height(0.5), 44.0);
        assert_eq!(height(3.0), 69.0);
        assert_eq!(height(-2.0), 28.0);
        let mut level = zoom::ZOOM_MIN;
        let mut last = height(level);
        while level < zoom::ZOOM_MAX {
            level += zoom::ZOOM_STEP;
            assert!(height(level) > last, "not increasing at {level}");
            last = height(level);
        }
        assert_eq!(button_width(0.0), 46.0);
        assert_eq!(button_width(1.0), 55.0);
    }

    fn frame(width: f32, scale: f32, zoom_level: f64, maximized: bool) -> Frame {
        Frame { width, scale, zoom_level, maximized, resize_band: 8.0 * scale }
    }

    #[test]
    fn hit_test_at_100_percent() {
        let f = frame(1264.0, 1.0, 0.0, false);
        let at = |x, y| hit_test(x, y, &f);
        // The resize band along the top, corners at its ends.
        assert_eq!(at(600.0, 0.0), Hit::Top);
        assert_eq!(at(600.0, 7.9), Hit::Top);
        assert_eq!(at(2.0, 3.0), Hit::TopLeft);
        assert_eq!(at(1260.0, 3.0), Hit::TopRight);
        // The drag area: logo, name and the empty middle.
        assert_eq!(at(36.0, 20.0), Hit::Caption);
        assert_eq!(at(80.0, 20.0), Hit::Caption);
        assert_eq!(at(1000.0, 39.0), Hit::Caption);
        // Buttons, 46 px each from the right edge.
        assert_eq!(at(1263.0, 20.0), Hit::Button(Button::Close));
        assert_eq!(at(1264.0 - 46.0, 20.0), Hit::Button(Button::Close));
        assert_eq!(at(1264.0 - 46.5, 20.0), Hit::Button(Button::Maximize));
        assert_eq!(at(1264.0 - 92.0, 20.0), Hit::Button(Button::Maximize));
        assert_eq!(at(1264.0 - 92.5, 20.0), Hit::Button(Button::Minimize));
        assert_eq!(at(1264.0 - 138.0, 20.0), Hit::Button(Button::Minimize));
        assert_eq!(at(1264.0 - 138.5, 20.0), Hit::Caption);
        assert_eq!(at(1264.0 - 69.0, 39.9), Hit::Button(Button::Maximize));
        // Below the bar is the app.
        assert_eq!(at(600.0, 40.0), Hit::Client);
        assert_eq!(at(1263.0, 40.0), Hit::Client);
        assert_eq!(at(10.0, 500.0), Hit::Client);
    }

    #[test]
    fn hit_test_zoomed_and_scaled() {
        // Zoom +1 (48 DIP bar, 55 DIP buttons) on a 150% display.
        let f = frame(1500.0, 1.5, 1.0, false);
        let at = |x, y| hit_test(x, y, &f);
        assert_eq!(at(600.0, 11.9), Hit::Top, "band is 12 px at 150%");
        assert_eq!(at(600.0, 12.0), Hit::Caption);
        assert_eq!(at(600.0, 71.9), Hit::Caption);
        assert_eq!(at(600.0, 72.0), Hit::Client, "48 DIP × 1.5");
        assert_eq!(at(1500.0 - 82.5, 30.0), Hit::Button(Button::Close));
        assert_eq!(at(1500.0 - 83.0, 30.0), Hit::Button(Button::Maximize));
        assert_eq!(at(1500.0 - 165.0, 30.0), Hit::Button(Button::Maximize));
        assert_eq!(at(1500.0 - 166.0, 30.0), Hit::Button(Button::Minimize));
        assert_eq!(at(1500.0 - 247.5, 30.0), Hit::Button(Button::Minimize));
        assert_eq!(at(1500.0 - 248.0, 30.0), Hit::Caption);
        // Zoomed out: a 33 DIP bar.
        let small = frame(1264.0, 1.0, -1.0, false);
        assert_eq!(hit_test(600.0, 32.9, &small), Hit::Caption);
        assert_eq!(hit_test(600.0, 33.0, &small), Hit::Client);
        assert_eq!(hit_test(1264.0 - 38.0, 20.0, &small), Hit::Button(Button::Close), "46/1.2 = 38");
        assert_eq!(hit_test(1264.0 - 39.0, 20.0, &small), Hit::Button(Button::Maximize));
    }

    #[test]
    fn maximized_has_no_top_band() {
        let f = frame(1920.0, 1.0, 0.0, true);
        assert_eq!(hit_test(600.0, 0.0, &f), Hit::Caption);
        assert_eq!(hit_test(0.0, 0.0, &f), Hit::Caption);
        assert_eq!(hit_test(1919.0, 0.0, &f), Hit::Button(Button::Close), "the corner closes, as Windows' own");
        assert_eq!(hit_test(1920.0 - 50.0, 2.0, &f), Hit::Button(Button::Maximize));
    }

    #[test]
    fn codes_are_winuser_h() {
        assert_eq!(Hit::Client.code(), 1);
        assert_eq!(Hit::Caption.code(), 2);
        assert_eq!(Hit::Button(Button::Minimize).code(), 8);
        assert_eq!(Hit::Button(Button::Maximize).code(), 9);
        assert_eq!(Hit::Top.code(), 12);
        assert_eq!(Hit::TopLeft.code(), 13);
        assert_eq!(Hit::TopRight.code(), 14);
        assert_eq!(Hit::Button(Button::Close).code(), 20);
        for b in Button::ALL {
            assert_eq!(Button::from_code(Hit::Button(b).code()), Some(b));
        }
        assert_eq!(Button::from_code(HTCAPTION), None);
        assert_eq!(Button::from_code(HTCLIENT), None);
        #[cfg(windows)]
        {
            use windows::Win32::UI::WindowsAndMessaging as w;
            assert_eq!(
                [HTCLIENT, HTCAPTION, HTMINBUTTON, HTMAXBUTTON, HTTOP, HTTOPLEFT, HTTOPRIGHT, HTCLOSE],
                [
                    w::HTCLIENT,
                    w::HTCAPTION,
                    w::HTMINBUTTON,
                    w::HTMAXBUTTON,
                    w::HTTOP,
                    w::HTTOPLEFT,
                    w::HTTOPRIGHT,
                    w::HTCLOSE
                ]
            );
        }
    }

    #[test]
    fn client_edges_drop_only_the_caption() {
        // A 1280x860 window at (100, 50), 96 dpi: the standard frame takes
        // 8 px off the left, right and bottom and 31 px off the top.
        let standard = Edges { left: 108, top: 81, right: 1372, bottom: 902 };
        let r = client_edges(50, standard, false, 8, None);
        assert_eq!(r, Edges { left: 108, top: 50, right: 1372, bottom: 902 });
        // Maximized on a 1920x1040 work area, the window hangs 8 px past
        // every edge; the client area starts at the screen's top.
        let max = Edges { left: 0, top: 23, right: 1920, bottom: 1040 };
        assert_eq!(client_edges(-8, max, true, 8, None), Edges { left: 0, top: 0, right: 1920, bottom: 1040 });
        // An auto-hide taskbar keeps a sliver of its edge.
        let bottom = client_edges(-8, Edges { bottom: 1080, ..max }, true, 8, Some(Side::Bottom));
        assert_eq!(bottom.bottom, 1078);
        assert_eq!(client_edges(-8, max, true, 8, Some(Side::Top)).top, 2);
        assert_eq!(client_edges(-8, max, true, 8, Some(Side::Left)).left, 2);
        assert_eq!(client_edges(-8, max, true, 8, Some(Side::Right)).right, 1918);
        // Restored windows never keep a gap.
        assert_eq!(client_edges(50, standard, false, 8, Some(Side::Bottom)), r);
    }

    #[test]
    fn base64_matches_rfc_4648() {
        for (raw, enc) in [
            ("", ""),
            ("f", "Zg=="),
            ("fo", "Zm8="),
            ("foo", "Zm9v"),
            ("foob", "Zm9vYg=="),
            ("fooba", "Zm9vYmE="),
            ("foobar", "Zm9vYmFy"),
        ] {
            assert_eq!(base64(raw.as_bytes()), enc);
        }
        assert_eq!(base64(&[0xff, 0xfe, 0xfd]), "//79");
    }

    fn decode_png(bytes: &[u8]) -> (u32, u32, Vec<u8>) {
        let mut decoder = png::Decoder::new(std::io::Cursor::new(bytes));
        decoder.set_transformations(png::Transformations::EXPAND);
        let mut reader = decoder.read_info().unwrap();
        let mut buf = vec![0; reader.output_buffer_size().unwrap()];
        let info = reader.next_frame(&mut buf).unwrap();
        assert_eq!(info.color_type, png::ColorType::Rgba);
        buf.truncate(info.buffer_size());
        (info.width, info.height, buf)
    }

    /// The bundled 64 px logo is 3.x's 512 px `logo.png`, box-filtered
    /// (premultiplied, 8x8 to 1).
    #[test]
    fn logo_asset_is_3x_logo() {
        let original =
            std::fs::read(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../frontend/public/logo.png"))
                .expect("frontend/public/logo.png");
        let (w, h, big) = decode_png(&original);
        assert_eq!((w, h), (512, 512));
        let (sw, sh, small) = decode_png(LOGO_PNG);
        assert_eq!((sw, sh), (64, 64));
        let mut worst = 0.0f64;
        for y in 0..64 {
            for x in 0..64 {
                let mut acc = [0.0f64; 4];
                for yy in 0..8 {
                    for xx in 0..8 {
                        let i = (((y * 8 + yy) * 512 + x * 8 + xx) * 4) as usize;
                        let a = f64::from(big[i + 3]) / 255.0;
                        for k in 0..3 {
                            acc[k] += f64::from(big[i + k]) * a;
                        }
                        acc[3] += a;
                    }
                }
                let i = ((y * 64 + x) * 4) as usize;
                let alpha = acc[3] / 64.0;
                // Premultiplied comparison: colour where it shows.
                for k in 0..3 {
                    let want = acc[k] / 64.0;
                    let got = f64::from(small[i + k]) * f64::from(small[i + 3]) / 255.0;
                    worst = worst.max((want - got).abs());
                }
                worst = worst.max((alpha * 255.0 - f64::from(small[i + 3])).abs());
            }
        }
        assert!(worst <= 2.0, "the bundled logo differs from 3.x's by up to {worst}");
        assert!(logo_svg().contains("data:image/png;base64,iVBORw0KGgo"));
    }

    #[test]
    fn buttons_rest_on_the_bar_and_light_up_like_windows() {
        for dark in [true, false] {
            let p = crate::theme::palette(dark);
            let mut bar = Bar { palette: p, dark, zoom_level: 0.0, hover: None, pressed: None, maximized: false };
            for b in Button::ALL {
                // 3.x: overlay colour is --bg-base, symbolColor --text-secondary.
                assert_eq!(button_colors(&bar, b), (p.bg_base, p.text_secondary));
            }
            bar.hover = Some(Button::Close);
            assert_eq!(button_colors(&bar, Button::Close), (CLOSE_RED, Color::WHITE));
            assert_eq!(button_colors(&bar, Button::Minimize), (p.bg_base, p.text_secondary), "only the hovered one");
            bar.hover = Some(Button::Maximize);
            let (bg, ink) = button_colors(&bar, Button::Maximize);
            assert_ne!(bg, p.bg_base);
            assert_eq!(ink, p.text_secondary);
            // Neutral: no hue of its own.
            assert!((bg.r - bg.g).abs() < 0.02 || !dark);
            bar.pressed = Some(Button::Maximize);
            assert_ne!(button_colors(&bar, Button::Maximize).0, bg, "pressed differs from hover");
        }
        // OVERLAY_COLORS in electron/main.cjs.
        let hex = |c: Color| {
            let [r, g, b, _] = c.into_rgba8();
            format!("#{r:02x}{g:02x}{b:02x}")
        };
        assert_eq!(
            (hex(crate::theme::palette(true).bg_base), hex(crate::theme::palette(true).text_secondary)),
            ("#09090b".into(), "#a1a1aa".into())
        );
        assert_eq!(
            (hex(crate::theme::palette(false).bg_base), hex(crate::theme::palette(false).text_secondary)),
            ("#f7f6f4".into(), "#57534e".into())
        );
    }

    #[test]
    fn logo_centre_lines_up_with_the_rail_icons() {
        assert_eq!(LEFT_PAD + LOGO_SIZE / 2.0, 36.0);
    }
}
