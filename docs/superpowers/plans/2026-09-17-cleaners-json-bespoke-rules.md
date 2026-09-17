# Authoring Real cleaners.json Rules for the New Engine Types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Fix a real gap: the bespoke single-path action types (`json`/`cookie`/`chrome.*`/`mozilla.*`) built in Phases B-D have no glob support, but the existing rules this pass wants to upgrade rely on a `*` wildcard to cover every browser profile. (2) Upgrade `chrome_history`/`brave_history`/`edge_history` and `chrome_cookies`/`brave_cookies`/`edge_cookies` to use the new bespoke engine types. (3) Add new `*_keywords` and `*_autofill_suggestions` rules across the same 3 browsers.

**Architecture:** A small dispatcher-level change in `cleanerRules.js`: before calling a bespoke single-path action's `scan`/`execute`, resolve `action.path` through the exact same `resolveGlob`/`pathToSegments` functions `delete.js` already exports, then loop the action across every resolved concrete path, merging results. Then straightforward JSON content edits to `cleaners.json`.

**Spec:** `docs/superpowers/specs/2026-09-17-cleaners-json-bespoke-rules-design.md`

---

### Task 1: Glob-resolve bespoke single-path actions in the dispatcher

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

- [ ] **Step 1: Read the current dispatcher and `delete.js`'s exports**

