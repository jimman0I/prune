# BleachBit-Parity Cleaning Engine — Phase C: `cookie` Action

## Context

Phase A (merged) built the action-type foundation plus `sqlite.vacuum`/`winreg`. Phase B (merged) added `json`. This spec covers `cookie` -- the 4th-largest real BleachBit action type (23 of the grepped corpus), and grounded not just against the cleaner XML but against BleachBit's own real Python source (`bleachbit/Cookie.py`, fetched from `github.com/bleachbit/bleachbit`, GPL) since the XML alone (`<action command="cookie" search="file" path="$$profile$$/Cookies"/>` -- no `address`, no extra attributes) doesn't reveal what the action actually DOES.

## What a real `cookie` action actually is

Every one of the real `command="cookie"` actions in BleachBit's cleaner corpus targets one of two file shapes: a Chromium-family `Cookies` (or `Network/Cookies`, `Extension Cookies`) SQLite file (table `cookies`, host column `host_key`), or a Firefox-family `cookies.sqlite` SQLite file (table `moz_cookies`, host column `host`). The XML never says which -- BleachBit's own code auto-detects it by checking which table exists in the file.

The real behavior, read directly from `Cookie.py`'s `delete_cookies()`:
1. BleachBit maintains a user-managed **keep list** -- domains whose cookies survive cleaning (`cookie_keep_list.json`, edited via a "Cookies to Preserve" dialog in BleachBit's own GUI, out of scope here -- see below).
2. If nothing is being kept for a given database (no keep-list entry matches anything in that specific file), BleachBit deletes the **whole file outright** -- no SQL, no `address`, same as a plain `delete` action.
3. If something IS being kept, BleachBit runs `DELETE FROM <table> WHERE NOT (<host> = ? OR <host> LIKE '%.?')` for every kept domain (exact match OR any subdomain), then `VACUUM`s the file to reclaim the freed pages -- structurally identical to Phase A's own `sqlite.vacuum` action, just preceded by a real `DELETE`.

## The design decisions this forces

**Decision 1: this phase builds the ENGINE capability, not a domain-management UI.** BleachBit's own "Cookies to Preserve" screen -- browse every cookie currently on the machine, tick which domains to keep -- is a real, standalone feature surface (its own settings screen, its own persisted list, its own "list what's actually in this file" plumbing via `list_cookies()`/`list_unique_cookies()`). Building that UI is out of scope for this phase, matching the exact "engine capability, not content" boundary Phases A and B already drew (neither phase authored new `cleaners.json` rules using their own new action types, either). Prune gets a new `cookieKeepList: []` setting (empty array default, matching `excludeFolders`'s own array-of-strings shape) with NO settings-screen entry point yet -- an empty list is a completely valid, working state: **it means every `cookie` action behaves exactly like BleachBit's own "nothing is being kept for this file" case, i.e. a whole-file delete.** This is not a degraded stand-in for the real feature; it is the real feature's own documented behavior for its default (empty) state. A future phase can add the "browse and pick domains" screen on top of this without touching the engine again.

**Decision 2: the ORIGINAL file is quarantined before a surgical (keep-list-driven) edit, exactly like Phase B's `json` action.** Deleting cookie rows is real, consequential data loss (can sign someone out of a site, matching the exact category of consequence `cleanWarning.js`'s risky-rule flag already exists for). This phase reuses `quarantineFileEdit()` from Phase B unchanged -- read the original bytes into a batch, then overwrite the file in place with the edited SQLite database -- rather than building a second quarantine-an-edit mechanism. When the keep list is empty for a given file (whole-file delete), the existing `quarantineAndDelete()` (move-based, Phase A/pre-existing) is used instead, since that IS the operation being performed (removing a whole file from its location), matching how `delete.js` already does it.

**Decision 3: no shred/secure-delete handling.** BleachBit's real code has an entire branch (`PRAGMA secure_delete`, WAL checkpoint + `-wal`/`-shm` cleanup, an in-memory VACUUM simulation for an accurate preview size under shredding) gated on its own `shred` option. Prune has no shred/secure-delete feature anywhere in this codebase -- grepped, confirmed absent. None of that branch applies; this phase's `scan()` reports the file's current on-disk size as an upper bound (the same convention `json.js`'s own `scan()` already established: an honest ceiling, not a precise post-clean prediction), and `execute()` computes a real before/after byte delta the same way `json.js`/`sqlite.vacuum` already do.

