//! `Prune.exe --render-screens <dir>`: every screen as a PNG, so the UI can
//! be checked without a person at the keyboard.
//!
//! No window is made. The view is laid out and drawn by iced's tiny-skia
//! renderer straight into a pixel buffer (the same code path a window's
//! `screenshot` uses), so nothing flashes on screen, no GPU or display is
//! needed, and it can run while the real Prune is open: it takes neither the
//! single-instance mutex nor `window-state.json` nor `settings.json`. It
//! starts from default settings plus the flags.

use std::borrow::Cow;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Once;

use iced::advanced::graphics::Viewport;
use iced::advanced::graphics::text::font_system;
use iced::advanced::layout::{Layout, Limits};
use iced::advanced::renderer;
use iced::advanced::widget::Tree;
use iced::{Pixels, Size, mouse};
use iced_tiny_skia::window::compositor::screenshot;

use prune_core::settings::{Settings, ThemeChoice};

use crate::app::{App, Message, Startup};
use crate::screen::{self, Screen};
use crate::theme;
use crate::window_state::{DEFAULT_HEIGHT, DEFAULT_WIDTH};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RailMode {
    Collapsed,
    Expanded,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Options {
    pub theme: ThemeChoice,
    pub lang: String,
    pub scale: f32,
    pub rail: RailMode,
}

impl Default for Options {
    fn default() -> Self {
        Options { theme: ThemeChoice::Dark, lang: "en".into(), scale: 1.0, rail: RailMode::Collapsed }
    }
}

/// Straight RGBA, row by row.
#[derive(Debug, Clone)]
pub struct Image {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

fn theme_name(t: ThemeChoice) -> &'static str {
    match t {
        ThemeChoice::Light => "light",
        _ => "dark",
    }
}

/// `<screen>-<theme>-<lang>-<scale>.png`.
pub fn file_name(screen: Screen, o: &Options) -> String {
    format!("{}-{}-{}-{}.png", screen.key(), theme_name(o.theme), o.lang, o.scale)
}

fn register_fonts() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        if let Ok(mut fonts) = font_system().write() {
            for bytes in theme::font_bytes() {
                fonts.load_font(Cow::Borrowed(bytes));
            }
        }
    });
}

/// The client area of the default window at `scale`, in physical pixels:
/// the 1280x860 DIP window (3.x's bounds, and so the app's, are the outer
/// rectangle) less the frame Windows draws around it at that DPI. That is
/// the size the real window's content has on a display with room for the
/// default (on a smaller one the window is fitted to the work area, see
/// [`crate::window_state::centred_in`]). Off Windows there is no frame to
/// take off, so the render is the outer size.
pub fn default_client_px(scale: f32) -> Size<u32> {
    #[cfg(windows)]
    let (fw, fh) = crate::window_state::win32::frame_px((96.0 * scale).round() as u32);
    #[cfg(not(windows))]
    let (fw, fh) = (0, 0);
    let outer = |dip: f64| (dip * f64::from(scale)).round() as u32;
    Size::new(outer(DEFAULT_WIDTH).saturating_sub(fw), outer(DEFAULT_HEIGHT).saturating_sub(fh))
}

/// One screen, drawn at the default window's client size (see
/// [`default_client_px`]) at the scale.
pub fn render_screen(screen: Screen, o: &Options) -> Image {
    register_fonts();
    let mut settings = Settings::default();
    settings.theme = if o.theme == ThemeChoice::Light { ThemeChoice::Light } else { ThemeChoice::Dark };
    settings.theme_synced = true;
    settings.language = o.lang.clone();
    // Reduced motion makes every transition land at once.
    let mut app = App::new(Startup { settings, reduced_motion: true, ..Startup::default() });
    let _ = app.update(Message::Navigate(screen));
    if o.rail == RailMode::Expanded {
        let _ = app.update(Message::RailHover(true));
    }

    let physical = default_client_px(o.scale);
    let viewport = Viewport::with_physical_size(physical, o.scale);
    let logical = viewport.logical_size();

    let mut ui = iced_tiny_skia::Renderer::new(screen::geist(iced::font::Weight::Normal), Pixels(16.0));
    let mut element = app.view();
    let mut tree = Tree::new(element.as_widget());
    let node = element.as_widget_mut().layout(&mut tree, &ui, &Limits::new(Size::ZERO, logical));
    let style = renderer::Style { text_color: app.palette().text_primary };
    let iced_theme = if app.is_dark() { iced::Theme::Dark } else { iced::Theme::Light };
    element.as_widget().draw(
        &tree,
        &mut ui,
        &iced_theme,
        &style,
        Layout::new(&node),
        mouse::Cursor::Unavailable,
        &iced::Rectangle::with_size(logical),
    );
    let rgba = screenshot(&mut ui, &viewport, app.palette().bg_base);
    Image { width: physical.width, height: physical.height, rgba }
}

