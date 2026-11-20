//! Prune's UI text in its 40 languages, as Fluent.
//!
//! The `.ftl` files under `prune-core/locales/` were generated once from
//! Prune 3.x's catalog by `native/tools/convert-catalog.mjs` and are kept by
//! hand from then on. `build.rs` embeds them all, so a [`Catalog`] never
//! touches the disk.
//!
//! Keys stay 3.x's dotted paths (`"nav.reportBug"`); [`fluent_id`] turns
//! one into its Fluent id the same way the converter did. Deep Clean's rule
//! text lives in the same catalog under `cleaner.rules.<id>.name`,
//! `cleaner.rules.<id>.description` and `cleaner.categories.<English name>`.

use std::borrow::Cow;
use std::fmt::Write as _;
use std::sync::{LazyLock, OnceLock};

use fluent_bundle::concurrent::FluentBundle;
use fluent_bundle::{FluentArgs, FluentResource};
use unic_langid::LanguageIdentifier;

pub use fluent_bundle::FluentValue;

include!(concat!(env!("OUT_DIR"), "/locales.rs"));

/// Every language Prune can be shown in, in 3.x's `languages.js` order.
pub const LANGUAGES: [&str; 40] = [
    "en", "af", "ar", "ca", "cs", "cy", "da", "de", "el", "es", "et", "fi", "fr", "he", "hu",
    "id", "is", "it", "ja", "ko", "lt", "ms", "nb", "nl", "pl", "ps", "pt-BR", "pt", "ro", "ru",
    "sk", "sq", "sr", "sv", "th", "tr", "uk", "vi", "zh-CN", "zh-TW",
];

/// Right-to-left languages: their placeables keep Fluent's isolating marks,
/// so an English path or name inside them can't reorder the sentence.
const RIGHT_TO_LEFT: [&str; 3] = ["ar", "he", "ps"];

type Bundle = FluentBundle<FluentResource>;

/// Each embedded language's bundle, parsed the first time it is loaded and
/// kept for the life of the process. Same order as `SOURCES`.
static BUNDLES: LazyLock<Box<[OnceLock<Bundle>]>> =
    LazyLock::new(|| SOURCES.iter().map(|_| OnceLock::new()).collect());

/// One language's text, ready to format. Cheap to copy: the parsed bundle
/// is shared, so loading the same language again costs a lookup, not a
/// parse.
///
/// There is no per-key fallback to English: a key a non-`en` bundle lacks
/// gives the key itself back, as an unknown key does. The completeness
/// test (`every_language_has_every_en_key`) is what guarantees every
/// language has every key.
#[derive(Clone, Copy)]
pub struct Catalog {
    bundle: &'static Bundle,
}

impl Catalog {
    /// The catalog for `lang` (a 3.x language code such as `"pt-BR"`), or
    /// English's when Prune has no such language.
    pub fn load(lang: &str) -> Catalog {
        let index = SOURCES
            .iter()
            .position(|(code, ..)| *code == lang)
            .or_else(|| SOURCES.iter().position(|(code, ..)| *code == "en"))
            .expect("the en locale is embedded");
        Catalog { bundle: BUNDLES[index].get_or_init(|| parse(SOURCES[index])) }
    }
}

/// Builds one language's bundle from its embedded files.
fn parse((code, prune, cleaners): (&str, &str, &str)) -> Bundle {
    let langid: LanguageIdentifier = code.parse().unwrap_or_default();
    let mut bundle = FluentBundle::new_concurrent(vec![langid]);
    bundle.set_use_isolating(RIGHT_TO_LEFT.contains(&code));
    for source in [prune, cleaners] {
        // The files are tested to parse cleanly; should one ever not, the
        // messages that did parse are still used.
        let resource = FluentResource::try_new(source.to_owned()).unwrap_or_else(|(partial, errors)| {
            debug_log(format_args!("{code}: syntax errors {errors:?}"));
            partial
        });
        if let Err(errors) = bundle.add_resource(resource) {
            debug_log(format_args!("{code}: {errors:?}"));
        }
    }
    bundle
}

impl Catalog {
    /// The text for `key`, a 3.x dotted path, with `args` put in its
    /// placeables. An unknown key gives the key itself back.
    pub fn t(&self, key: &str, args: &[(&str, FluentValue)]) -> String {
        let id = fluent_id(key);
        let Some(pattern) = self.bundle.get_message(&id).and_then(|m| m.value()) else {
            debug_log(format_args!("no message for {key:?} (id {id})"));
            return key.to_owned();
        };
        let mut fluent_args = FluentArgs::with_capacity(args.len());
        for (name, value) in args {
            fluent_args.set(*name, value.clone());
        }
        let mut errors = Vec::new();
        let text = self.bundle.format_pattern(pattern, Some(&fluent_args), &mut errors);
        if !errors.is_empty() {
            debug_log(format_args!("{key:?}: {errors:?}"));
        }
        text.into_owned()
    }

    /// Whether the catalog has a message with this Fluent id (not a dotted
    /// key: see [`fluent_id`]).
    pub fn has_id(&self, id: &str) -> bool {
        self.bundle.has_message(id)
    }
}

/// The Fluent id for a 3.x dotted key: `.` becomes `-`, and any character
/// Fluent ids don't allow becomes `_<hex code point>_`, so
/// `"startup.groups.Run|user"` is `startup-groups-Run_7c_user`. Must match
/// `segmentId` in `native/tools/convert-catalog.mjs`.
pub fn fluent_id(key: &str) -> Cow<'_, str> {
    if key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'.') {
        return if key.contains('.') { Cow::Owned(key.replace('.', "-")) } else { Cow::Borrowed(key) };
    }
    let mut id = String::with_capacity(key.len() + 8);
    for ch in key.chars() {
        match ch {
            '.' => id.push('-'),
            c if c.is_ascii_alphanumeric() || c == '_' => id.push(c),
            c => {
                let _ = write!(id, "_{:x}_", u32::from(c));
            }
        }
    }
    Cow::Owned(id)
}

#[cfg(debug_assertions)]
fn debug_log(message: std::fmt::Arguments) {
    eprintln!("prune i18n: {message}");
}

#[cfg(not(debug_assertions))]
fn debug_log(_: std::fmt::Arguments) {}
