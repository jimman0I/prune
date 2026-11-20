# Prune 4.0 Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A native Rust Prune window that opens fast, reads and writes 3.x's settings.json unchanged, speaks all 40 languages from a Fluent catalog generated from 3.x's, draws today's theme and nav rail over empty screens, sits in the tray, runs as a single instance, can render its own screens to PNG, and has a tool that measures it and 3.2 the same way.

**Architecture:** A cargo workspace in `native/` with three crates: `prune-core` (no UI: settings, i18n, later all Windows logic), `prune-app` (the iced 0.14 UI, binary `Prune.exe`) and `prune-cli` (later). Plus `native/tools` for the catalog converter (Node, it imports 3.x's ESM catalog) and the measuring tool (Rust bin). The UI calls core in-process.

**Tech Stack:** Rust 1.96 (installed), iced 0.14.0, fluent-bundle 0.16, windows 0.62, tray-icon 0.26, serde/serde_json, png, cargo-deny (license gate). Node 24 for the converter.

**Spec:** `docs/superpowers/specs/2026-11-20-prune-4-native-rust-design.md`. Roadmap: `docs/superpowers/plans/2026-11-20-prune-4-roadmap.md`.

## Global Constraints

- Dependencies are MIT, Apache-2.0, BSD-2/3, ISC, Zlib, Unicode-3.0, MPL-2.0, OFL-1.1 (fonts) only, and never commercially dual-licensed. `cargo deny check licenses` must pass in every task that adds a crate.
- On-disk formats and paths are exactly 3.x's: `%APPDATA%\Prune\settings.json`, overridable with `UNREVO_SETTINGS_PATH`. Everything written stays readable by 3.2 (rollback).
- No new features. No emoji in UI. No hover-only tooltips. Never write competing tools' names. No AI attribution in commits. Work on master; never push.
- Targets (measured later, against the Task 8 baseline): first frame under 300 ms, Dashboard idle under 60 MB and 0% CPU, installer under 25 MB.
- Window: 1280×860 default, 900×560 minimum (3.x values). Screens and order: `dashboard, diskmap, applications, quarantine, startup, duplicates, deepclean`, then `settings` pinned at the bottom of the rail.
- 40 languages: `en af ar ca cs cy da de el es et fi fr he hu id is it ja ko lt ms nb nl pl ps pt-BR pt ro ru sk sq sr sv th tr uk vi zh-CN zh-TW`.

## Review Focus

1. **A 3.x settings.json with keys 4.0 doesn't model, or hand-edited junk.** Every unknown key survives a load and save, and a corrupt file means defaults with no crash and no overwrite until the user changes something. Tests are in Task 2.
2. **A user jumping from 3.2.0 or earlier straight to 4.0 (never ran 3.2.1).** `themeSynced` is absent, so the theme is System, never the stale `'dark'` default. Test in Task 2.
3. **Non-Latin languages.** Arabic, Hebrew, Pashto, Thai, Japanese, Korean, Chinese, Greek and Cyrillic render real glyphs, not tofu, through system font fallback (Geist covers Latin only). There's a PNG check in Task 6 for `ar`, `th`, `ja` and `el`.
4. **Display scaling at 100–200%, and 3.x's text zoom.** The rail and window stay laid out and crisp, and the saved zoom from 3.x applies. Test in Task 5, PNG at scale 2.0 in Task 6.
5. **A second launch while Prune is running (including from the tray, Explorer verb or Start menu).** It focuses the existing window and doesn't open a second one. Test in Task 5.

---

### Task 1: Workspace and license gate

**Files:**
- Create: `native/Cargo.toml` (workspace, `resolver = "3"`, `[workspace.dependencies]` pinning iced 0.14.0, fluent-bundle 0.16, windows 0.62.2, tray-icon 0.26.1, serde 1, serde_json 1, png)
- Create: `native/crates/prune-core/` (lib), `native/crates/prune-app/` (bin named `Prune`), `native/crates/prune-cli/` (bin `prune-cli`, prints "not yet" and exits 2 for now)
- Create: `native/deny.toml` (the allow-list above)
- Create: `native/README.md` (how to build and test, one paragraph)
- Modify: `.github/workflows/build.yml`: add a `native` job on windows-latest running `cargo deny check licenses`, `cargo clippy -- -D warnings` and `cargo test --workspace`. The existing release flow stays untouched.
- Modify: `.gitignore`: add `native/target/`

- [ ] **Step 1:** `cargo install cargo-deny --locked` (dev tool, not shipped).
- [ ] **Step 2:** Create the workspace. `prune-app` opens an empty iced window titled "Prune".
- [ ] **Step 3:** Run `cd native && cargo build && cargo test --workspace && cargo deny check licenses`. Expected: build OK, 0 tests, `licenses ok`.
- [ ] **Step 4: Commit** `build(native): Rust workspace for Prune 4.0 with a license gate`

### Task 2: Settings compatible with 3.x

**Files:**
- Create: `native/crates/prune-core/src/settings.rs`, re-exported from `lib.rs`
- Create: `native/crates/prune-core/tests/fixtures/settings-3.2.0.json`. Generate it from 3.x with `node -e` importing `backend/src/services/settings.js` defaults and writing them out, then add one unknown key `"futureKey": {"a": 1}`.
- Test: `native/crates/prune-core/tests/settings.rs`

**Interfaces:**
- Produces:
  - `pub enum ThemeChoice { System, Light, Dark }` (serde as `"system"|"light"|"dark"`).
  - `pub enum SizeUnits { Windows, Binary, Decimal }` (serde `"windows"|"binary"|"decimal"`).
  - `pub struct Settings { pub theme: ThemeChoice, pub theme_synced: bool, pub language: String, pub size_units: SizeUnits, pub minimize_to_tray: bool, pub zoom: Option<f64>, pub rest: serde_json::Map<String, serde_json::Value> }`. The four named keys use 3.x's camelCase names (`themeSynced`, `sizeUnits`, `minimizeToTray`). Find 3.x's zoom key name in `electron/zoom.cjs` and settings.js and use it. `rest` is `#[serde(flatten)]`.
  - `pub fn settings_path() -> PathBuf`: `UNREVO_SETTINGS_PATH`, else `%APPDATA%\Prune\settings.json`.
  - `pub fn load(path: &Path) -> Settings`: never panics.
  - `pub fn save(path: &Path, s: &Settings) -> std::io::Result<()>`: writes a temp file in the same folder, then renames it, like 3.x.
  - `pub fn effective_theme(s: &Settings) -> ThemeChoice`

- [ ] **Step 1: Write failing tests:**
  - `round_trip_keeps_every_3x_key`: load the fixture, save to a temp path, reload as `serde_json::Value`, and assert equality with the fixture's Value.
  - `invalid_values_normalize_like_3x`: `theme:"solarized"` gives System, `sizeUnits:"x"` gives Windows, a non-bool `themeSynced` gives false, and a language outside the 40 gives `"en"`.
  - `missing_file_gives_defaults`
  - `corrupt_file_gives_defaults_and_is_not_rewritten_by_load`: the file bytes are unchanged after `load`.
  - `unsynced_theme_is_system`: `{theme:"dark"}` without `themeSynced` gives `effective_theme == System`; with `themeSynced: true` it gives Dark.
- [ ] **Step 2:** `cargo test -p prune-core --test settings`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. Normalization runs during deserialization (custom `Deserialize`, or `#[serde(deserialize_with)]` per field), so a bad value never fails the whole file.
- [ ] **Step 4:** Tests pass. Run `cargo deny check licenses`.
- [ ] **Step 5: Commit** `feat(native): settings.json read/write compatible with 3.x`

### Task 3: Fluent catalog generated from 3.x

**Files:**
- Create: `native/tools/convert-catalog.mjs`. It imports `frontend/src/i18n/catalog.js` (CATALOG, extras already merged) and `frontend/src/i18n/cleaner/<lang>.js`, and writes `native/crates/prune-core/locales/<lang>/prune.ftl` and `cleaners.ftl` for all 40, plus `native/crates/prune-core/locales/needs-review.json`.
- Create: `native/crates/prune-core/src/i18n.rs` and `build.rs`. `build.rs` embeds the 80 files with `include_str!` through a generated table.
- Test: `native/crates/prune-core/tests/i18n.rs`

**Interfaces:**
- Produces:
  - `pub const LANGUAGES: [&str; 40]`.
  - `pub struct Catalog`, with `impl Catalog { pub fn load(lang: &str) -> Catalog; pub fn t(&self, key: &str, args: &[(&str, FluentValue)]) -> String }`.
  - `key` is 3.x's dotted path (`"nav.reportBug"`). The Fluent id is the path with `.` replaced by `-`.
  - Unknown key: returns the key itself, plus a debug-only log line.
  - Unknown language: falls back to `en`.
  - Uses `FluentBundle::new_concurrent`, with `set_use_isolating(false)` for Latin. Keep isolating marks for `ar`, `he` and `ps`.

**Converter rules (the part a builder can't infer):**
- A string becomes `id = text`. Fluent special characters (`{`, `}`, leading `[`, `*` or `.`) are escaped with string literals. Multi-line text uses Fluent's indented continuation.
- A function: read its parameter names from `fn.toString()`. Call it with sentinels (`"" + name + ""`) and replace each sentinel with `{ $name }`.
  - Call it again with each numeric probe 0, 1, 2, 3, 5, 11, 21, 22, 101 for every parameter. If any output differs from the sentinel template with the number substituted, or if a call throws, the key goes into `needs-review.json` (`{ "lang": [keys] }`) and gets the sentinel template plus a `# needs-review` comment above it.
  - The converter never invents plural rules.
- It fails, exit 1, if two keys map to the same id or if any language misses an `en` key.
- Print the summary `converted N strings, M functions, R need review`.

- [ ] **Step 1: Write failing Rust tests:**
  - `every_language_has_every_en_key` (both files)
  - `plain_string_matches_3x` (`t("nav.dashboard")` is `"Dashboard"` in en and the 3.x value in de and el)
  - `placeable_args` (`t("windowsToolsV1.loadError", &[("reason", "boom".into())])` gives `"Couldn't list the tools: boom"`)
  - `unknown_language_falls_back_to_en`
  - `unknown_key_returns_key`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Write the converter, run `node native/tools/convert-catalog.mjs`, and commit its output files (they are source from now on, and 3.x's catalog is frozen).
- [ ] **Step 4:** Implement `i18n.rs` and `build.rs`. The tests pass.
- [ ] **Step 5:** Hand-fix the `needs-review` entries in the `nav`, `settings.tabs`, `settings.language` and `common` namespaces only (what Phase 1 shows), rewriting them as Fluent selects with CLDR plural categories. Remove each one from `needs-review.json`. Add a test, `phase1_namespaces_have_no_needs_review`, that reads the json.
- [ ] **Step 6: Commit** `feat(native): Fluent catalog generated from the 3.x catalog`

### Task 4: Theme tokens and the operating-system theme

**Files:**
- Create: `native/crates/prune-app/src/theme.rs`
- Create: `native/crates/prune-app/assets/fonts/` (Geist and JetBrains Mono woff2→ttf copies from `frontend/node_modules/@fontsource/*`, OFL-1.1, with their licence files)
- Test: `native/crates/prune-app/tests/theme.rs`

**Interfaces:**
- Produces:
  - `pub struct Palette { pub bg_base: Color, pub bg_panel: Color, pub text_primary: Color, pub text_secondary: Color, pub text_muted: Color, pub accent_primary: Color, pub accent_primary_soft: Color, pub accent_primary_deep: Color, pub accent_ink: Color, pub danger: Color, pub danger_soft: Color, pub warning: Color, pub success: Color, pub border_subtle: Color, pub border_hover: Color, pub control_border: Color, pub surface_subtle: Color, pub surface_hover: Color, pub surface_strong: Color, pub scrim: Color }`
  - `pub fn palette(dark: bool) -> &'static Palette`
  - `pub fn os_prefers_light() -> Option<bool>`: reads `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\AppsUseLightTheme`.
  - `pub fn is_dark(choice: ThemeChoice, os_light: Option<bool>) -> bool`: System with an unknown OS setting is dark, the 3.x default.

- [ ] **Step 1: Write the failing test `palette_matches_index_css`.** It parses `../../../frontend/src/index.css`: the `:root` block for dark, `:root[data-theme='light']` for light. For each Palette field, it asserts that the CSS custom property of the same name (`bg_base` is `--bg-base`) equals the Rust colour, hex or rgba, within 1/255. Also add `is_dark_rules` covering all six combinations.
- [ ] **Step 2:** Run: FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5: Commit** `feat(native): theme palettes read from 3.x tokens`

### Task 5: Window shell, title bar, nav rail and empty screens

**Files:**
- Create: `native/crates/prune-app/src/{main.rs, app.rs, screen.rs, rail.rs, titlebar.rs, single_instance.rs, zoom.rs}`
- Test: `native/crates/prune-app/tests/shell.rs`, plus unit tests in `rail.rs` and `zoom.rs`

**Interfaces:**
- Consumes: `settings::{load, save, settings_path, effective_theme}`, `i18n::Catalog`, `theme::{palette, is_dark, os_prefers_light}`
- Produces:
  - `pub enum Screen { Dashboard, DiskMap, Applications, Quarantine, Startup, Duplicates, DeepClean, Settings }`, with `Screen::ORDER: [Screen; 8]` and `Screen::key(&self) -> &'static str` (3.x's ids above).
  - `pub enum Message { Navigate(Screen), RailHover(bool), Zoom(ZoomAction), Tick(Instant), … }`
  - `pub struct App` with `pub fn update(&mut self, m: Message) -> Task<Message>` and `pub fn view(&self) -> Element<Message>`.
  - `rail::mark_offset(screen: Screen, rail_height: f32) -> f32`: 24 + index×52, and Settings at `rail_height - 20`.

**Decisions:**
- **Title bar:** the native frame stays, so Windows snap layouts and the caption buttons keep working. The caption is coloured with `DwmSetWindowAttribute`, using `DWMWA_USE_IMMERSIVE_DARK_MODE` and `DWMWA_CAPTION_COLOR` = `bg_base`, so it looks like 3.x's hidden title bar.
- **Rail:** 72 px collapsed, 200 px expanded on hover or keyboard focus. Width animates over 320 ms with cubic-bezier(0.4, 0, 0.2, 1), delay 100 ms on leave and 0 on enter. Labels fade in. The marker (12 px-inset soft tint plus a 3×20 px pill) slides over 300 ms with the same curve.
  - Animations tick only while something is moving; no subscription runs otherwise. This is what makes idle CPU 0%.
  - Reduced motion (`SPI_GETCLIENTAREAANIMATION` off) jumps straight to the end state.
- **Keyboard:** port `frontend/src/lib/shortcutMatch.js` exactly. Ctrl+1 to Ctrl+8 go to `Screen::ORDER` (Settings is 8). Ctrl+, opens Settings from anywhere, including text fields. Every other chord is ignored while a text field has focus, and Ctrl+Alt is always ignored (AltGr). Tab/Shift+Tab move focus with a visible focus ring. Zoom: Ctrl+=, Ctrl+−, Ctrl+0, and Ctrl+wheel. Port the steps and limits from `electron/zoom.cjs`, and save to the same settings key.
- **Single instance:** a named mutex `Local\Prune-4-single-instance`, plus a named pipe. A second process sends its args to the first (`--shred`, `--find-program` later) and exits 0. The first restores and focuses its window.
- **Startup trace:** `PRUNE_TRACE_STARTUP=1` makes the app print `first-frame-ms=<n>` to stderr once the first frame is presented.
- **Screens:** each shows its translated title only, using `nav.*`.

- [ ] **Step 1: Write failing tests:**
  - `navigate_sets_screen`
  - `shortcuts_match_3x`: port the cases in 3.x's `shortcutMatch.test.js`, including Ctrl+8 to Settings, Ctrl+, in a text field, other chords in a text field ignored, and Ctrl+Alt ignored.
  - `mark_offset_values`: Dashboard 24, Applications 128, Settings at height−20.
  - `zoom_steps_match_3x`: copy the expected values from 3.x's `zoom.test.cjs`.
  - `idle_has_no_subscription` (after settling, `App::subscription()` is `Subscription::none()`)
  - `second_instance_signals_first` (spawn the built binary twice under a temp `UNREVO_SETTINGS_PATH`; the second exits 0 within 2 s and the first logs `focus-request`)
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Then run `cargo clippy -- -D warnings`.
- [ ] **Step 5:** Run `cargo run -p prune-app` once and check by eye that the rail expands, the marker slides, the title bar is dark, and Ctrl+2 goes to Disk Map.
- [ ] **Step 6: Commit** `feat(native): window, title bar, nav rail and screens`

### Task 6: Render screens to PNG

**Files:**
- Modify: `native/crates/prune-app/src/main.rs` (argument parsing)
- Create: `native/crates/prune-app/src/render.rs`
- Test: `native/crates/prune-app/tests/render.rs`

**Interfaces:**
- Produces the CLI: `Prune.exe --render-screens <dir> [--theme dark|light] [--lang <code>] [--scale <f32>] [--rail expanded|collapsed]`. It writes `<dir>/<screen>-<theme>-<lang>-<scale>.png` for all 8 screens and exits 0. It never touches the real settings file: it uses defaults plus the flags.
- Use iced's window screenshot task to get RGBA, encode it with the `png` crate, then exit. If the window must exist, it is created hidden or off-screen.

- [ ] **Step 1: Write failing tests:**
  - `renders_all_screens`: 8 files, each at least 900×560 at scale 1, and not a single flat colour.
  - `renders_non_latin`: `ar`, `th`, `ja` and `el` each produce a PNG whose title region holds at least 2 distinct non-background colours, which catches tofu boxes only partly. Also run the font-fallback assertion from `fontdb`: the title glyphs resolve to a real font.
  - `scale_2_doubles_size`
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Write the PNGs to `native/target/screens/` (gitignored) for review.
- [ ] **Step 5: Commit** `feat(native): render screens to PNG for checking without a person`

### Task 7: Tray and minimize to tray

**Files:**
- Create: `native/crates/prune-app/src/tray.rs`
- Test: unit tests in `tray.rs`

**Interfaces:**
- Consumes: `settings.minimize_to_tray`, `Catalog`
- Produces:
  - `pub enum TrayCommand { Open, Quit }`
  - Tray menu items: "Open Prune" and "Quit". These are English-only, as in 3.x (`backend/src/lib/trayManager.js` hardcodes them), because translating them would be a new feature. Quick Clean comes in Phase 3, and no menu item exists until it works.
  - Left click opens.
  - Closing the window hides it to the tray when `minimize_to_tray` is on. Otherwise closing quits.
  - Icon: `electron/build/icon.ico`.

- [ ] **Step 1: Write failing tests:**
  - `close_hides_when_minimize_to_tray`
  - `close_quits_otherwise`
  - `menu_labels_match_3x` ("Open Prune", "Quit")
- [ ] **Step 2:** FAIL. **Step 3:** Implement (tray-icon on the UI thread's event loop). **Step 4:** PASS. Check the tray by eye once.
- [ ] **Step 5: Commit** `feat(native): tray icon and minimize to tray`

### Task 8: Measuring tool and the 3.2 baseline

**Files:**
- Create: `native/tools/measure/` (Rust bin `prune-measure`)
- Create: `native/perf/baseline-3.2.0.json` (output) and `native/perf/README.md` (method)

**Interfaces:**
- `prune-measure --exe <path> [--runs 5] [--settle 30] [--out <file.json>]`:
  - launches the exe;
  - records the time from process start until the first visible top-level window owned by its process tree, found with `EnumWindows` + `IsWindowVisible` polled every 5 ms;
  - after `--settle` seconds, records the working set (`GetProcessMemoryInfo`, summed over the process tree) and CPU% over a 10 s window (`GetProcessTimes`, summed);
  - kills the tree;
  - repeats `--runs` times, plus one discarded warm-up;
  - writes `{exe, version, runs:[{first_window_ms, working_set_mb, cpu_pct}], median:{…}}`.

  The same method is used for 3.2 and 4.0. The spec's "first frame" for 4.0 is also read from `PRUNE_TRACE_STARTUP`.

- [ ] **Step 1:** Unit-test the median and JSON shape (`median_of_odd_and_even`, `json_has_fields`). Run: FAIL, then implement, then PASS.
- [ ] **Step 2: Measure 3.2.** It has to run in the real session, not from my sandboxed shell, which sees a virtualized copy of the system. Write `native/perf/run-baseline.cmd` that runs `prune-measure --exe "%LOCALAPPDATA%\Programs\Prune\Prune.exe"` (find 3.x's real install folder first; per-user is the default) with its output going to `native/perf/baseline-3.2.0.json`. Run it through a one-shot scheduled task (Interactive, Limited), then unregister the task.
  - **Ask the owner first:** it closes and relaunches their Prune 5 times.
- [ ] **Step 3:** Run the same against `native/target/release/Prune.exe` and save `native/perf/phase1-4.0.json`. Put both medians in `native/perf/README.md`.
- [ ] **Step 4: Commit** `perf(native): measuring tool, 3.2 baseline and the Phase 1 numbers`

---

**Phase 1 is done when:**
- All tasks are committed.
- `cargo test --workspace`, `cargo clippy -- -D warnings` and `cargo deny check licenses` are green in CI.
- The 16 PNGs (8 screens × dark/light, en) have been shown to the owner alongside 3.2 screenshots.
- The owner has seen the Task 8 numbers.

Then write the Phase 2 (Applications) plan.