**Decision 4: table/host-column detection is real, not assumed per-browser.** `detectCookieTable(filePath)` checks which of the two real table names (`cookies`/`host_key` or `moz_cookies`/`host`) exists in the SQLite file, mirroring BleachBit's own `detect_browser()` -- a Chromium-family rule and a Firefox-family rule both point at the same `cookie` action code, no per-browser branching needed in `cleaners.json` itself (matching how the real BleachBit XML never distinguishes them either).

## Scope for this phase

**In scope:**
- `backend/src/lib/cleanerActions/cookie.js`: `scan(action)` / `execute(action, ruleName, guards)`, matching the interface shape `json.js` already established (this is the 6th action type, following `shell`/`delete`/`sqlite.vacuum`/`winreg`/`json`).
- Real SQLite table/host-column auto-detection (no assumption baked into `cleaners.json`).
- Domain-vs-subdomain match predicate (`host = domain OR host LIKE '%.domain'`), applied per entry in `settings.cookieKeepList`.
- Whole-file delete (via existing `quarantineAndDelete`) when nothing in a given file matches the keep list -- including the current, correct, empty-keep-list-by-default state.
- Surgical row delete + VACUUM + quarantine-the-original (via `quarantineFileEdit`, reused unchanged from Phase B) when something in the file DOES match the keep list.
- A new `cookieKeepList: []` setting in `backend/src/services/settings.js`'s `DEFAULT_SETTINGS`.
- Wiring `cookie` into `cleanerRules.js`'s `scanRule`/`executeRule` dispatcher as the 6th action type.
- Guards: `excludeFolders`/`excludeExtensions`/`skipRecentHours` apply to the one named file, same as `json`/`sqlite.vacuum`. `autoQuarantine` applies (not exempt) -- same reasoning as `json`: real data can be lost. When `autoQuarantine` is off, the SAME choice `json.js` already offers applies here too (Recycle Bin instead of Prune's quarantine) for the surgical-edit path; the whole-file-delete path already goes through `quarantineAndDelete`, which already has its own `autoQuarantine`-equivalent destination handling from Phase A/pre-existing work -- reused, not rebuilt.

**Explicitly out of scope:**
- The "Cookies to Preserve" domain-browsing/management UI (a Settings screen, `list_cookies()`/`list_unique_cookies()`-equivalent plumbing to show what's actually in a database) -- a real, separate future feature, not blocked by this phase.
- New `cleaners.json` rules that use the `cookie` action type -- same "engine capability, not content" boundary as Phases A and B.
- Safari's binary-cookies format (`Mac.py`'s `is_safari_binarycookies`/`list_safari_cookies`/`delete_safari_cookies`) -- Mac-only, irrelevant to this Windows-only app.
- Shred/secure-delete and its accompanying preview-estimation machinery -- Prune has no such feature to hook into.
- Phase D (per-app bespoke SQL like `chrome.history`, `mozilla.url.history`) -- still its own future phase.

## Testing

Same real-tool, no-mocking-the-mechanism-under-test convention every phase has used: a real temp SQLite file built with the actual `cookies`/`host_key` (and separately `moz_cookies`/`host`) schema and real rows, a real keep-list match/no-match, a real row count before/after, a real quarantine batch proving the pre-edit original is recoverable (reusing Phase B's already-tested `quarantineFileEdit`, so this phase's own tests focus on cookie.js's own logic -- table detection, the match predicate, the whole-file-vs-surgical branch decision -- not re-proving quarantine mechanics Phase B already covered). A real test proving the domain-vs-subdomain predicate is correct: keeping `example.com` keeps a row hosted at exactly `example.com` AND a row hosted at `sub.example.com`, but not `notexample.com` (string-prefix false positive is a real bug class the LIKE '%.domain' pattern is specifically shaped to avoid, and worth a test proving Prune's own implementation avoids it too).
