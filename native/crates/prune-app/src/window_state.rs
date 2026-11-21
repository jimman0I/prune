//! `window-state.json`, shared with 3.x: where the window was, whether it
//! was maximized, and the text zoom.
//!
//! 3.x (`electron/main.cjs`, `electron/windowState.cjs`) writes
//! `{ x, y, width, height, isMaximized, zoomLevel }` beside `settings.json`
//! in `%APPDATA%\Prune`: bounds are the outer window rectangle in
//! device-independent pixels, as Electron's `getBounds()` gives them, and
//! `zoomLevel` is a Chromium zoom level (see [`crate::zoom`]). 4.0 reads
//! and writes the same file in the same shape so either version can open
//! where the other closed.
//!
//! Reading is best effort, as in 3.x: a missing or corrupt file means
//! "nothing saved". Writing goes to a temp file renamed over the real one,
//! so a crash mid-write never leaves half a file.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

/// 3.x's `defaultBounds`.
pub const DEFAULT_WIDTH: f64 = 1280.0;
pub const DEFAULT_HEIGHT: f64 = 860.0;
/// 3.x's `minWidth` / `minHeight`.
pub const MIN_WIDTH: f32 = 900.0;
pub const MIN_HEIGHT: f32 = 560.0;

/// How long resizes and moves settle before a save (3.x: 500 ms).
pub const SAVE_DEBOUNCE: std::time::Duration = std::time::Duration::from_millis(500);

/// A rectangle in device-independent pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    /// 3.x's `isOnAnyDisplay` test for one display: inclusive on the low
    /// edge, exclusive on the high one.
    fn contains_origin_of(&self, bounds: &Rect) -> bool {
        bounds.x >= self.x && bounds.x < self.x + self.width && bounds.y >= self.y && bounds.y < self.y + self.height
    }
}

/// Where to open the window.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Resolved {
    /// The saved bounds, or `None` for the default size centred (3.x passes
    /// `x: undefined, y: undefined`).
    pub bounds: Option<Rect>,
    pub width: f64,
    pub height: f64,
    pub is_maximized: bool,
}

/// The saved bounds when all four are numbers (3.x's `isValidSavedState`).
fn saved_bounds(saved: &Value) -> Option<Rect> {
    let o = saved.as_object()?;
    let n = |k: &str| o.get(k).and_then(Value::as_f64);
    Some(Rect { x: n("x")?, y: n("y")?, width: n("width")?, height: n("height")? })
}

/// 3.x's `resolveWindowState`: the saved bounds if they are valid and their
/// top-left corner is still on a connected display's work area, else the
/// default size, centred, not maximized. A laptop undocked since the last
/// save is the case this exists for.
pub fn resolve_window_state(saved: Option<&Value>, displays: &[Rect]) -> Resolved {
    if let Some(bounds) = saved.and_then(saved_bounds)
        && displays.iter().any(|d| d.contains_origin_of(&bounds))
    {
        let is_maximized = saved.and_then(|s| s.get("isMaximized")) == Some(&Value::Bool(true));
        return Resolved { bounds: Some(bounds), width: bounds.width, height: bounds.height, is_maximized };
    }
    Resolved { bounds: None, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, is_maximized: false }
}

/// `resolved` with its size raised to at least 3.x's 900x560 minimum.
pub fn at_least_minimum(resolved: Resolved) -> Resolved {
    let width = resolved.width.max(f64::from(MIN_WIDTH));
    let height = resolved.height.max(f64::from(MIN_HEIGHT));
    Resolved {
        bounds: resolved.bounds.map(|b| Rect {
            width: b.width.max(f64::from(MIN_WIDTH)),
            height: b.height.max(f64::from(MIN_HEIGHT)),
            ..b
        }),
        width,
        height,
        ..resolved
    }
}

