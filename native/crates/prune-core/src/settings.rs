//! `settings.json`, shared with the 3.x Electron app.
//!
//! The file is the same one 3.x reads and writes, so a 4.0 install and a 3.x
//! install can share a profile. Only the keys 4.0 acts on are typed; every
//! other key (3.x has dozens, and a future version may add more) is carried in
//! [`Settings::rest`] and written back untouched. Reading never fails: a
//! missing, unreadable or corrupt file gives defaults, and a bad value in one
//! key is repaired on its own, exactly as `backend/src/services/settings.js`
//! does. [`load`] never writes; only [`save`] does.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};

/// The 40 language codes 3.x ships (`frontend/src/i18n/languages.js`).
pub const LANGUAGES: [&str; 40] = [
    "en", "af", "ar", "ca", "cs", "cy", "da", "de", "el", "es", "et", "fi", "fr", "he", "hu", "id",
    "is", "it", "ja", "ko", "lt", "ms", "nb", "nl", "pl", "ps", "pt-BR", "pt", "ro", "ru", "sk",
    "sq", "sr", "sv", "th", "tr", "uk", "vi", "zh-CN", "zh-TW",
];

/// The theme choice, as stored in `theme`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeChoice {
    #[default]
    System,
    Light,
    Dark,
}

/// How sizes are written, as stored in `sizeUnits`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SizeUnits {
    /// 1024-based, labelled KB/MB/GB, as File Explorer prints.
    #[default]
    Windows,
    /// 1024-based, labelled KiB/MiB/GiB.
    Binary,
    /// 1000-based, labelled KB/MB/GB.
    Decimal,
}

/// The settings 4.0 acts on, plus everything else in the file.
#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub theme: ThemeChoice,
    pub theme_synced: bool,
    pub language: String,
    pub size_units: SizeUnits,
    pub minimize_to_tray: bool,
    /// Every key this version does not own, preserved verbatim and in order.
    pub rest: Map<String, Value>,
    /// Top-level key order of the file as read, so a save keeps it.
    order: Vec<String>,
}

/// 3.x's full default settings (`DEFAULT_SETTINGS`), taken from the 3.x
/// fixture. A fresh or corrupt file starts from these so a rollback to 3.x
/// finds every key written, not 3.x's migration fallbacks.
const DEFAULTS_JSON: &str = include_str!("../tests/fixtures/settings-3.2.0.json");

impl Default for Settings {
    fn default() -> Self {
        let mut map: Map<String, Value> = serde_json::from_str(DEFAULTS_JSON).unwrap_or_default();
        map.remove("futureKey");
        Self::from_map(map)
    }
}

impl Serialize for Settings {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        let owned = [
            ("theme", serde_json::to_value(self.theme).unwrap_or_default()),
            ("themeSynced", Value::Bool(self.theme_synced)),
            ("language", Value::String(self.language.clone())),
            ("sizeUnits", serde_json::to_value(self.size_units).unwrap_or_default()),
            ("minimizeToTray", Value::Bool(self.minimize_to_tray)),
        ];
        let mut out = Map::new();
        for key in &self.order {
            if let Some((_, v)) = owned.iter().find(|(k, _)| k == key) {
                out.insert(key.clone(), v.clone());
            } else if let Some(v) = self.rest.get(key) {
                out.insert(key.clone(), v.clone());
            }
        }
        for (k, v) in owned {
            if !out.contains_key(k) {
                out.insert(k.to_owned(), v);
            }
        }
        for (k, v) in &self.rest {
            if !out.contains_key(k) {
                out.insert(k.clone(), v.clone());
            }
        }
        out.serialize(ser)
    }
}

const OWNED_KEYS: [&str; 5] = [
    "theme",
    "themeSynced",
    "language",
    "sizeUnits",
    "minimizeToTray",
];

fn choice<T: for<'de> Deserialize<'de> + Default>(v: Option<&Value>) -> T {
    v.and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default()
}

impl Settings {
    /// Normalizes a parsed file the way 3.x does, remembering key order.
    fn from_map(mut map: Map<String, Value>) -> Self {
        let order: Vec<String> = map.keys().cloned().collect();
        let language = match map.get("language") {
            Some(Value::String(s)) if LANGUAGES.contains(&s.as_str()) => s.clone(),
            _ => "en".to_owned(),
        };
        let theme = choice(map.get("theme"));
        let size_units = choice(map.get("sizeUnits"));
        let theme_synced = map.get("themeSynced") == Some(&Value::Bool(true));
        // 3.x passes this through unvalidated and reads it with a
        // truthiness test; only a real `true` counts here.
        let minimize_to_tray = map.get("minimizeToTray") == Some(&Value::Bool(true));
        for k in OWNED_KEYS {
            map.shift_remove(k);
        }
        Self {
            theme,
            theme_synced,
            language,
            size_units,
            minimize_to_tray,
            rest: map,
            order,
        }
    }
}

impl<'de> Deserialize<'de> for Settings {
    /// Lenient on purpose: a bad value in one key is replaced by that key's
    /// default, and a file that is not a JSON object at all gives defaults.
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        match Value::deserialize(d)? {
            Value::Object(m) => Ok(Self::from_map(m)),
            _ => Ok(Self::default()),
        }
    }
}

/// Where the file lives: `UNREVO_SETTINGS_PATH` if set, else
/// `%APPDATA%\Prune\settings.json` (3.x's packaged location).
pub fn settings_path() -> PathBuf {
    if let Some(p) = std::env::var_os("UNREVO_SETTINGS_PATH").filter(|p| !p.is_empty()) {
        return PathBuf::from(p);
    }
    let base = std::env::var_os("APPDATA")
        .filter(|p| !p.is_empty())
        .map_or_else(|| PathBuf::from("."), PathBuf::from);
    base.join("Prune").join("settings.json")
}

/// Reads the file. A missing or corrupt file gives defaults; nothing is
/// written, so a corrupt file is left for the person to look at.
pub fn load(path: &Path) -> Settings {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// Writes the file the way 3.x does: two-space JSON, no trailing newline, to
/// a temp file beside the real one and then renamed over it, so a reader or a
/// crash mid-write sees the old file or the new one, never half of one.
pub fn save(path: &Path, s: &Settings) -> io::Result<()> {
    if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
        fs::create_dir_all(dir)?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(format!(".{}.tmp", std::process::id()));
    let tmp = PathBuf::from(tmp);
    let json = serde_json::to_string_pretty(s).map_err(io::Error::other)?;
    fs::write(&tmp, json)?;
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// The theme to paint. 3.x only trusts `theme` once the UI has written its
/// real choice (`themeSynced`); before that it is System.
pub fn effective_theme(s: &Settings) -> ThemeChoice {
    if s.theme_synced {
        s.theme
    } else {
        ThemeChoice::System
    }
}
