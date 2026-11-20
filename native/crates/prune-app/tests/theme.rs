use iced::Color;
use prune_app::theme::{Palette, is_dark, palette};
use prune_core::settings::ThemeChoice;

fn css() -> String {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../frontend/src/index.css");
    std::fs::read_to_string(path).expect("frontend/src/index.css")
}

/// The body of the block opened by `selector {`, up to its closing brace.
fn block(css: &str, selector: &str) -> String {
    let open = format!("{selector} {{");
    let start = css.find(&open).unwrap_or_else(|| panic!("no block {selector}")) + open.len();
    let end = css[start..].find("\n}").expect("block end") + start;
    css[start..end].to_string()
}

fn var(block: &str, name: &str) -> String {
    let key = format!("--{name}:");
    let line = block
        .lines()
        .map(str::trim)
        .find(|l| l.starts_with(&key))
        .unwrap_or_else(|| panic!("no --{name}"));
    line[key.len()..].trim().trim_end_matches(';').trim().to_string()
}

fn parse(value: &str) -> Color {
    if let Some(hex) = value.strip_prefix('#') {
        let n = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).unwrap();
        Color::from_rgba8(n(0), n(2), n(4), 1.0)
    } else {
        let inner = value.strip_prefix("rgba(").and_then(|v| v.strip_suffix(')')).expect(value);
        let p: Vec<&str> = inner.split(',').map(str::trim).collect();
        Color::from_rgba8(p[0].parse().unwrap(), p[1].parse().unwrap(), p[2].parse().unwrap(), p[3].parse().unwrap())
    }
}

fn close(a: Color, b: Color) -> bool {
    let t = 1.0 / 255.0 + 1e-6;
    (a.r - b.r).abs() <= t && (a.g - b.g).abs() <= t && (a.b - b.b).abs() <= t && (a.a - b.a).abs() <= t
}

fn fields(p: &Palette) -> Vec<(&'static str, Color)> {
    vec![
        ("bg-base", p.bg_base),
        ("bg-panel", p.bg_panel),
        ("text-primary", p.text_primary),
        ("text-secondary", p.text_secondary),
        ("text-muted", p.text_muted),
        ("accent-primary", p.accent_primary),
        ("accent-primary-soft", p.accent_primary_soft),
        ("accent-primary-deep", p.accent_primary_deep),
        ("accent-ink", p.accent_ink),
        ("danger", p.danger),
        ("danger-soft", p.danger_soft),
        ("warning", p.warning),
        ("success", p.success),
        ("border-subtle", p.border_subtle),
        ("border-hover", p.border_hover),
        ("control-border", p.control_border),
        ("surface-subtle", p.surface_subtle),
        ("surface-hover", p.surface_hover),
        ("surface-strong", p.surface_strong),
        ("scrim", p.scrim),
    ]
}

#[test]
fn palette_matches_index_css() {
    let css = css();
    for (dark, selector) in [(true, ":root"), (false, ":root[data-theme='light']")] {
        let b = block(&css, selector);
        let fs = fields(palette(dark));
        assert_eq!(fs.len(), 20);
        for (name, got) in fs {
            let want = parse(&var(&b, name));
            assert!(close(got, want), "{selector} --{name}: rust {got:?} != css {want:?}");
        }
    }
}

#[test]
fn is_dark_rules() {
    assert!(is_dark(ThemeChoice::Dark, None));
    assert!(is_dark(ThemeChoice::Dark, Some(true)));
    assert!(!is_dark(ThemeChoice::Light, None));
    assert!(!is_dark(ThemeChoice::Light, Some(false)));
    assert!(is_dark(ThemeChoice::System, None));
    assert!(is_dark(ThemeChoice::System, Some(false)));
    assert!(!is_dark(ThemeChoice::System, Some(true)));
}