/// The default window on a display whose work area is `work` (DIP):
/// `width` x `height`, shrunk to fit the work area, centred in it. 3.x got
/// this from Electron, which centres a window that has no saved position
/// and fits it to the work area (Chromium's `AdjustToFit`), so the caption
/// stays on screen on a 1366x768 display or a 1080p one at 150 %.
pub fn centred_in(work: &Rect, width: f64, height: f64) -> Rect {
    let (w, h) = (width.min(work.width), height.min(work.height));
    Rect { x: work.x + (work.width - w) / 2.0, y: work.y + (work.height - h) / 2.0, width: w, height: h }
}

/// The outer minimum on a display whose work area is `work` (DIP): 3.x's
/// 900x560, or the work area where that is smaller, so the minimum never
/// pushes the window off a small display.
pub fn minimum_on(work: &Rect) -> (f64, f64) {
    (f64::from(MIN_WIDTH).min(work.width), f64::from(MIN_HEIGHT).min(work.height))
}

/// What gets written.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WindowState {
    pub bounds: Rect,
    pub is_maximized: bool,
    pub zoom_level: f64,
}

/// A JSON number the way `JSON.stringify` writes it: whole numbers
/// without a fraction, so 3.x reads back `1`, not `1.0`.
fn js_number(v: f64) -> Value {
    if v.is_finite() && v.fract() == 0.0 && v.abs() < 9.0e15 {
        Value::from(v as i64)
    } else {
        serde_json::Number::from_f64(v).map_or(Value::from(0), Value::Number)
    }
}

impl WindowState {
    /// `{ ...win.getBounds(), isMaximized, zoomLevel }`: Electron's bounds
    /// are whole pixels, so they are rounded here.
    pub fn to_json(&self) -> String {
        let mut m = Map::new();
        m.insert("x".into(), js_number(self.bounds.x.round()));
        m.insert("y".into(), js_number(self.bounds.y.round()));
        m.insert("width".into(), js_number(self.bounds.width.round()));
        m.insert("height".into(), js_number(self.bounds.height.round()));
        m.insert("isMaximized".into(), Value::Bool(self.is_maximized));
        m.insert("zoomLevel".into(), js_number(self.zoom_level));
        Value::Object(m).to_string()
    }
}

/// `window-state.json` beside the settings file, so `UNREVO_SETTINGS_PATH`
/// moves both (3.x has no override of its own for this file).
pub fn path() -> PathBuf {
    let settings = prune_core::settings::settings_path();
    settings.parent().map_or_else(|| PathBuf::from("window-state.json"), |dir| dir.join("window-state.json"))
}

/// The parsed file, or `None` when it is missing or not JSON.
pub fn load(path: &Path) -> Option<Value> {
    fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok())
}

