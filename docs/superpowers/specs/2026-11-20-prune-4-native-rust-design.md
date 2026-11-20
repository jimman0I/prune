# Prune 4.0: native Rust rewrite

Status: design, awaiting approval (2026-11-20).

## Why

Prune 3.x is Electron with a Node/Express backend loaded in-process and a React/Vite/Tailwind UI. It works,
but it ships a whole Chromium and Node (126 MB installer), idles at browser-sized memory, and does most
Windows work by spawning PowerShell (45 backend services). The owner wants Prune to be as fast and light as
possible. They chose a full native Rust app with a native Rust UI over Tauri.

## What the owner decided

- **Prune 4.0 replaces 3.x.** It reaches users through 3.x's own auto-update, so it ships only when it does
  everything 3.2 does. There is no separate preview product.
- **It looks like Prune does today:** the same dark custom design, nav rail, cards, accent and motion, not
  stock Windows controls.
- **UI toolkit: iced** (MIT). Chosen over GPUI (best match for the Tailwind styling but thin docs and an unstable
  API) and egui (has screen-reader support but hardest to make look like Prune). Slint was ruled out because
  its licensing (GPL or commercial) conflicts with SignPath Foundation's rule that every component be
  OSI-licensed without commercial dual-licensing. Prune has applied to SignPath.

- **3.x is frozen.** Only security and crash fixes ship in 3.x (starting with 3.2.1, which carries the Electron
  44.11.5 update), and each one is ported into 4.0 too. New features wait for 4.0 or 4.1, so the bar stays
  "3.2.0 plus those fixes".

## Goals

1. Feature parity with 3.2.0: every screen, setting, dialog, tray behaviour, command-line command, Explorer
   menu verb, scheduled clean, and all 40 languages. The README and CHANGELOG through v3.2.0 are the feature
   list. 3.x's tests are the behaviour reference.
2. Measurably faster and lighter than 3.2 on the same machine, with targets checked before release:
   - first window painted in under 300 ms from launch;
   - idle working set under 60 MB, and 0% CPU when idle with no animation;
   - installer under 25 MB;
   - Applications list ready at least 2x faster than 3.2, and leftover scans and Deep Clean scans no slower than
     3.2 (measure 3.2 first, on this PC, and record the baseline in the repo).
3. A seamless upgrade from 3.x. Settings, Quarantine batches, registry and task backups, install traces, saved
   Disk Map scans, stats and hidden programs all carry over unchanged, and everything in Quarantine stays
   restorable.

## Non-goals

- New features during the rewrite. Bugs found in 3.x behaviour are fixed only when the fix is obvious; otherwise
  they are matched and logged.
- Linux or macOS.
- Any webview, Tauri, or embedded browser engine.

## Anti-goals (a failure even if it "works")

- Losing or orphaning anything a 3.x user has in Quarantine or backups, or resetting their settings.
- Any feature silently missing, or a screen visibly worse than 3.2.
- Slower than 3.2 at anything a user times (startup, opening Applications, a scan, a clean).
- New network traffic. The only outbound requests stay the opt-in update check and update download.
- Any dependency that is not OSI-licensed, or that is commercially dual-licensed. That would endanger SignPath.

## Constraints (standing project rules)

