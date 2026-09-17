# Cookies to Preserve: design

## Why

Phase C (`docs/superpowers/specs/2026-09-17-bleachbit-parity-phase-c-cookie-design.md`) built the `cookie` action type and a `cookieKeepList: []` setting, but deliberately scoped out the UI: "Phase C builds the ENGINE capability, not a domain-management UI." An empty `cookieKeepList` means every `cookie` action deletes the whole file — correct default behavior, but there's no way to actually keep anything without hand-editing settings JSON. This closes that gap: a real screen to see what cookie domains exist on the machine and choose which to keep.

## Scope

In scope: a backend endpoint that reads every real cookie database Prune already knows about (via `cleaners.json`'s own `cookie`-action rules) and lists the distinct domains found, plus a Settings UI to browse that list and toggle `cookieKeepList` entries.

Out of scope: Firefox/Mozilla cookies (no `mozilla.cookie`-type rule exists in `cleaners.json` yet — only `chrome_cookies`/`brave_cookies`/`edge_cookies` use the `cookie` action type today; adding a Firefox cookie rule is a `cleaners.json` content change, not a UI change, and stays out of this spec). Changing `buildKeepPredicate`'s matching semantics (exact host or subdomain) — unchanged, already correct.

## Backend

**Source of truth for "which files to scan":** `loadCleanerRules()` (`backend/src/lib/cleanerRules.js`), filtered to every action where `type === 'cookie'`. This is the same rule set `executeRule`/`scanRule` already dispatch against — a new hardcoded path list would drift from `cleaners.json` the first time someone adds or edits a cookie rule there.

**New exports needed** (currently private to their modules):
- `cleanerRules.js`: export `resolveBespokeActionPaths` (already used internally by every bespoke action's `scanRule`/`executeRule` branch to glob-resolve `%LOCALAPPDATA%\...\*\Cookies`-style paths across browser profiles).
- `cookieSql.js`: export `normalizeDomain` (currently private; needed to aggregate counts by the same normalized key `buildKeepPredicate` matches against, so "google.com" scanned from one profile and "google.com" from another sum into one row instead of two).
- `cookie.js`: export `detectCookieTable` (already implemented for `execute()`; the new listing code needs the identical Chromium-vs-Firefox table detection, not a second copy of it).

**New file:** `backend/src/lib/cleanerActions/cookieDomains.js`, one function:

```
export async function listCookieDomains()
  → { domains: [{ domain, count }], errors: [{ path, reason }] }
```

For each `cookie` action in `loadCleanerRules()`, expand + `resolveBespokeActionPaths` its `path`, and for each real (existing) file: detect its table via `detectCookieTable`, then run `SELECT <hostColumn>, COUNT(*) FROM <table> GROUP BY <hostColumn>` via the bundled `sqlite3ExePath()` CLI (same invocation shape `cookie.js` already uses). Normalize each returned host with `normalizeDomain` and accumulate into a `Map<domain, count>` across every file from every browser. A file that fails to open (locked, not a real SQLite DB, no recognized table) is pushed to `errors` with a short reason and does not abort the rest of the scan — same non-fatal-per-file posture `cookie.js`'s own `execute()` already has for a single file. Final `domains` array sorted by `count` descending.

**New route:** `GET /api/deep-clean/cookie-domains` in `backend/src/routes/deepClean.js`, calling `listCookieDomains()` and returning its result as JSON. No caching — cookies churn constantly and a stale count is actively misleading here, unlike e.g. installed-program icons.

## Frontend

**Location:** Settings → Cleanup tab, a new `glass-panel` block placed next to the existing exclusions block (`frontend/src/components/SettingsPage.jsx`, same tab as `excludeFolders`/`excludeExtensions`).

**Interaction:**
1. An explicit "Scan for cookies" button — no auto-scan on tab open. Matches Deep Clean's own Preview and Disk Map's own fast-scan convention: nothing that reads across every browser's profile data on this machine happens without an explicit click.
2. On click, `GET /api/deep-clean/cookie-domains`. While pending, the button shows a scanning state (reuse the small inline spinner glyph pattern already used in Deep Clean/Disk Map's own buttons — `border-2 border-t-transparent rounded-full animate-spin`).
3. Results render as a scrollable, count-sorted checklist: `{domain} · {count} cookies`, a checkbox per row. A text filter input above the list, since a real profile can easily have 100+ distinct domains and BleachBit's own equivalent screen has the same problem.
4. Ticking a row's checkbox calls `save({ cookieKeepList: next })` immediately — same pattern `handleAddExclusion`/`handleRemoveExclusion` already use for `excludeFolders`, no separate Save button anywhere else in this settings screen either.
5. **Stale-entry handling:** `cookieKeepList` may already contain a domain not present in the just-completed scan (added on a previous scan, or the browser that had it is gone now). Those render as checked rows appended below the scanned list, visually distinguished (no count, since nothing this scan measured it) rather than silently disappearing — same "don't hide state" rule the Deep Clean hidden-cleaners note and the truncated-scan coverage message already follow elsewhere in this app.
6. `errors` from the scan (a locked/corrupt cookie file) render as a small dismissible note below the list, naming which browser/profile failed — not a blocking error, since the other browsers' domains still scanned fine.

**Empty state, pre-scan:** if `cookieKeepList` already has entries from a previous session but no scan has run yet this load, show them as plain read-only chips (same visual language `excludeFolders`' own chips already use) above the "Scan for cookies" button, so the setting isn't invisible before the first click.

## Testing

**Backend:**
- `cookieDomains.test.js`: fixture SQLite files (both `cookies`/`host_key` and `moz_cookies`/`host` shapes, built the same way `cookie.test.js`'s own fixtures already are) — asserts counts aggregate correctly across two files sharing a domain, a locked/corrupt file lands in `errors` and doesn't abort the rest, and zero cookie files present anywhere returns `{ domains: [], errors: [] }` rather than throwing.
- `deepClean.test.js`: route test asserting `GET /cookie-domains` returns `listCookieDomains()`'s shape verbatim (mocked).

**Frontend:**
- Render test: scan button → loading state → checklist rendered from a mocked response → clicking a row calls `save` with the domain added to `cookieKeepList`.
- Render test: a `cookieKeepList` entry not present in the mocked scan response still renders, checked, with no count.
- Render test: filter input narrows the visible rows by substring match on domain.
- i18n: new catalog keys (scan button label/loading label, column/count label, filter placeholder, stale-entry note, empty-state note, error note) added across all languages in the same commit, matching this project's established i18n discipline.