pub fn save(path: &Path, state: &WindowState) -> io::Result<()> {
    if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
        fs::create_dir_all(dir)?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(format!(".{}.tmp", std::process::id()));
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, state.to_json())?;
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// Placing and reading the real window, in physical pixels per monitor.
#[cfg(windows)]
pub mod win32 {
    use super::{Rect, Resolved};
    use windows::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromPoint,
        MonitorFromWindow,
    };
    use windows::Win32::UI::HiDpi::{GetDpiForMonitor, GetDpiForWindow, MDT_EFFECTIVE_DPI};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowPlacement, GetWindowRect, IsIconic, IsZoomed, MONITORINFOF_PRIMARY, SWP_NOACTIVATE, SWP_NOZORDER,
        SetWindowPos, WINDOWPLACEMENT, WPF_RESTORETOMAXIMIZED,
    };
    use windows::core::BOOL;

    /// One monitor: its work area in physical pixels and its scale.
    #[derive(Debug, Clone, Copy)]
    pub struct Display {
        pub work: RECT,
        pub monitor: RECT,
        pub scale: f64,
        pub primary: bool,
    }

    impl Display {
        /// The work area in DIP, as Electron's `display.workArea`.
        pub fn work_dip(&self) -> Rect {
            Rect {
                x: f64::from(self.work.left) / self.scale,
                y: f64::from(self.work.top) / self.scale,
                width: f64::from(self.work.right - self.work.left) / self.scale,
                height: f64::from(self.work.bottom - self.work.top) / self.scale,
            }
        }
    }

    fn monitor_scale(monitor: HMONITOR) -> f64 {
        let (mut x, mut y) = (96u32, 96u32);
        // SAFETY: out-pointers to locals.
        let ok = unsafe { GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut x, &mut y) }.is_ok();
        if ok && x > 0 { f64::from(x) / 96.0 } else { 1.0 }
    }

    fn display_of(monitor: HMONITOR) -> Option<Display> {
        let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
        // SAFETY: `info` is sized and outlives the call.
        unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool().then(|| Display {
            work: info.rcWork,
            monitor: info.rcMonitor,
            scale: monitor_scale(monitor),
            primary: info.dwFlags & MONITORINFOF_PRIMARY != 0,
        })
    }

    pub fn displays() -> Vec<Display> {
        unsafe extern "system" fn each(monitor: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
            // SAFETY: `data` is the `&mut Vec` passed below, alive for the call.
            let list = unsafe { &mut *(data.0 as *mut Vec<Display>) };
            if let Some(d) = display_of(monitor) {
                list.push(d);
            }
            true.into()
        }
        let mut list: Vec<Display> = Vec::new();
        // SAFETY: the callback only touches `list`, which outlives the call.
        let _ = unsafe { EnumDisplayMonitors(None, None, Some(each), LPARAM(&mut list as *mut _ as isize)) };
        list
    }

    /// Moves and sizes the (still hidden) window to where `resolved` says,
    /// as an outer rectangle like Electron's bounds.
    pub fn place(hwnd: HWND, resolved: &Resolved, displays: &[Display]) {
        // A hand-edited or 3.x-era file can hold any size; never open below
        // the 900x560 minimum.
        let resolved = &super::at_least_minimum(*resolved);
        let target = match resolved.bounds {
            Some(b) => displays
                .iter()
                .find(|d| {
                    let w = d.work_dip();
                    b.x >= w.x && b.x < w.x + w.width && b.y >= w.y && b.y < w.y + w.height
                })
                .map(|d| {
                    let s = d.scale;
                    (b.x * s, b.y * s, b.width * s, b.height * s)
                }),
            None => displays.iter().find(|d| d.primary).or(displays.first()).map(|d| {
                let s = d.scale;
                let r = super::centred_in(&d.work_dip(), resolved.width, resolved.height);
                (r.x * s, r.y * s, r.width * s, r.height * s)
            }),
        };
        let Some((x, y, w, h)) = target else { return };
        let (x, y, w, h) = (x.round() as i32, y.round() as i32, w.round() as i32, h.round() as i32);
        // SAFETY: `hwnd` is this process's live window.
        let before = unsafe { GetDpiForWindow(hwnd) };
        let flags = SWP_NOZORDER | SWP_NOACTIVATE;
        // SAFETY: as above.
        let _ = unsafe { SetWindowPos(hwnd, None, x, y, w, h, flags) };
        // Landing on a monitor of another DPI resizes the window to the
        // system's suggestion; set the exact rectangle once more.
        // SAFETY: as above.
        if unsafe { GetDpiForWindow(hwnd) } != before {
            let _ = unsafe { SetWindowPos(hwnd, None, x, y, w, h, flags) };
        }
    }

    /// The work area (DIP) of the monitor the window is on.
    pub fn work_of(hwnd: HWND) -> Option<Rect> {
        // SAFETY: `hwnd` is this process's live window.
        display_of(unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) }).map(|d| d.work_dip())
    }

    /// The window's restored bounds in DIP and whether it is maximized, or
    /// `None` if they cannot be read.
    pub fn read(hwnd: HWND) -> Option<(Rect, bool)> {
        // SAFETY: `hwnd` is this process's live window; out-pointers are locals.
        unsafe {
            let iconic = IsIconic(hwnd).as_bool();
            let zoomed = IsZoomed(hwnd).as_bool();
            let mut placement = WINDOWPLACEMENT { length: size_of::<WINDOWPLACEMENT>() as u32, ..Default::default() };
            GetWindowPlacement(hwnd, &mut placement).ok()?;
            let maximized = if iconic { placement.flags.contains(WPF_RESTORETOMAXIMIZED) } else { zoomed };
            let rect = if iconic || zoomed {
                // The restored rectangle is in workspace coordinates, which
                // are offset from screen ones by the window's monitor's
                // work area (a taskbar on the left or top). The monitor is
                // the window's own: maximized there, or, when minimized,
                // where it will restore to (MonitorFromWindow's rule for an
                // iconic window), so no lookup by a workspace point is needed.
                let r = placement.rcNormalPosition;
                let d = display_of(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST))?;
                let (dx, dy) = (d.work.left - d.monitor.left, d.work.top - d.monitor.top);
                RECT { left: r.left + dx, top: r.top + dy, right: r.right + dx, bottom: r.bottom + dy }
            } else {
                let mut r = RECT::default();
                GetWindowRect(hwnd, &mut r).ok()?;
                r
            };
            let d = display_of(MonitorFromPoint(POINT { x: rect.left, y: rect.top }, MONITOR_DEFAULTTONEAREST))?;
            let s = d.scale;
            Some((
                Rect {
                    x: f64::from(rect.left) / s,
                    y: f64::from(rect.top) / s,
                    width: f64::from(rect.right - rect.left) / s,
                    height: f64::from(rect.bottom - rect.top) / s,
                },
                maximized,
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ONE_DISPLAY: [Rect; 1] = [Rect { x: 0.0, y: 0.0, width: 1920.0, height: 1080.0 }];
    const DEFAULT: Resolved = Resolved { bounds: None, width: 1280.0, height: 860.0, is_maximized: false };

    fn rect(x: f64, y: f64, width: f64, height: f64) -> Rect {
        Rect { x, y, width, height }
    }

    /// electron/windowState.test.cjs, case for case.
    #[test]
    fn resolve_matches_3x() {
        // the default with isMaximized false when nothing was saved
        assert_eq!(resolve_window_state(None, &ONE_DISPLAY), DEFAULT);
        // the saved bounds when the saved position is still on a display
        let saved = json!({ "width": 1000, "height": 700, "x": 100, "y": 100, "isMaximized": false });
        assert_eq!(
            resolve_window_state(Some(&saved), &ONE_DISPLAY),
            Resolved {
                bounds: Some(rect(100.0, 100.0, 1000.0, 700.0)),
                width: 1000.0,
                height: 700.0,
                is_maximized: false
            }
        );
        // the default when the saved position is on no connected display
        let gone = json!({ "width": 1000, "height": 700, "x": 2200, "y": 100, "isMaximized": false });
        assert_eq!(resolve_window_state(Some(&gone), &ONE_DISPLAY), DEFAULT);
        // the boundary is inclusive on the low edge, exclusive on the high
        let inside = json!({ "width": 1000, "height": 700, "x": 1919, "y": 1079, "isMaximized": false });
        assert_eq!(resolve_window_state(Some(&inside), &ONE_DISPLAY).bounds, Some(rect(1919.0, 1079.0, 1000.0, 700.0)));
        let outside = json!({ "width": 1000, "height": 700, "x": 1920, "y": 100, "isMaximized": false });
        assert_eq!(resolve_window_state(Some(&outside), &ONE_DISPLAY), DEFAULT);
        // keeps a real isMaximized true
        let max = json!({ "width": 1000, "height": 700, "x": 100, "y": 100, "isMaximized": true });
        assert!(resolve_window_state(Some(&max), &ONE_DISPLAY).is_maximized);
        // treats a malformed saved value as absent
        for junk in [
            json!({}),
            json!({ "width": "nope" }),
            json!({ "width": 1000, "height": 700 }),
            json!("not an object"),
            json!(null),
        ] {
            assert_eq!(resolve_window_state(Some(&junk), &ONE_DISPLAY), DEFAULT, "{junk}");
        }
        // a second display to the right counts
        let two = [ONE_DISPLAY[0], rect(1920.0, 0.0, 1280.0, 1024.0)];
        assert!(resolve_window_state(Some(&gone), &two).bounds.is_some());
    }

    #[test]
    fn tiny_saved_sizes_open_at_the_minimum() {
        let saved = json!({ "width": 10, "height": -5, "x": 100, "y": 100, "isMaximized": false });
        let resolved = at_least_minimum(resolve_window_state(Some(&saved), &ONE_DISPLAY));
        assert_eq!(resolved.bounds, Some(rect(100.0, 100.0, 900.0, 560.0)));
        assert_eq!((resolved.width, resolved.height), (900.0, 560.0));
        let big = at_least_minimum(DEFAULT);
        assert_eq!(big, DEFAULT, "the default is already above the minimum");
    }

    #[test]
    fn the_default_window_fits_the_work_area_and_is_centred() {
        // 1080p at 100 % with a 40 px taskbar: room enough, centred.
        assert_eq!(centred_in(&rect(0.0, 0.0, 1920.0, 1040.0), 1280.0, 860.0), rect(320.0, 90.0, 1280.0, 860.0));
        // 1366x768: as tall as the work area, caption at its top edge.
        assert_eq!(centred_in(&rect(0.0, 0.0, 1366.0, 728.0), 1280.0, 860.0), rect(43.0, 0.0, 1280.0, 728.0));
        // 1080p at 150 % (1280x688 DIP of work area): fills it.
        assert_eq!(centred_in(&rect(0.0, 0.0, 1280.0, 688.0), 1280.0, 860.0), rect(0.0, 0.0, 1280.0, 688.0));
        // A work area that does not start at 0 (taskbar on the left or top).
        assert_eq!(centred_in(&rect(60.0, 40.0, 1024.0, 728.0), 1280.0, 860.0), rect(60.0, 40.0, 1024.0, 728.0));
        // Below the 900x560 minimum, fit wins: the frame stays on screen.
        let small = rect(0.0, 0.0, 800.0, 560.0);
        assert_eq!(centred_in(&small, 900.0, 560.0), small);
    }

    #[test]
    fn the_minimum_shrinks_only_for_a_smaller_work_area() {
        assert_eq!(minimum_on(&rect(0.0, 0.0, 1366.0, 728.0)), (900.0, 560.0));
        assert_eq!(minimum_on(&rect(0.0, 0.0, 800.0, 560.0)), (800.0, 560.0));
        assert_eq!(minimum_on(&rect(0.0, 0.0, 1024.0, 500.0)), (900.0, 500.0));
    }

    #[test]
    fn writes_3x_shape_and_round_trips() {
        let dir = std::env::temp_dir().join(format!("prune-window-state-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let path = dir.join("window-state.json");
        assert_eq!(load(&path), None, "nothing written yet");

        let state = WindowState { bounds: rect(50.0, 50.4, 1400.0, 900.0), is_maximized: false, zoom_level: 1.0 };
        save(&path, &state).unwrap();
        let text = fs::read_to_string(&path).unwrap();
        assert_eq!(text, r#"{"x":50,"y":50,"width":1400,"height":900,"isMaximized":false,"zoomLevel":1}"#);
        let half = WindowState { zoom_level: -0.5, ..state };
        save(&path, &half).unwrap();
        assert_eq!(load(&path).unwrap()["zoomLevel"], json!(-0.5));
        let leftovers: Vec<_> = fs::read_dir(&dir).unwrap().filter_map(Result::ok).map(|e| e.file_name()).collect();
        assert_eq!(leftovers.len(), 1, "no temp file left behind: {leftovers:?}");

        fs::write(&path, "not valid json{{{").unwrap();
        assert_eq!(load(&path), None, "a corrupt file is nothing saved");
        let _ = fs::remove_dir_all(&dir);
    }
}