Read `cleanerRules.js`'s current `scanRule`/`executeRule` in full (the `json`/`cookie`/`chrome.*`/`mozilla.*` branches, all currently doing `expandPath(action.path)` once). Read `delete.js`'s exported `resolveGlob(basePath, segments)` and `pathToSegments(expandedPath)` (already built, used by `delete`'s own action, unchanged by this task).

- [ ] **Step 2: Write the failing test proving multi-profile resolution works**

Add to `cleanerRules.test.js` (adapt to this file's real fixture-building conventions -- check an existing `cookie action, wired`/`chrome.history` test for the exact helper functions already available):

```js
describe('glob-resolved bespoke actions', () => {
  it('a wildcarded cookie action cleans every real profile folder, not just one', async () => {
    const profile1Dir = join(appDataDir, 'multi-profile-test', 'Default');
    const profile2Dir = join(appDataDir, 'multi-profile-test', 'Profile 1');
    await mkdir(profile1Dir, { recursive: true });
    await mkdir(profile2Dir, { recursive: true });

    // Build a real minimal cookie database in EACH profile folder (reuse
    // whatever helper this file's existing cookie tests already use).
    await execFileAsync(sqlite3ExePath(), [
      join(profile1Dir, 'Cookies'),
      "CREATE TABLE cookies (host_key TEXT); INSERT INTO cookies VALUES ('a.com');"
    ]);
    await execFileAsync(sqlite3ExePath(), [
      join(profile2Dir, 'Cookies'),
      "CREATE TABLE cookies (host_key TEXT); INSERT INTO cookies VALUES ('b.com');"
    ]);

    const rule = {
      id: 'multi-profile-cookie-test', category: 'Test', name: 'Multi-profile cookie test',
      actions: [{ type: 'cookie', path: '%APPDATA%\\multi-profile-test\\*\\Cookies' }]
    };

    const result = await executeRule(rule, { cookieKeepList: [] });

    // BOTH profiles' Cookies files should be gone -- proves the glob
    // resolved to two concrete paths, not just one (or a literal '*').
    expect(existsSync(join(profile1Dir, 'Cookies'))).toBe(false);
    expect(existsSync(join(profile2Dir, 'Cookies'))).toBe(false);
    expect(result.freedBytes).toBeGreaterThan(0);
  });

  it('a non-wildcarded bespoke action path is completely unaffected by this change', async () => {
    // Reuse an EXISTING single-path json/cookie/chrome.* test from this
    // file verbatim (no `*` in its path) and confirm it still passes
    // exactly as before -- this proves the glob-resolution change is a
    // pure addition, not a behavior change for the common case every
    // existing test already covers.
  });
});
```

Write the actual concrete second test by picking one of this file's own pre-existing single-path bespoke-action tests (e.g. from the `cookie action, wired`/`json action, wired` blocks) and re-running it verbatim after Step 3's implementation, confirming no change is needed to make it pass.

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerRules.test.js -t "glob-resolved bespoke actions"
```

Expected: FAIL -- only one profile (or neither, since `expandPath` leaves the literal `*` character in the path, which won't match any real file) gets cleaned.

- [ ] **Step 4: Implement it**

Add a helper near the top of `cleanerRules.js` (import `resolveGlob`/`pathToSegments` from `./cleanerActions/delete.js`):

```js
import { resolveGlob, pathToSegments } from './cleanerActions/delete.js';

/** Resolves one bespoke action's `path` (already environment-expanded)
 * into every REAL concrete path it currently matches -- a `*` wildcard
 * (e.g. matching every Chrome profile folder) expands the same way
 * `delete.js`'s own action already does, via the exact same resolver.
 * A path with no `*` resolves to exactly itself (resolveGlob's own
 * documented behavior for the non-wildcard case), so every existing
 * single-profile rule is unaffected by this. Returns an array -- callers
 * loop over it and merge results, since a wildcard can now genuinely
 * match zero, one, or several real files where the bespoke action types
 * (json/cookie/chrome.*/mozilla.*) previously only ever saw one. */
function resolveBespokeActionPaths(expandedPath) {
  const [driveSegment, ...rest] = pathToSegments(expandedPath);
  if (!driveSegment) return [];
  return resolveGlob(driveSegment, rest);
}
```

In `scanRule`, for EACH of the bespoke single-path branches (`json`, `cookie`, `chrome.autofill`, `chrome.keywords`, `chrome.history`, `mozilla.url.history`, `mozilla.favicons`), change:

```js
} else if (action.type === 'cookie') {
  const result = cookieAction.scan({ expandedPath: expandPath(action.path) });
  sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
  if (result.present) present = true;
}
```

to loop over every resolved concrete path:

```js
} else if (action.type === 'cookie') {
  for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
    const result = cookieAction.scan({ expandedPath: concretePath });
    sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
    if (result.present) present = true;
  }
}
```

Apply the exact same wrapping pattern to the other 6 bespoke branches (`json`, `chrome.autofill`, `chrome.keywords`, `chrome.history`, `mozilla.url.history`, `mozilla.favicons`) in `scanRule`, and to the mirror branches in `executeRule` -- read each branch's REAL current code first (don't guess the exact variable names) and wrap its single `expandPath(action.path)` call in the same `for (const concretePath of resolveBespokeActionPaths(...))` loop, keeping every other line of each branch's body unchanged inside the loop.

- [ ] **Step 5: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerRules.test.js
```

Expected: all pass, including both new tests and every pre-existing test in the file (confirming the non-wildcard case is genuinely unaffected).

- [ ] **Step 6: Run the full backend suite, commit**

```bash
npx vitest run
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleanerRules): resolve wildcarded paths for bespoke single-path actions"
```

---

### Task 2: Upgrade chrome/brave/edge history and cookies rules

