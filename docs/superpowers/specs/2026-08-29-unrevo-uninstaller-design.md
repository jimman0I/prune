# unrevo — Phase A design: real uninstall + leftover scan

## What this is

A real, working Windows uninstaller utility inspired by Revo Uninstaller Pro,
built as a sibling app to Re:Route (`triclaude-web`) under
`C:\Games\shortcuts\lol\unrevo`, and built USING Re:Route itself — a
continuation of Re:Route's dogfooding sessions, applied to a brand-new
project instead of Re:Route's own codebase.

Not a UI mock. It enumerates real installed programs, runs their real
uninstallers, and scans for and removes real leftover files/registry
keys/scheduled tasks on the user's own machine, through the user's own
explicit, per-item confirmed actions in the app.

## Scope

**v1 (Phase A, this spec):**
- Program list — enumerate installed programs (name, publisher, version,
  size, install date, icon) from the registry, searchable/sortable.
- Standard uninstall — run each program's own registered uninstaller.
- Leftover scan — after uninstall, heuristically find orphaned files,
  registry keys, and scheduled tasks matching the program's name/publisher.
- Forced removal — review the scan results (grouped, checkbox-selectable)
  and delete what's confirmed, with a real recovery mechanism first.

**Committed future phases (not this spec):**
- Phase B — Hunter mode: snapshot the system before an install, diff after,
  so a future removal of that exact install is complete rather than
  heuristic.
- Phase C — Startup/autorun manager: list and toggle Run-key/Startup-folder/
  scheduled-task entries. Unrelated to uninstalling per se.

**Explicitly deferred, not yet scheduled:** Dashboard/health-score overview,
Disk Map (treemap visualization), Smart Cleanup (junk/cache cleaner). These
exist as full page concepts in a reference prototype ("Prune," see Visual
system below) but are out of Phase A's scope on purpose — revisit only when
asked for.

**Explicitly out of scope for Phase A:** Windows Store/UWP apps (different
enumeration mechanism — `Get-AppxPackage`, not the registry Uninstall keys
this phase reads).

## Visual system

The user supplied a real React prototype (a webpack dev bundle, "Prune" —
Dashboard/Applications/Disk Map/Smart Cleanup/Settings) with a complete,
distinctive dark "obsidian + cyan" design system. unrevo adopts this system
wholesale for Phase A's screens (Program list, program detail, uninstall
flow, leftover review) — not the extra pages, per Scope above.