pub fn write_png(path: &Path, img: &Image) -> io::Result<()> {
    let file = io::BufWriter::new(fs::File::create(path)?);
    let mut encoder = png::Encoder::new(file, img.width, img.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(io::Error::other)?;
    writer.write_image_data(&img.rgba).map_err(io::Error::other)?;
    writer.finish().map_err(io::Error::other)
}

/// All eight screens into `dir` (made if missing), in rail order; returns
/// the files written.
pub fn render_screens(dir: &Path, o: &Options) -> io::Result<Vec<PathBuf>> {
    fs::create_dir_all(dir)?;
    Screen::ORDER
        .iter()
        .map(|&s| {
            let path = dir.join(file_name(s, o));
            write_png(&path, &render_screen(s, o))?;
            Ok(path)
        })
        .collect()
}

const USAGE: &str = "usage: Prune --render-screens <dir> [--theme dark|light] [--lang <code>] [--scale <f32>] [--rail expanded|collapsed]";

/// `None` when the command line is not asking for a render; otherwise the
/// directory and options, or what is wrong with them.
pub fn parse_args(args: &[String]) -> Option<Result<(PathBuf, Options), String>> {
    let at = args.iter().position(|a| a == "--render-screens")?;
    Some(parse(&args[at + 1..]))
}

fn parse(rest: &[String]) -> Result<(PathBuf, Options), String> {
    let mut it = rest.iter();
    let dir = it.next().filter(|d| !d.starts_with("--")).ok_or(USAGE)?;
    let mut o = Options::default();
    while let Some(flag) = it.next() {
        let value = it.next().ok_or_else(|| format!("{flag} needs a value. {USAGE}"))?;
        match flag.as_str() {
            "--theme" => {
                o.theme = match value.as_str() {
                    "dark" => ThemeChoice::Dark,
                    "light" => ThemeChoice::Light,
                    v => return Err(format!("--theme is dark or light, not {v}")),
                }
            }
            "--lang" => {
                if !prune_core::settings::LANGUAGES.contains(&value.as_str()) {
                    return Err(format!("--lang {value} is not one of the app's languages"));
                }
                o.lang = value.clone();
            }
            "--scale" => {
                o.scale = value
                    .parse::<f32>()
                    .ok()
                    .filter(|s| s.is_finite() && (0.25..=4.0).contains(s))
                    .ok_or_else(|| format!("--scale is a number from 0.25 to 4, not {value}"))?;
            }
            "--rail" => {
                o.rail = match value.as_str() {
                    "expanded" => RailMode::Expanded,
                    "collapsed" => RailMode::Collapsed,
                    v => return Err(format!("--rail is expanded or collapsed, not {v}")),
                }
            }
            other => return Err(format!("unknown option {other}. {USAGE}")),
        }
    }
    Ok((PathBuf::from(dir), o))
}

/// The whole mode, for `main`: returns the process's exit code.
pub fn run(dir: &Path, o: &Options) -> i32 {
    match render_screens(dir, o) {
        Ok(files) => {
            for f in &files {
                println!("{}", f.display());
            }
            0
        }
        Err(e) => {
            eprintln!("render failed: {e}");
            1
        }
    }
}

/// A release build is a GUI program with no console, so `println!` goes
/// nowhere. Attach to the calling shell's console and, for each of stdout
/// and stderr that is not already redirected, point it there. Without a
/// parent console (double-click) this does nothing.
#[cfg(windows)]
pub fn attach_console() {
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::Console::{
        ATTACH_PARENT_PROCESS, AttachConsole, GetStdHandle, STD_ERROR_HANDLE, STD_OUTPUT_HANDLE, SetStdHandle,
    };
    // SAFETY: plain Win32 console calls; the handle is leaked on purpose so
    // it stays valid for the life of the process.
    unsafe {
        if AttachConsole(ATTACH_PARENT_PROCESS).is_err() {
            return;
        }
        let Ok(out) = fs::OpenOptions::new().write(true).open("CONOUT$") else { return };
        let raw = HANDLE(out.as_raw_handle());
        std::mem::forget(out);
        for which in [STD_OUTPUT_HANDLE, STD_ERROR_HANDLE] {
            let current = GetStdHandle(which).unwrap_or_default();
            if current.is_invalid() || current.0.is_null() {
                let _ = SetStdHandle(which, raw);
            }
        }
    }
}

#[cfg(not(windows))]
pub fn attach_console() {}