**Files:**
- Modify: `backend/src/data/cleaners.json`
- Test: `backend/src/lib/cleanerRules.test.js` (or wherever this repo's existing "does cleaners.json load and normalize correctly" structural test lives -- find it first)

- [ ] **Step 1: Read the current 6 rules being converted**

Read the current exact JSON for `chrome_history`, `chrome_cookies`, `brave_history`, `brave_cookies`, `edge_history`, `edge_cookies` in `backend/src/data/cleaners.json` (already known from this session's own grounding, but re-read the live file to catch any drift before editing).

- [ ] **Step 2: Convert `chrome_history` (and the same pattern for brave/edge)**

Change `chrome_history` from:

```json
{
  "id": "chrome_history",
  "category": "Chrome",
  "name": "Browsing history",
  "description": "The list of pages visited, plus the most-visited shortcuts on the new tab page.",
  "paths": [
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\History",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\History-journal",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Top Sites",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Top Sites-journal",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Visited Links"
  ],
  "is_safe": false,
  "risky": true,
  "recommended": false
}
```

to:

```json
{
  "id": "chrome_history",
  "category": "Chrome",
  "name": "Browsing history",
  "description": "The list of pages visited, plus the most-visited shortcuts on the new tab page. Bookmarked sites keep their entry so they're not treated as brand new next time.",
  "actions": [
    { "type": "chrome.history", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\History" },
    { "type": "delete", "paths": [
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\History-journal",
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Top Sites",
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Top Sites-journal",
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Visited Links"
    ] }
  ],
  "is_safe": false,
  "risky": true,
  "recommended": false
}
```

The description gains one sentence naming the real, new user-visible improvement (bookmark preservation) -- don't skip this, an unexplained behavior change is a worse experience than no change at all. Apply the identical pattern to `brave_history` (substitute `BraveSoftware\Brave-Browser`) and `edge_history` (substitute `Microsoft\Edge`), each keeping their own existing `category`/`name` unchanged.

- [ ] **Step 3: Convert `chrome_cookies` (and the same pattern for brave/edge)**

Change `chrome_cookies` from:

```json
{
  "id": "chrome_cookies",
  "category": "Chrome",
  "name": "Cookies",
  "description": "Signs you out of every site that remembered you.",
  "paths": [
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Network\\Cookies",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Network\\Cookies-journal",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Cookies",
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Cookies-journal"
  ],
  "is_safe": false,
  "risky": true,
  "recommended": false
}
```

to:

```json
{
  "id": "chrome_cookies",
  "category": "Chrome",
  "name": "Cookies",
  "description": "Signs you out of every site that remembered you.",
  "actions": [
    { "type": "cookie", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Network\\Cookies" },
    { "type": "cookie", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Cookies" },
    { "type": "delete", "paths": [
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Network\\Cookies-journal",
      "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Cookies-journal"
    ] }
  ],
  "is_safe": false,
  "risky": true,
  "recommended": false
}
```

No description change needed here -- with today's empty `cookieKeepList` default, the real behavior is identical to before (whole-file delete), so nothing user-visible changed yet. Apply the identical pattern to `brave_cookies`/`edge_cookies`.

- [ ] **Step 4: Write/update the structural test**

Find this repo's existing test that loads the real `cleaners.json` file and asserts something about every rule (e.g. the "no rule contains a bare drive letter" regression test mentioned in this project's own history, or a similar whole-file structural check -- grep `cleanerRules.test.js` for `loadCleanerRules` to find it). Add an assertion (or a new small test) confirming: `normalizeRule()` accepts the 6 newly-`actions`-based rules without throwing, and each one's `actions` array has the expected length/types (e.g. `chrome_history` now has exactly 2 actions: one `chrome.history`, one `delete`).

- [ ] **Step 5: Run the full backend suite, commit**

```bash
cd backend && npx vitest run
git add backend/src/data/cleaners.json backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleaners): upgrade chrome/brave/edge history and cookies rules to the new engine types"
```

---

### Task 3: Add `*_keywords` and `*_autofill_suggestions` rules

**Files:**
- Modify: `backend/src/data/cleaners.json`
- Modify: `frontend/src/lib/cleanWarning.js` (or wherever the "risky rule" list/check lives -- find it first)
- Test: as Task 2's Step 4

- [ ] **Step 1: Read `cleanWarning.js`'s current risky-rule mechanism**

Find and read whatever function/list decides a rule counts as "risky" (grep for `risky` in `frontend/src/lib/cleanWarning.js` and/or wherever the "loses data" badge -- mentioned in this project's own history as covering "history, cookies, sessions, autofill and site data across three browsers, plus the Recycle Bin" -- actually decides membership: is it purely the rule's own `risky: true` JSON field, or a separate hardcoded list that would ALSO need updating for a new risky rule to actually show the badge and warning dialog?).

- [ ] **Step 2: Add the 6 new rules to `cleaners.json`**

Insert `chrome_keywords`/`brave_keywords`/`edge_keywords` (placed near each browser's other rules, matching the file's existing per-category grouping/ordering convention -- check where `chrome_form_history` sits relative to its siblings and place the new rules consistently):

```json
{
  "id": "chrome_keywords",
  "category": "Chrome",
  "name": "Search engines you've added",
  "description": "Custom search shortcuts you've typed or added yourself. Chrome's own built-in engines are left alone.",
  "actions": [
    { "type": "chrome.keywords", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Web Data" }
  ],
  "is_safe": true,
  "recommended": false
}
```

(Substitute the vendor path for `brave_keywords`/`edge_keywords`, keeping `category`/`id` matching each browser.)

Insert `chrome_autofill_suggestions`/`brave_autofill_suggestions`/`edge_autofill_suggestions`:

```json
{
  "id": "chrome_autofill_suggestions",
  "category": "Chrome",
  "name": "Form-fill suggestions",
  "description": "Text you've typed into web forms before, offered back as a suggestion. Does not touch saved addresses, cards or passwords -- see \"Autofill and form history\" for those.",
  "actions": [
    { "type": "chrome.autofill", "path": "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\*\\Web Data" }
  ],
  "is_safe": false,
  "risky": true,
  "recommended": false
}
```

(Substitute the vendor path for the brave/edge equivalents.) The description's cross-reference to the existing rule's own real name ("Autofill and form history") is deliberate -- someone comparing the two rules in the tree needs to understand why there are now two similarly-named things and what's different, not guess.

- [ ] **Step 3: Wire the new risky rules into whatever mechanism Step 1 found**

If risky-rule membership is driven purely by each rule's own `risky: true` field (already set above for `*_autofill_suggestions`), confirm no further wiring is needed. If there's a SEPARATE list (e.g. a hardcoded array of rule ids in `cleanWarning.js` used for the "remember my choice" acknowledgement tracking, distinct from the JSON's own `risky` flag), add the 3 new autofill-suggestion rule ids to it, matching whatever that list's real current shape is.

- [ ] **Step 4: Add/update the structural test from Task 2's Step 4**

Confirm all 6 new rules load and normalize correctly, same as Task 2.

- [ ] **Step 5: Run the full three-suite pass, commit**

```bash
cd backend && npx vitest run
cd ../frontend && npx vitest run
cd ../electron && npm test
git add backend/src/data/cleaners.json <whichever risky-rule file needed changes> <the test file>
git commit -m "feat(cleaners): add search-engine and form-fill-suggestion rules for chrome/brave/edge"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: backend all green except the 3 pre-existing elevation-gated failures; frontend and electron fully green.

- [ ] **Step 2: A real, live scan against this machine's actual Chrome/Brave**

Given this touches rules that will run against the REAL browser data on this dev machine the moment someone clicks Preview in the real app, do a real (not mocked) scan-only check: start the backend, hit the real Deep Clean scan endpoint (or however this repo's own convention verifies a real cleaner change -- check `RELEASING.md`/prior session notes for the established "run a live check with UNREVO_QUARANTINE_ROOT pointed at a temp dir" convention mentioned in this project's own history before shipping a cleaner change) and confirm the new/converted rules report a real, sane size for the REAL Chrome/Brave history/cookies/keywords/autofill data on this machine -- READ-ONLY (scan only, do not click Clean against real browser data as part of this verification).

- [ ] **Step 3: Cross-check against the spec**

Confirm: no Firefox/`mozilla.*` rules were added (out of scope for this pass), `chrome_form_history`/`chrome_favicons` (and their brave/edge equivalents) are byte-for-byte unchanged in the diff, the new `*_autofill_suggestions` rules' descriptions correctly distinguish themselves from the existing `_form_history` rules.
