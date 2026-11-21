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
    let bg = bg_at(img.width - 10, 90);
    let (y0, y1) = (70, 130); // below the 40 px title bar
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

fn pixel(img: &Image, x: u32, y: u32) -> [u8; 3] {
    let i = ((y * img.width + x) * 4) as usize;
    [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]]
}

fn near(got: [u8; 3], want: iced::Color, what: &str) {
    let [r, g, b, _] = want.into_rgba8();
    let ok = got.iter().zip([r, g, b]).all(|(a, b)| a.abs_diff(b) <= 2);
    assert!(ok, "{what}: {got:?}, want {:?}", [r, g, b]);
}

/// Pixels in the box that differ clearly from `bg`.
fn ink(img: &Image, (x0, y0, x1, y1): (u32, u32, u32, u32), bg: iced::Color) -> usize {
    let [r, g, b, _] = bg.into_rgba8();
    let mut n = 0;
    for y in y0..y1 {
        for x in x0..x1 {
            let p = pixel(img, x, y);
            let d = p[0].abs_diff(r) as u32 + p[1].abs_diff(g) as u32 + p[2].abs_diff(b) as u32;
            n += usize::from(d > 60);
        }
    }
    n
}

/// 3.x's title bar (TitleBar.jsx): 40 px of --bg-base whose last row is the
/// 1 px --border-subtle line (Tailwind's border-box h-10, so the line is
/// y = 39 and the page starts at y = 40), the logo at x = 26..46, "PRUNE"
/// 10 px after it, and the three caption buttons over the right end, at
/// rest (their ground is --bg-base, covering the line, as 3.x's overlay).
#[test]
fn draws_the_3x_title_bar() {
    use prune_app::titlebar::over;
    for theme in [ThemeChoice::Dark, ThemeChoice::Light] {
        let img = render::render_screen(Screen::Dashboard, &Options { theme, ..opts("en", 1.0) });
        let p = prune_app::theme::palette(theme == ThemeChoice::Dark);
        let border = over(p.border_subtle, p.bg_base);
        let w = img.width;
        let t = format!("{theme:?}");
        near(pixel(&img, 600, 20), p.bg_base, &format!("{t}: bar ground"));
        near(pixel(&img, 600, 38), p.bg_base, &format!("{t}: bar ground, last row above the line"));
        near(pixel(&img, 600, 39), border, &format!("{t}: the bottom border"));
        near(pixel(&img, 200, 39), border, &format!("{t}: the border runs across"));
        near(pixel(&img, 600, 40), p.bg_base, &format!("{t}: the page below the bar"));
        near(pixel(&img, w - 20, 39), p.bg_base, &format!("{t}: the buttons cover the line"));
        assert_ne!(border.into_rgba8(), p.bg_base.into_rgba8(), "{t}: the line is visible");

        // The logo (a dark disc with a teal leaf) and the name have ink.
        assert!(ink(&img, (26, 10, 46, 30), p.bg_base) >= 100, "{t}: no logo");
        let name = ink(&img, (56, 10, 130, 30), p.bg_base);
        assert!(name >= 60, "{t}: no PRUNE ({name} px of ink)");
        // ...and stop where the name does: the middle of the bar is empty.
        assert_eq!(ink(&img, (130, 0, w - 3 * 46 - 4, 38), p.bg_base), 0, "{t}: stray ink in the drag area");
        // A glyph in each 46 px button, centred, nothing at its edges.
        for k in 1..=3 {
            let right = w - 46 * (k - 1);
            assert!(ink(&img, (right - 46 + 15, 13, right - 15, 27), p.bg_base) >= 8, "{t}: button {k} has no glyph");
            assert_eq!(ink(&img, (right - 46, 0, right - 46 + 12, 39), p.bg_base), 0, "{t}: button {k} edge");
        }
    }
    // Twice the pixels at 2x: the line is the 80 px bar's last two rows.
    let two = render::render_screen(Screen::Dashboard, &opts("en", 2.0));
    let p = prune_app::theme::palette(true);
    near(pixel(&two, 1200, 77), p.bg_base, "2x: ground");
    near(pixel(&two, 1200, 79), prune_app::titlebar::over(p.border_subtle, p.bg_base), "2x: line");
    near(pixel(&two, 1200, 80), p.bg_base, "2x: page");
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
