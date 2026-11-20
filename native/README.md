# Prune 4.0 (native)

The Rust rewrite of Prune. The workspace has three crates: `prune-core` (the engine), `prune-app` (the iced window, binary `Prune`) and `prune-cli` (binary `prune-cli`). Build and test from this folder with `cargo build` and `cargo test --workspace`; lint with `cargo clippy --workspace -- -D warnings`. Every dependency must carry an allowed open-source licence, checked by `cargo deny check licenses` (install once with `cargo install cargo-deny --locked`); the allow-list lives in `deny.toml`.