- MIT project. Dependencies are MIT, Apache-2.0, BSD, ISC, Zlib or similar only; check each one on adding it.
- Never write the names of competing tools anywhere: code, comments, UI, docs, commits.
- No AI attribution in commits or PRs. Work on master. Push only when the owner says so.
- No emoji in the app UI (line icons in the app's style). No hover-only tooltips as the sole carrier of information.
- Never launch a browser with profile arguments (an earlier version tripped a Defender behaviour detection).
  Report a bug may open the default browser with the issue URL, as 3.x does.
- Destructive actions go through Quarantine or another undoable path, exactly as in 3.x.
- I cannot view the native window in the browser preview, and computer-use control of Prune.exe is not granted.
  Verification has to come from tests, from the app rendering its own screens to images, and from the owner's
  screenshots.

## Architecture (decided)

- **Single Rust workspace** in `native/` inside this repo, on master, beside the 3.x code. 3.x stays buildable
  and releasable from master until 4.0 ships; at 4.0 the CI release job switches to the native build and the
  Electron tree is removed in a follow-up.
- **Crates (shape, refinable by the builder):** `prune-core` (all Windows logic, no UI: programs, uninstall,
  leftovers, quarantine, cleaner rules and actions, disk scan including the NTFS MFT reader, duplicates,
  startup, drive health, settings, stats, i18n), `prune-app` (the iced UI), and `prune-cli` (the command line).
  The UI calls core directly in-process: no HTTP server, no IPC.
- **Windows access through the `windows` crate** (and small helpers like `winreg`), not PowerShell. PowerShell
  stays only where Windows offers no API worth binding, and each such use is listed in the code.
- **Heavy work off the UI thread** (scans, cleans, hashing, MFT parsing) on worker threads with cancellation,
  streaming progress to the UI through iced subscriptions or tasks.
- **Data reuse:** the 40-language catalog (`frontend/src/i18n`) and `backend/src/data/cleaners.json` are
  converted at build time into data the Rust binary embeds. Translators keep one source of truth during the
  transition. The same i18n keys and interpolation rules are kept.
- **Same on-disk formats and locations:** `%APPDATA%\Prune` (settings.json, quarantine\ with manifest.json,
  registry-backups\, task-backups\, install-traces\, disk-scans\, stats.json, scheduled-clean-report.json,
  folder-sizes.json).
- **Upgrade path:** 4.0 ships as an NSIS installer named and listed in latest.yml exactly the way 3.x's
  electron-updater expects. It installs into the same per-user location and removes the Electron files. It
  re-points everything 3.x registered at the new binaries: the scheduled-clean task (today `prune-cli.cmd clean
  --preset recommended --report`), the Explorer verbs (`Prune.exe --shred "%1"`, `--find-program "%1"`), the Run
  key, and the uninstall entry. 4.0 has its own update check reading the same latest.yml.
- **Release:** the same GitHub Actions flow (tests, build, checksums, attestation, draft release), so SignPath
  signing can be added the same way.

## Calls made while writing this (owner to check)

- **Preferences kept only in the browser storage carry over through 3.2.1.** In 3.x the theme, plus copies of the
  language and size-unit choices, live only in the embedded browser's storage, which 4.0 can't read. 3.2.1
  writes them into settings.json, so 4.0 reads plain files only. View state (collapsed groups, the last
  Settings tab, Duplicates' recent folders, Disk Map's scan mode and fold state, the cached Deep Clean scan)
  is allowed to reset.
- **Rolling back to 3.2.x must keep working.** Through 4.0.x, everything 4.0 writes stays readable by 3.2,
  including Quarantine batches 4.0 creates, which must stay restorable from 3.2. No format changes that 3.2
  would reject. The Electron browser folders in `%APPDATA%\Prune` (Cache, GPUCache, Local Storage and so on)
  are left alone until 4.1, then removed.
- **Both install modes stay.** The 4.0 installer keeps 3.x's "just me / all users" choice and custom folder.
  An upgrade happens in place in whatever mode and folder 3.x used. For an all-users install, each user's
  own registrations (Run key, Explorer verbs, scheduled task) are re-pointed the next time that user opens
  Prune.
- **Translations move to Fluent (`.ftl`, Mozilla's format; the `fluent` crates are Apache-2.0/MIT).** About
  8,240 catalog entries are JavaScript functions (plural helpers, conditional text), so a straight data
  conversion is impossible. A one-time conversion script plus hand-fixing produces Fluent files with proper
  per-language plural rules. 3.x keeps its JS catalog, which is frozen. After 4.0 the Fluent files are the
  only source. A test checks that every language has every key, as `catalog.test.js` does today.
- **How the targets are measured.** All are on this PC, warm start (second launch after boot), same Windows
  session as the 3.2 baseline:
  - "First window": process start until the first frame is presented.
  - "Applications ready": opening the screen until every row shows name, icon and size. Signatures can still
    be loading.
  - "Idle": working set and CPU 30 s after settling. The window is open on the Dashboard, and checked again on
    Applications with every icon loaded. The 60 MB limit applies to the Dashboard; Applications may use up
    to 100 MB.
- **No staged rollout.** 4.0 is published to everyone at once when the owner says publish, because a separate
  preview was ruled out. A percentage rollout through latest.yml stays available if the owner asks for it.

## Left to the builder

- Exact crate boundaries, module layout, and which helper crates to use (license-checked).
- How the long lists (210+ programs, file lists, Disk Map's largest files) are virtualized in iced.
- The custom widgets: nav rail with sliding marker, checkbox tree, treemap, toasts, dialogs, charts. Match 3.x's
  look and motion; reduced-motion respected.
- Test strategy per crate. Core logic should port 3.x's behaviour tests, and UI logic should be tested through
  iced's update/state functions. A debug flag renders every screen to PNG so screens can be checked without
  a person.
- The order of work. Suggested: foundation (window, theme, rail, i18n, settings, tray, installer, updater and
  upgrade path) first, then Applications, Deep Clean, Disk Map and Duplicates, Startup, Drive health, Windows
  tools, Dashboard and CLI, and last, measuring against the targets.

## Known risks

- **Screen readers:** iced has no screen-reader support today as far as we know. Keyboard navigation and visible
  focus must still match 3.x. Screen-reader support is a known regression, and gets added when iced gains
  accessibility support.
- **Rewrite size:** about 60k lines of JS app code plus about 6.5k tests. Estimated at 4 to 8 weeks of sessions.
- **iced is pre-1.0:** pin the version and avoid relying on undocumented internals.
