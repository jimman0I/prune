use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use prune_core::settings::{Settings, SizeUnits, ThemeChoice, effective_theme, load, save, settings_path};
use serde_json::{Value, json};

fn fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/settings-3.2.0.json")
}

fn scratch(name: &str) -> PathBuf {
    static N: AtomicUsize = AtomicUsize::new(0);
    let n = N.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!("prune-settings-{}-{name}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir.join("settings.json")
}

fn load_json(v: Value) -> Settings {
    let p = scratch("json");
    fs::write(&p, v.to_string()).unwrap();
    load(&p)
}

#[test]
fn round_trip_keeps_every_3x_key() {
    let s = load(&fixture());
    assert_eq!(s.rest["futureKey"], json!({"a": 1}));
    let out = scratch("round-trip");
    save(&out, &s).unwrap();
    let want: Value = serde_json::from_slice(&fs::read(fixture()).unwrap()).unwrap();
    let got: Value = serde_json::from_slice(&fs::read(&out).unwrap()).unwrap();
    assert_eq!(got, want);
    let dir = out.parent().unwrap();
    assert_eq!(fs::read_dir(dir).unwrap().count(), 1, "temp file left behind");
}

#[test]
fn invalid_values_normalize_like_3x() {
    let s = load_json(json!({
        "theme": "solarized", "sizeUnits": "x", "themeSynced": "yes",
        "language": "xx", "minimizeToTray": 1, "other": 5
    }));
    assert_eq!(s.theme, ThemeChoice::System);
    assert_eq!(s.size_units, SizeUnits::Windows);
    assert!(!s.theme_synced);
    assert_eq!(s.language, "en");
    assert!(!s.minimize_to_tray);
    assert_eq!(s.rest["other"], json!(5));
    // Valid values survive, including a regional language code.
    let s = load_json(json!({
        "theme": "dark", "sizeUnits": "binary", "themeSynced": true,
        "language": "pt-BR", "minimizeToTray": true
    }));
    assert_eq!(s.theme, ThemeChoice::Dark);
    assert_eq!(s.size_units, SizeUnits::Binary);
    assert!(s.theme_synced && s.minimize_to_tray);
    assert_eq!(s.language, "pt-BR");
}

#[test]
fn missing_file_gives_defaults() {
    let p = scratch("missing");
    assert_eq!(load(&p), Settings::default());
    assert!(!p.exists());
}

#[test]
fn corrupt_file_gives_defaults_and_is_not_rewritten_by_load() {
    for bytes in [&b"{ not json"[..], b"[1,2]", b""] {
        let p = scratch("corrupt");
        fs::write(&p, bytes).unwrap();
        assert_eq!(load(&p), Settings::default());
        assert_eq!(fs::read(&p).unwrap(), bytes);
    }
}

#[test]
fn unsynced_theme_is_system() {
    let s = load_json(json!({"theme": "dark"}));
    assert_eq!(effective_theme(&s), ThemeChoice::System);
    let s = load_json(json!({"theme": "dark", "themeSynced": true}));
    assert_eq!(effective_theme(&s), ThemeChoice::Dark);
}

#[test]
fn save_matches_3x_formatting_and_creates_folders() {
    let p = scratch("format").parent().unwrap().join("nested/deeper/settings.json");
    save(&p, &Settings::default()).unwrap();
    let text = fs::read_to_string(&p).unwrap();
    assert!(text.starts_with("{\n  \""), "two-space indent");
    assert!(!text.ends_with('\n'), "3.x writes no trailing newline");
}

#[test]
fn settings_path_honours_env_override() {
    // Only this test touches the variable.
    unsafe { std::env::set_var("UNREVO_SETTINGS_PATH", "C:\\x\\s.json") };
    assert_eq!(settings_path(), PathBuf::from("C:\\x\\s.json"));
    unsafe { std::env::remove_var("UNREVO_SETTINGS_PATH") };
    assert!(settings_path().ends_with("Prune\\settings.json") || settings_path().ends_with("Prune/settings.json"));
}

#[test]
fn save_keeps_3x_key_order() {
    let out = scratch("order");
    save(&out, &load(&fixture())).unwrap();
    let keys = |p: &PathBuf| -> Vec<String> {
        let v: serde_json::Map<String, Value> = serde_json::from_slice(&fs::read(p).unwrap()).unwrap();
        v.keys().cloned().collect()
    };
    assert_eq!(keys(&out), keys(&fixture()));
}

#[test]
fn fresh_save_writes_every_3x_default() {
    for bytes in [None, Some(&b"{ corrupt"[..])] {
        let p = scratch("fresh");
        if let Some(b) = bytes {
            fs::write(&p, b).unwrap();
        }
        save(&p, &load(&p)).unwrap();
        let got: serde_json::Map<String, Value> = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
        let mut want: serde_json::Map<String, Value> = serde_json::from_slice(&fs::read(fixture()).unwrap()).unwrap();
        want.shift_remove("futureKey");
        want.insert("lastSeenVersion".into(), Value::Null);
        assert_eq!(got, want);
        assert_eq!(got.keys().collect::<Vec<_>>(), want.keys().collect::<Vec<_>>());
    }
}
