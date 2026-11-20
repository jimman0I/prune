# Prune 4.0 roadmap

**Spec:** `docs/superpowers/specs/2026-11-20-prune-4-native-rust-design.md` (approved 2026-11-20).

The rewrite covers several independent subsystems, so it is split into one plan per phase. Each phase ends
with working, tested software. Only the next phase's plan is written in detail. Each later plan is written when
its phase starts, against what the earlier phases actually produced.

| # | Plan | Delivers | Depends on |
|---|---|---|---|
| A | `2026-11-20-prune-3-2-1.md` | 3.2.1: Electron 44.11.5, and the theme choice saved in settings.json | none |
| 1 | `2026-11-20-prune-4-phase-1-foundation.md` | `native/` workspace; settings compatible with 3.x; Fluent catalog from the 3.x catalog; theme tokens; window, title bar, nav rail, empty screens; render-to-PNG; tray; single instance; measuring tool plus the 3.2 baseline | A merged (needs `themeSynced`) |
| 2 | Applications (later) | Program list from the registry, Store, Chocolatey and per-user sources; icons, sizes, signatures; uninstall (own uninstaller, silent modes, wizard answering); leftovers plus Quarantine plus backups; Hunter; install monitor and traces; hide; Properties | 1 |
| 3 | Deep Clean (later) | cleaners.json engine and every action kind (delete, sqlite, registry, json, cookies, deep scan); removal modes; overwrite, Shred, free-space wipe; Junk files; custom rules and import; scheduled clean plus report | 1, Quarantine from 2 |
| 4 | Disk Map + Duplicates (later) | NTFS MFT fast scan plus slow walk; treemap; largest files; saved scans and compare; export; Duplicates | 1 |
| 5 | The rest (later) | Startup, Drive health (SMART/NVMe), Windows tools, Dashboard, Quarantine screen, Settings screens, What's-new 4.0, Report a bug, command line, Explorer verbs | 2-4 |
| 6 | Ship (later) | NSIS installer and upgrade path from 3.x (same latest.yml contract, both install modes, re-pointing task, verbs, Run key and uninstall entry); own updater; CI release; performance gate against the baseline; remove the Electron tree in 4.1 | 1-5 |

Rules that hold across every phase:
- No new features. Each phase's screens are checked against 3.2's screens with rendered PNGs, plus the owner's
  screenshots of the real window.
- A phase's i18n keys must have no `needs-review` entries left before the phase is done (see Phase 1, Task 3).
- Every 3.x security or crash fix released while 4.0 is being built is ported in the phase that owns that code.