**Tokens** (extracted from the reference's real CSS, not re-derived):
```css
--bg-obsidian: #09090b;   --bg-zinc: #18181b;   --bg-zinc-hi: #1f1f23;
--border-subtle: #27272a;
--text-primary: #fafafa;  --text-secondary: #a1a1aa;  --text-muted: #71717a;
--accent-cyan: #06b6d4;   --accent-cyan-glow: rgba(6,182,212,0.35);
--danger: #ef4444;  --warning: #f59e0b;  --success: #10b981;
```
- Fonts: **Geist** (sans, UI text, weights 300–800) + **JetBrains Mono**
  (technical/data text — sizes, versions, commands, file paths).
- Subtle grain texture overlay on the app root (opacity 0.035,
  mix-blend-mode: overlay) for a premium, non-flat feel.
- Glassmorphism (`.glass`/`.glass-strong`) for modals and elevated panels —
  `backdrop-filter: blur(16-24px) saturate(140-160%)`.
- Primary buttons: cyan gradient (`#0891b2` → `#06b6d4`), inset highlight +
  glow shadow, 1px lift on hover.
- Nav items: 2px cyan left-bar indicator, `scaleY` transform for the active
  state, not a background fill.
- Ambient background: two very faint radial gradients (cyan top-left,
  purple bottom-right) — not a visible gradient background, a texture.

The reference's own copy of the Applications page (uninstall flow: "Running
native uninstaller" with the live `MsiExec.exe /X{GUID} /qn` command shown,
then "Scanning for leftovers" / "Checking filesystem, registry & scheduled
tasks…", then grouped, checkbox-selectable results) is the UX reference for
Phase A's uninstall + leftover-scan flow below — not just the palette.

The full "Prune" bundle is preserved at `docs/superpowers/specs/reference/
prune-bundle.js` (see Reference material) for whoever implements this to
read directly rather than working from this summary alone.

## Architecture

Same three-part shape as Re:Route, so Re:Route (building this) is working
in a codebase shape it already knows:

- `backend/` — Express + Node, ESM. System queries go through PowerShell
  (`child_process`), not a native npm module — avoids the Electron-ABI/
  native-rebuild pain already documented as a gotcha in Re:Route's own
  CLAUDE.md for other projects. `services/powershell.js` is the ONE
  chokepoint every other service shells through (exec, timeout, JSON-parse
  fallback) — mirrors Re:Route's own "provider calls go through the
  failover ladder, don't call a provider directly" convention.
- `frontend/` — React + Vite, same build/dist-committed pattern as
  Re:Route's `frontend/dist`.
- `electron/` — the shell, same in-process-backend pattern
  (`main.cjs` `await import`s the backend entry, not a spawned child).

### File layout

```
unrevo/
  backend/src/
    services/
      powershell.js       # shared exec-and-parse-JSON helper (the chokepoint)
      programs.js          # enumerate installed programs (3 registry hives)
      uninstall.js          # run a program's real uninstaller, stream progress
      leftoverScan.js        # heuristic scan: files, registry, scheduled tasks
      quarantine.js           # move-to-quarantine + .reg export + restore
      restorePoint.js          # best-effort Checkpoint-Computer wrapper
    routes/
      programs.js, uninstall.js, leftovers.js, quarantine.js
  frontend/src/
    components/
      ProgramList.jsx, ProgramDetail.jsx, UninstallModal.jsx,
      LeftoverReview.jsx, QuarantinePanel.jsx
  electron/
    main.cjs
  docs/superpowers/specs/
    2026-08-29-unrevo-uninstaller-design.md   # this file
    reference/prune-bundle.js                  # the source reference material
```

## Program enumeration

`services/programs.js` shells to PowerShell, reading three registry
locations and merging the results:
- `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*` (64-bit,
  machine-wide)
- `HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*`
  (32-bit apps on 64-bit Windows)
- `HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*` (per-user)

Each command runs via `Get-ItemProperty | Select DisplayName, Publisher,
DisplayVersion, InstallDate, EstimatedSize, UninstallString, ... |
ConvertTo-Json`, parsed by `powershell.js`. Entries with no `DisplayName`
(there are always a few — patches, redistributables) are filtered out.

## Uninstall + leftover-scan flow

1. User clicks Uninstall on a program row → confirm dialog names the
   program and shows its size.
2. Backend runs the program's real, registered `UninstallString` — MSI apps
   get `MsiExec.exe /X{GUID} /qn` (silent), EXE-based installers run
   whatever string is registered as-is (no universal silent flag exists).
   The modal shows "Running native uninstaller" with the live command.
3. On exit — **regardless of exit code** (uninstallers routinely lie) — the
   backend runs the leftover scanner. Modal shows "Scanning for leftovers" /
   "Checking filesystem, registry & scheduled tasks…".
4. The scanner searches:
   - Common install roots for folders/files matching the program's name or
     publisher: `Program Files`, `Program Files (x86)`, `%APPDATA%`,
     `%LOCALAPPDATA%`, `%PROGRAMDATA%`, `Start Menu\Programs`.
   - `HKCU`/`HKLM\Software` for orphaned keys matching the same name.
   - Scheduled Tasks registered by the program.
5. Results render grouped (Files / Registry / Scheduled Tasks), each item
   checkbox-selectable, all checked by default.
6. "Remove selected" → quarantine + `.reg`-export backup (below) → the
   actual delete.

This is a heuristic, name/publisher-match scan — not a full before/after
system snapshot. That fuller mechanism is Phase B (Hunter mode),
deliberately deferred.

## Safety & recovery

System Restore alone is not reliable protection: Windows throttles
`Checkpoint-Computer` to one checkpoint per 24h by default, so a user's
second uninstall in a day would silently get zero protection from it. The
real safety net is quarantine + `.reg` export, which never gets throttled:

- Before any real delete, backend creates
  `%LOCALAPPDATA%\unrevo\quarantine\<timestamp>-<program>\`.
- Every file slated for deletion is **moved** there (atomic move, not
  copy-then-delete), with its original path preserved as metadata for
  restore.
- Every registry key slated for deletion is exported via `reg export` to
  its own `.reg` file in that same folder *before* `reg delete` runs
  (`reg export` requires a real disk file — it has no stdout convention —
  and one file per key avoids invalidly concatenating multiple `.reg`
  headers into one); restoring re-imports each of a batch's `.reg` files.
- A "Recently removed" panel (inside Settings for Phase A, not its own nav
  item) lists quarantine folders with a Restore button.
- Quarantine folders are not auto-deleted in Phase A — a cleanup pass is a
  reasonable Phase B/C addition.
- `Checkpoint-Computer` still fires alongside this as a best-effort bonus —
  if it succeeds, extra protection; if throttled or disabled, we don't
  block or warn loudly, since quarantine+.reg is the real net regardless.

## Error handling

- `powershell.js` calls get a timeout + one retry (matching Re:Route's own
  router-timeout precedent). A hung query fails loud with a clear message,
  never hangs the UI silently.
- Uninstaller exit codes are advisory, not authoritative — the leftover
  scan always runs regardless of exit code; the code itself is surfaced to
  the user as context ("exited with code 1602 — may not have completed"),
  never trusted outright.
- UAC/elevation: unrevo does not run elevated by default. If a specific
  uninstaller visibly needs admin (an access-denied signal from the plain
  run), that one operation re-runs via `ShellExecute` with `runas`,
  triggering a real Windows UAC prompt — never a blanket "run as admin."
- One operation at a time — the UI disables Uninstall on other rows while
  one is in flight. A queue is a later-phase nicety, not Phase A.
- A leftover-scan sub-check failing (e.g. one registry query errors) shows
  "couldn't check this" for that section without killing the rest of the
  scan — same partial-results-over-total-failure philosophy Re:Route's own
  visual-check skip already uses.

## Testing

The one genuinely new risk vs. Re:Route: tests that touch the real
registry/filesystem could damage real state on the dev machine.

- Parsing/matching/planning logic (PowerShell JSON → program list,
  leftover-match heuristics, quarantine planning) is pure, unit-tested
  against fixture JSON — no real `powershell.exe` calls in these tests.
  Matches Re:Route's own "pure functions extracted and unit-tested"
  convention (`lib/*.js` next to their `*.test.js`).
- `powershell.js` is the only thing ever mocked.
- Quarantine move/`.reg`-export logic is tested against a real
  `os.tmpdir()` scratch directory — real I/O, zero risk to the real
  machine, same pattern as Re:Route's `instructions.test.js`.
- Registry tests that need to exercise *real* `reg.exe` run against a
  throwaway subtree (`HKCU\Software\unrevo-test\...`), created and torn
  down per test — real exec, sandboxed target, never near the real
  Uninstall keys.
- No automated test ever uninstalls a real program. A manual/live-CDP smoke
  test (matching Re:Route's own "verify in the packaged app" convention)
  uses one deliberately-installed disposable test app.

## Reference material

The user-supplied React prototype ("Prune") this design's visual system and
uninstall-flow UX are drawn from is preserved at
`docs/superpowers/specs/reference/prune-bundle.js` for direct reading during
implementation — components: `App.js`, `Sidebar.jsx`, `Dashboard.jsx`,
`Applications.jsx`, `DiskMap.jsx`, `SmartCleanup.jsx`, `Settings.jsx`,
`mockData.js`. It's a webpack dev bundle (unminified, JSX-transformed, not
raw source) — readable but verbose; grep for `className:` and `children:`
strings to extract structure/copy efficiently rather than reading it
straight through.
