//! Embeds every `locales/<lang>/{prune,cleaners}.ftl` in the crate: writes
//! `$OUT_DIR/locales.rs`, a table of `(lang, prune.ftl, cleaners.ftl)` built
//! from `include_str!`, which `src/i18n.rs` includes.

use std::fmt::Write as _;
use std::path::PathBuf;
use std::{env, fs};

fn main() {
    let locales = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("locales");
    println!("cargo:rerun-if-changed={}", locales.display());

    let mut langs: Vec<String> = fs::read_dir(&locales)
        .expect("prune-core/locales is missing")
        .map(|entry| entry.unwrap())
        .filter(|entry| entry.file_type().unwrap().is_dir())
        .map(|entry| entry.file_name().into_string().unwrap())
        .collect();
    langs.sort();

    let mut table = String::from("pub(crate) static SOURCES: &[(&str, &str, &str)] = &[\n");
    for lang in &langs {
        let dir = locales.join(lang);
        let mut files = Vec::new();
        for name in ["prune.ftl", "cleaners.ftl"] {
            let path = dir.join(name);
            assert!(path.is_file(), "{} is missing", path.display());
            println!("cargo:rerun-if-changed={}", path.display());
            files.push(format!("include_str!({:?})", path.to_str().unwrap()));
        }
        writeln!(table, "    ({lang:?}, {}, {}),", files[0], files[1]).unwrap();
    }
    table.push_str("];\n");

    let out = PathBuf::from(env::var("OUT_DIR").unwrap()).join("locales.rs");
    fs::write(out, table).unwrap();
}
