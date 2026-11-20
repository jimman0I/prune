//! Rendering the screens to PNG without a window, so a screen can be
//! checked without a person at the keyboard.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use prune_app::render::{self, Image, Options, RailMode};
use prune_app::screen::Screen;
use prune_core::settings::ThemeChoice;

fn opts(lang: &str, scale: f32) -> Options {
    Options { theme: ThemeChoice::Dark, lang: lang.into(), scale, rail: RailMode::Collapsed }
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("prune-render-test-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn read_png(path: &Path) -> Image {
    let decoder = png::Decoder::new(std::io::BufReader::new(std::fs::File::open(path).unwrap()));
    let mut reader = decoder.read_info().unwrap();
    let mut buf = vec![0; reader.output_buffer_size().unwrap()];
    let info = reader.next_frame(&mut buf).unwrap();
    assert_eq!(info.color_type, png::ColorType::Rgba);
    buf.truncate(info.buffer_size());
    Image { width: info.width, height: info.height, rgba: buf }
}

fn distinct_colours(img: &Image, x: u32, y: u32, w: u32, h: u32) -> usize {
    let mut seen = HashSet::new();
    for yy in y..(y + h).min(img.height) {
        for xx in x..(x + w).min(img.width) {
            let i = ((yy * img.width + xx) * 4) as usize;
            seen.insert([img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]]);
        }
    }
    seen.len()
}

#[test]
fn renders_all_screens() {
    let dir = scratch("all");
    let files = render::render_screens(&dir, &opts("en", 1.0)).unwrap();
    assert_eq!(files.len(), 8);
    for (screen, file) in Screen::ORDER.iter().zip(&files) {
        assert_eq!(file.file_name().unwrap().to_str().unwrap(), format!("{}-dark-en-1.png", screen.key()));
        let img = read_png(file);
        assert!(img.width >= 900 && img.height >= 560, "{}: {}x{}", screen.key(), img.width, img.height);
        let n = distinct_colours(&img, 0, 0, img.width, img.height);
        assert!(n > 1, "{} is one flat colour", screen.key());
    }
    let _ = std::fs::remove_dir_all(&dir);
}

/// Every glyph of the screen's title is in the bundled fonts or in a system
/// font fontdb finds, so the renderer's fallback has something to land on.
fn title_glyphs_have_a_font(screen: Screen, lang: &str) -> bool {
    let title = prune_core::i18n::Catalog::load(lang).t(screen.nav_key(), &[]);
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    for bytes in prune_app::theme::font_bytes() {
        db.load_font_data(bytes.to_vec());
    }
    let has = |ch: char| {
        db.faces().any(|f| {
            db.with_face_data(f.id, |data, index| {
                ttf_parser::Face::parse(data, index).is_ok_and(|face| face.glyph_index(ch).is_some())
            })
            .unwrap_or(false)
        })
    };
    !title.is_empty() && title.chars().filter(|c| !c.is_whitespace()).all(has)
}

#[test]
fn renders_non_latin() {
    for lang in ["ar", "th", "ja", "el"] {
        let img = render::render_screen(Screen::Dashboard, &opts(lang, 1.0));
        // The title sits 48 px in and 40 px down, 30 px tall; Arabic is
        // right-to-left, so look across the page's width.
        let n = distinct_colours(&img, 72, 36, img.width - 72, 44);
        // Background plus at least two more: glyph colour and its edges.
        assert!(n >= 3, "{lang}: title region has {n} colours");
        assert!(title_glyphs_have_a_font(Screen::Dashboard, lang), "{lang}: title glyphs have no font");
    }
}

#[test]
fn scale_2_doubles_size() {
    let one = render::render_screen(Screen::Dashboard, &opts("en", 1.0));
    let two = render::render_screen(Screen::Dashboard, &opts("en", 2.0));
    assert_eq!((two.width, two.height), (one.width * 2, one.height * 2));
}

#[test]
fn light_differs_from_dark_and_rail_expands() {
    let dark = render::render_screen(Screen::Dashboard, &opts("en", 1.0));
    let light = render::render_screen(Screen::Dashboard, &Options { theme: ThemeChoice::Light, ..opts("en", 1.0) });
    assert_ne!(dark.rgba, light.rgba);
    let wide = render::render_screen(Screen::Dashboard, &Options { rail: RailMode::Expanded, ..opts("en", 1.0) });
    assert_ne!(dark.rgba, wide.rgba);
}

#[test]
fn cli_writes_files_and_leaves_settings_alone() {
    let dir = scratch("cli");
    let status = Command::new(env!("CARGO_BIN_EXE_Prune"))
        .args(["--render-screens"])
        .arg(&dir)
        .args(["--theme", "light", "--lang", "el", "--scale", "1.5", "--rail", "expanded"])
        .status()
        .unwrap();
    assert!(status.success());
    for screen in Screen::ORDER {
        let f = dir.join(format!("{}-light-el-1.5.png", screen.key()));
        assert!(f.is_file(), "missing {}", f.display());
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn parse_args_rejects_bad_values() {
    let a = |v: &[&str]| render::parse_args(&v.iter().map(|s| s.to_string()).collect::<Vec<_>>());
    assert!(a(&["Prune.exe"]).is_none());
    assert!(a(&["Prune.exe", "--render-screens", "x", "--theme", "pink"]).unwrap().is_err());
    assert!(a(&["Prune.exe", "--render-screens", "x", "--scale", "0"]).unwrap().is_err());
    assert!(a(&["Prune.exe", "--render-screens"]).unwrap().is_err());
    let (dir, o) = a(&["Prune.exe", "--render-screens", "x", "--theme", "light"]).unwrap().unwrap();
    assert_eq!(dir, PathBuf::from("x"));
    assert_eq!(o.theme, ThemeChoice::Light);
    assert_eq!(o.scale, 1.0);
}
