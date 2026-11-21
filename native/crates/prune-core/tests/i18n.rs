use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

use fluent_syntax::ast::Entry;
use prune_core::i18n::{Catalog, FluentValue, LANGUAGES};

fn locales() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("locales")
}

/// Every message id in one .ftl file. Fails on any syntax error, so a file
/// Fluent would partly skip can't pass as complete.
fn ids(lang: &str, file: &str) -> BTreeSet<String> {
    let path = locales().join(lang).join(file);
    let source = fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    let resource = fluent_syntax::parser::parse(source.as_str())
        .unwrap_or_else(|(_, errors)| panic!("{lang}/{file} has syntax errors: {errors:?}"));
    resource
        .body
        .iter()
        .filter_map(|entry| match entry {
            Entry::Message(m) => Some(m.id.name.to_string()),
            _ => None,
        })
        .collect()
}

#[test]
fn every_language_has_every_en_key() {
    for file in ["prune.ftl", "cleaners.ftl"] {
        let en = ids("en", file);
        assert!(en.len() > 100, "en/{file} has only {} messages", en.len());
        for lang in LANGUAGES {
            let own = ids(lang, file);
            let missing: Vec<_> = en.difference(&own).collect();
            let extra: Vec<_> = own.difference(&en).collect();
            assert!(missing.is_empty(), "{lang}/{file} is missing {missing:?}");
            assert!(extra.is_empty(), "{lang}/{file} has extra {extra:?}");
        }
    }
}

#[test]
fn every_language_loads_and_resolves_en_keys() {
    // The loaded bundle, not just the file, must answer every en key.
    let en = ids("en", "prune.ftl");
    for lang in LANGUAGES {
        let catalog = Catalog::load(lang);
        for id in &en {
            assert!(catalog.has_id(id), "{lang} bundle lacks {id}");
        }
    }
}

#[test]
fn plain_string_matches_3x() {
    assert_eq!(Catalog::load("en").t("nav.dashboard", &[]), "Dashboard");
    assert_eq!(Catalog::load("de").t("nav.dashboard", &[]), "Übersicht");
    assert_eq!(Catalog::load("el").t("nav.dashboard", &[]), "Πίνακας ελέγχου");
}

#[test]
fn placeable_args() {
    let en = Catalog::load("en");
    assert_eq!(en.t("windowsToolsV1.loadError", &[("reason", "boom".into())]), "Couldn't list the tools: boom");
}

#[test]
fn right_to_left_languages_keep_isolating_marks() {
    for lang in ["ar", "he", "ps"] {
        let catalog = Catalog::load(lang);
        let text = catalog.t("windowsToolsV1.loadError", &[("reason", FluentValue::from("boom"))]);
        assert!(text.contains("\u{2068}boom\u{2069}"), "{lang}: {text:?}");
    }
    let de = Catalog::load("de");
    let text = de.t("windowsToolsV1.loadError", &[("reason", FluentValue::from("boom"))]);
    assert!(!text.contains('\u{2068}'), "{text:?}");
}

#[test]
fn catalogs_are_shared_across_threads() {
    // Bundles are parsed once and cached; a Catalog is Copy, Send and Sync.
    let first = Catalog::load("de");
    let threads: Vec<_> = (0..8)
        .map(|_| {
            std::thread::spawn(move || (first.t("nav.dashboard", &[]), Catalog::load("de").t("nav.dashboard", &[])))
        })
        .collect();
    for thread in threads {
        assert_eq!(thread.join().unwrap(), ("Übersicht".to_owned(), "Übersicht".to_owned()));
    }
}

#[test]
fn unknown_language_falls_back_to_en() {
    assert_eq!(Catalog::load("xx-YY").t("nav.dashboard", &[]), "Dashboard");
    assert_eq!(Catalog::load("").t("nav.dashboard", &[]), "Dashboard");
}

#[test]
fn unknown_key_returns_key() {
    assert_eq!(Catalog::load("en").t("nav.noSuchKey", &[]), "nav.noSuchKey");
}

#[test]
fn keys_with_spaces_and_pipes_resolve() {
    // 3.x startup source labels are keyed by "Run (32-bit)|machine" and the
    // like; the id mapping must be the converter's, so the dotted key works.
    let en = Catalog::load("en");
    let key = "startup.groups.Run (32-bit)|machine";
    assert_eq!(en.t(key, &[]), "Registry: HKLM Run (32-bit)");
}

#[test]
fn cleaner_text_resolves() {
    assert_eq!(Catalog::load("en").t("cleaner.rules.brave_cache.name", &[]), "Cache");
    assert_eq!(Catalog::load("de").t("cleaner.categories.Developer tools", &[]), "Entwicklertools");
}

#[test]
fn phase1_namespaces_have_no_needs_review() {
    let json = fs::read_to_string(locales().join("needs-review.json")).unwrap();
    let review: serde_json::Map<String, serde_json::Value> = serde_json::from_str(&json).unwrap();
    let prefixes = ["nav.", "settings.tabs.", "settings.language.", "common."];
    let mut left = Vec::new();
    for (lang, keys) in &review {
        for key in keys.as_array().unwrap() {
            let key = key.as_str().unwrap();
            if prefixes.iter().any(|p| key.starts_with(p)) {
                left.push(format!("{lang}: {key}"));
            }
        }
    }
    assert!(left.is_empty(), "still need review: {left:?}");
}
