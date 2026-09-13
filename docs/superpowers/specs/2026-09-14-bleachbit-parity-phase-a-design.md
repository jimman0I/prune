# BleachBit-Parity Cleaning Engine — Phase A: Action-Type Foundation, sqlite.vacuum, winreg

## Context

Prune's 2.6.0 backlog item 5 ("full BleachBit-parity rewrite of the cleaning engine") is explicitly the largest item on the list and was sequenced last, as its own multi-session effort. `cleanerRules.js` today is a flat path-list walk-and-delete engine: a rule is a list of paths (or a single shell command), `scanRule` measures what exists, `executeRule` quarantines-or-deletes it. That covers exactly one of BleachBit's real action types.

BleachBit's actual action vocabulary, counted directly from its installed cleaner corpus (`%LOCALAPPDATA%\BleachBit\share\cleaners\*.xml`, GPL, read for factual counts/shapes only — never copied):

```
924 delete            -- Prune already has this
183 sqlite.vacuum      -- compact a DB file in place, reclaim space, delete no data
119 winreg             -- delete a registry key
 51 json               -- remove one key from a JSON prefs file
 23 cookie             -- surgical delete inside a cookie SQLite DB
 34 chrome.*/mozilla.* -- bespoke per-app SQL (history/autofill/favicons/keywords)
  9 xml/ini/office_registrymodifications/process/etc. -- rare, long tail
```

"Full parity" bundles at least four independent subsystems beyond what exists today. This spec covers only the first, highest-value slice: the architectural foundation plus the two action types that are both the biggest real chunk of BleachBit's actual behavior (302 of 1274 actions) and the lowest-risk to add (zero data loss for `sqlite.vacuum`; a narrow, already-proven primitive for `winreg`).

Deferred to later phases, each its own spec when picked up: `json` (Phase B), `cookie` (Phase C), per-app bespoke SQL (Phase D).

## Goals

