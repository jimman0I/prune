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

/// Ink in the title band: for each column from x = 100, how many pixels
/// differ from the page colour. Returns the profile trimmed to the title's
/// own extent, plus the ink's row range.
fn title_ink(img: &Image) -> (Vec<u32>, u32) {
    let bg_at = |x: u32, y: u32| {
        let i = ((y * img.width + x) * 4) as usize;
        [img.rgba[i] as i32, img.rgba[i + 1] as i32, img.rgba[i + 2] as i32]
    };
    let bg = bg_at(img.width - 10, 50);
    let (y0, y1) = (30, 90);
    let mut cols = Vec::new();
    let mut rows = HashSet::new();
    for x in 100..img.width - 20 {
        let mut n = 0;
        for y in y0..y1 {
            let p = bg_at(x, y);
            if (0..3).map(|k| (p[k] - bg[k]).abs()).sum::<i32>() > 60 {
                n += 1;
                rows.insert(y);
            }
        }
        cols.push(n);
    }
    let first = cols.iter().position(|&n| n > 0).unwrap_or(0);
    let last = cols.iter().rposition(|&n| n > 0).map_or(0, |l| l + 1);
    (cols[first..last.max(first)].to_vec(), rows.len() as u32)
}

/// Splits a column profile into runs of inked columns (glyphs, or a joined
/// word in a connected script), separated by empty columns.
fn runs(cols: &[u32]) -> Vec<&[u32]> {
    cols.split(|&n| n == 0).filter(|r| !r.is_empty()).collect()
}

/// A missing glyph draws as the same box every time, so a title made of
/// tofu is a row of identical runs. Real text of three or more runs has at
/// least two different shapes.
fn looks_like_tofu(cols: &[u32]) -> bool {
    let r = runs(cols);
    r.len() >= 3 && r.iter().all(|run| *run == r[0])
}

#[test]
fn renders_non_latin() {
    let en = render::render_screen(Screen::Dashboard, &opts("en", 1.0));
    let (en_cols, _) = title_ink(&en);
    assert!(!en_cols.is_empty(), "the English title has no ink: the band is wrong");
    assert!(!looks_like_tofu(&en_cols), "the tofu check flags real Latin text");
    for lang in ["ar", "th", "ja", "el"] {
        let img = render::render_screen(Screen::Dashboard, &opts(lang, 1.0));
        let (cols, height) = title_ink(&img);
        // There is a title, with real extent.
        assert!(cols.len() >= 40 && height >= 10, "{lang}: title ink {}x{height}", cols.len());
        // It is not the English title (the catalog did load).
        assert_ne!(cols, en_cols, "{lang}: title looks like the English one");
        // It is not a row of identical boxes.
        assert!(!looks_like_tofu(&cols), "{lang}: title is a run of identical boxes");
        // The title's glyphs exist in a bundled or system font.
        assert!(title_glyphs_have_a_font(Screen::Dashboard, lang), "{lang}: title glyphs have no font");
    }
}

#[test]
fn tofu_check_catches_boxes() {
    let boxed = [3, 5, 3, 0, 3, 5, 3, 0, 3, 5, 3];
    assert!(looks_like_tofu(&boxed));
    let text = [3, 5, 3, 0, 4, 6, 2, 0, 3, 5, 3, 0, 7, 1];
    assert!(!looks_like_tofu(&text));
}

#[test]
fn renders_the_default_windows_client_area_at_each_scale() {
    let one = render::render_screen(Screen::Dashboard, &opts("en", 1.0));
    let two = render::render_screen(Screen::Dashboard, &opts("en", 2.0));
    for (img, scale) in [(&one, 1.0), (&two, 2.0)] {
        let want = render::default_client_px(scale);
        assert_eq!((img.width, img.height), (want.width, want.height), "at {scale}x");
    }
    // About double: the frame Windows takes off does not scale exactly.
    let near = |a: u32, b: u32| a.abs_diff(b) <= 40;
    assert!(near(two.width, one.width * 2) && near(two.height, one.height * 2), "{}x{}", two.width, two.height);
    // The outer window is 1280x860 DIP; the frame comes off it.
    assert!(one.width < 1280 && one.height < 860 && one.width >= 1200 && one.height >= 780);
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
    let settings = dir.join("settings.json");
    let before = br#"{"theme":"dark","language":"fr"}"#;
    std::fs::write(&settings, before).unwrap();
    let out = dir.join("out");
    let status = Command::new(env!("CARGO_BIN_EXE_Prune"))
        .env("UNREVO_SETTINGS_PATH", &settings)
        .args(["--render-screens"])
        .arg(&out)
        .args(["--theme", "light", "--lang", "el", "--scale", "1.5", "--rail", "expanded"])
        .status()
        .unwrap();
    assert!(status.success());
    for screen in Screen::ORDER {
        let f = out.join(format!("{}-light-el-1.5.png", screen.key()));
        assert!(f.is_file(), "missing {}", f.display());
    }
    assert_eq!(std::fs::read(&settings).unwrap(), before, "the settings file was changed");
    assert!(!out.join("settings.json").exists());
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
