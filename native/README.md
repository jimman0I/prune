# Prune 4.0 (native)

The Rust rewrite of Prune. The workspace has three crates: `prune-core` (the engine), `prune-app` (the iced window, binary `Prune`) and `prune-cli` (binary `prune-cli`). Build and test from this folder with `cargo build` and `cargo test --workspace`; lint with `cargo clippy --workspace -- -D warnings`. Every dependency must carry an allowed open-source licence, checked by `cargo deny check licenses` (install once with `cargo install cargo-deny --locked`); the allow-list lives in `deny.toml`.

UI text lives in `crates/prune-core/locales/<lang>/prune.ftl` and `cleaners.ftl` (Fluent, 40 languages), read through `prune_core::i18n::Catalog`. The files were generated once from the 3.x catalog by `tools/convert-catalog.mjs` and are edited by hand from now on; `locales/needs-review.json` lists the entries whose 3.x function chose its words by a number or flag (mostly plurals) and still need rewriting as Fluent selects.