- A rule can declare a mix of action types (`delete`, `sqlite.vacuum`, `winreg`), not just paths.
- Every one of the 75 existing rules keeps working exactly as it does today, with zero data migration.
- `sqlite.vacuum` and `winreg` are scannable (report a size/count before anything runs) and executable (actually do the thing), following the same guard rules (`skipRecentHours`, `excludeFolders`, `excludeExtensions`, `autoQuarantine`) the existing `delete` action already respects wherever they meaningfully apply.
- New cleaner rules using the new action types can be authored once this ships (not part of this phase's own deliverable, but unblocked by it).

## Non-goals (this phase)

- `json`, `cookie`, and per-app bespoke SQL action types.
- Any change to Disk Map, Settings, or any screen other than Deep Clean's own data/engine layer.
- Undo/backup for a deleted registry key (see "Known gap" below).
- New cleaner rules written using the new action types (a natural follow-up once the engine exists, but not required to consider this phase done).

## Architecture

### Rule shape

A rule may use either shape, and both coexist in `cleaners.json` indefinitely:

**Legacy (all 75 current rules, unchanged):**
```json
{ "id": "discord_cache", "category": "Applications", "name": "Discord Cache",
  "paths": ["%APPDATA%\\discord\\Cache"], "recommended": true }
```

**New (`actions` array, for anything written after this phase):**
```json
{ "id": "chrome_db_compact", "category": "Browsers", "name": "Chrome: compact databases",
  "actions": [
    { "type": "sqlite.vacuum", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\History" },
    { "type": "sqlite.vacuum", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Favicons" }
  ],
  "recommended": true }
```

A `command`-only rule (the two DNS-flush-style rules) becomes `actions: [{ type: "shell", command }]` under the same normalization.

### Load-time normalization

`loadCleanerRules()` gains a `normalizeRule(rule)` step: if a rule already has an `actions` array, it passes through untouched; otherwise one is synthesized from `paths`/`command`:

```js
function normalizeRule(rule) {
  if (rule.actions) return rule;
  if (rule.command) return { ...rule, actions: [{ type: 'shell', command: rule.command }] };
  return { ...rule, actions: [{ type: 'delete', paths: rule.paths }] };
}
```

Every other function in `cleanerRules.js` (and every test) can keep reading `rule.paths`/`rule.command` on a legacy rule if convenient — normalization only adds `actions`, it never removes the fields a rule was written with. This is what makes the migration zero-cost: nothing already in `cleaners.json` needs to change.

### Action dispatch

`scanRule(rule, guards)` and `executeRule(rule, guards)` change from "the rule IS a path list" to "the rule HAS a list of actions": each iterates `rule.actions`, dispatches each action to its handler's own `scan`/`execute` function, and merges the per-action results the same way multiple paths under one rule already sum today (`sizeBytes` and `fileCount` add; `freedBytes` adds; `skipped` concatenates).

One new field on a merged result: `registryKeysRemoved` (a count), alongside the existing `freedBytes`/`fileCount`. Present only when a rule's actions produced one; absent (not zero) otherwise, same "don't print a confident number for something not measured" convention `sizeBytes: null` already follows elsewhere in this codebase.

### New files

```
backend/src/lib/cleanerActions/
  delete.js         -- today's path-walk logic, moved verbatim (no behavior change)
  sqliteVacuum.js    -- new
  winreg.js          -- new
  shell.js           -- today's command-execution logic, moved verbatim
```

Each exports `scan(action, guards)` and `execute(action, guards)`, with the same signature shape across all four files — `cleanerRules.js`'s dispatcher doesn't need to know anything about a specific action type beyond its `type` string.

## `sqlite.vacuum` details

**What it does:** runs `VACUUM;` against a SQLite database file, which rewrites the file to reclaim pages SQLite has internally marked free (deleted rows, old history entries) but never returned to the filesystem. This is real disk space BleachBit already counts as "freed" even though no application data is deleted — a browser's `History` file after months of use is very often 30-50% reclaimable this way.

**Implementation:** shell out to a bundled `sqlite3.exe` CLI via `execFile`, the same pattern this codebase already uses for `reg.exe` (quarantine.js) and PowerShell (registryLeftovers.js, launcher lookups) rather than a native Node module. This matters specifically here: the backend runs *inside Electron's own main process* via `await import(entry)` in `electron/main.cjs`, not as a separate plain-Node child process — so a native module like `better-sqlite3` would need to be compiled against Electron's own ABI (electron-rebuild or equivalent), a real ongoing build-pipeline cost this avoids entirely. `sqlite3.exe` ships as an `extraResource` in `electron-builder.config.cjs`, the same way `icon.png` already does.

**Scan:** stat the file before running anything — `sizeBytes` reported is the file's CURRENT size (an upper bound on what vacuum could reclaim, not a promise), with the same present/accessible/absent three-way `scanRule` already uses for ordinary paths. Actually running `VACUUM` during a scan would be wrong (scan must never mutate anything) — a real reclaim size is only known by executing.

**Execute:** stat before, run `VACUUM;`, stat after; `freedBytes = before - after` (never negative — a vacuum that doesn't shrink the file frees 0, not a negative number). A file that isn't actually a valid SQLite database (or is a database version `sqlite3.exe` can't handle) is skipped with a reason, using the existing `skipped: [{ path, reason }]` shape every other guard already reports.

**Guards:** `excludeFolders`/`excludeExtensions` apply exactly as they do to a `delete` action. `skipRecentHours` applies to the file's own mtime the same way. `autoQuarantine` does **not** apply — there is nothing to quarantine (the file isn't deleted, it's rewritten in place); this is the one guard `sqlite.vacuum` is exempt from, and that exemption is itself worth a one-line comment in the code so it doesn't read as an oversight later.

## `winreg` details

**What it does:** deletes one registry key (and everything under it) from `HKEY_CURRENT_USER`. Every `winreg` action in BleachBit's real corpus targets HKCU — nothing in the phase-A scope needs HKLM, which would additionally require elevation Deep Clean doesn't otherwise ask for.

**Implementation:** reuses `quarantine.js`'s existing `reg.exe delete <key> /f` call and its `isProtectedKey`-style guard **verbatim** — this is not new registry code, it's the same primitive already shipping and tested for uninstall-leftover removal, called from a second place.

**Scan:** does the key exist (`reg query`)? Reported as `present`/`absent`, same vocabulary as a path rule. No byte size — a registry key doesn't have one worth reporting, and reporting `0 B` would read as "measured and empty" rather than "not the kind of thing this is measured in."

**Execute:** `reg.exe delete`, then report via the new `registryKeysRemoved` count (1 per successful deletion, 0 if the key was already absent — not an error, same "nothing to clean" posture an absent cache folder already gets).

**Known gap, not fixed in this phase:** deleting a registry key here is NOT quarantined or backed up — Prune's existing registry backup (`preUninstall.js`'s `createRegistryBackup`) only runs before an uninstall, a different flow with a different trigger. A `winreg` Deep Clean action is therefore the one action type in this phase without an undo path. This is flagged explicitly rather than silently shipped: worth a follow-up (export the key to the quarantine directory before deleting, mirroring how a deleted FILE already goes to quarantine first) but out of scope here, since it would mean extending the quarantine format to hold non-file entries.

## Frontend

No structural change. `DeepCleanTree`/`ScanLog`/`executeLogLine` already treat a rule's result as "one size, one set of skipped entries" regardless of what produced it — a rule mixing a `delete` and a `sqlite.vacuum` action, or a `winreg`-only rule, renders through the exact same components unchanged. `executeLogLine`'s verb ("Delete X") stays accurate for delete-only rules; a rule that is ONLY `sqlite.vacuum` or ONLY `winreg` reads oddly as "Delete X" when nothing was deleted — worth a small follow-up to `executeLogLine` (pick the verb from the rule's dominant action type) during implementation, not a blocker to this design.

## Testing

- Every existing `cleanerRules.test.js` test (47 at last count) keeps passing unchanged — `normalizeRule` is additive, legacy rules are read exactly as before.
- New `cleanerActions/sqliteVacuum.test.js`: vacuum shrinks a real bloated SQLite file and reports the real byte delta; refuses a non-SQLite file with a `skipped` reason rather than corrupting it; respects `skipRecentHours`/exclusions; is exempt from `autoQuarantine`.
- New `cleanerActions/winreg.test.js`: deletes a real HKCU test key and reports `registryKeysRemoved: 1`; reports `0` for an already-absent key without erroring; refuses a protected key the same way `quarantine.js`'s own test already proves for its existing callers.
- New `cleanerRules.test.js` coverage: a rule with one `delete` action and one `sqlite.vacuum` action sums `freedBytes` from both; a rule with only a `winreg` action reports `freedBytes: 0` plus `registryKeysRemoved`, never a fabricated byte count.
- Regression-test methodology stays the same as every other change this project: revert the fix, confirm the new test fails, restore, confirm it passes.

## Open questions resolved during this design (recorded so they aren't re-litigated)

- **Why not a native SQLite module?** Backend runs inside Electron's own process (`await import()` in `main.cjs`), so any native module needs Electron-ABI builds specifically — a real, ongoing packaging cost. Shelling out to a bundled CLI matches this codebase's own established convention (reg.exe, PowerShell, makensis are already handled this way) and avoids it entirely.
- **Why HKCU only?** Every real `winreg` action in BleachBit's corpus targets HKCU. HKLM would need elevation Deep Clean doesn't otherwise require; out of scope unless a concrete rule needs it later.
- **Why no registry-key backup in this phase?** It would mean extending Prune's quarantine format (currently file-shaped) to also hold registry entries — a real feature on its own, not a one-line addition. Flagged as a known gap rather than silently building an unquarantined delete and calling it done.
