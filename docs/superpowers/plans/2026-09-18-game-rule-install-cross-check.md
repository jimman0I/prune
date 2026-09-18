# Game/Launcher Rule Install Cross-Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the 8 game/launcher Deep Clean rules from reporting `present: true` on a machine where the game/launcher was never installed -- a real, reported bug where a bare folder-exists check can't tell a launcher's own scaffolded placeholder folder apart from a real completed install.

**Architecture:** A new `requiresProgram: "<real display name>"` field on the 8 affected `cleaners.json` rules, checked against `programs.js`'s existing real registry-based `listInstalledPrograms()` output. The routes that scan (`/rules`, `/scan`, `/scan/stream`) fetch that list once per request and thread a lowercased name `Set` through the existing `guards` object every scan function already accepts; `scanRule`/`rulePathsExist` gate on it before touching the filesystem at all.

**Tech Stack:** Node.js/Express backend, existing `cleanerRules.js`/`programs.js` services, Vitest.

---

### Task 1: Add `requiresProgram` to the 8 real rules

**Files:**
- Modify: `backend/src/data/cleaners.json`
- Test: `backend/src/lib/cleanerRules.test.js`

Real display names, confirmed directly against this machine's own Uninstall registry entries: `"Steam"`, `"Epic Games Launcher"`, `"Riot Client"`, `"League of Legends"`.

- [ ] **Step 1: Write the failing test**

Add this to `backend/src/lib/cleanerRules.test.js` (anywhere alongside the other top-level `describe` blocks):

```js
describe('game/launcher rules require their program to be installed', () => {
  it('carries requiresProgram matching the real registry display name for each of the 8 rules', () => {
    const byId = Object.fromEntries(loadCleanerRules().map((r) => [r.id, r.requiresProgram]));
    expect(byId.steam_cache).toBe('Steam');
    expect(byId.steam_shader_cache).toBe('Steam');
    expect(byId.steam_depot_cache).toBe('Steam');
    expect(byId.steam_logs).toBe('Steam');
    expect(byId.epic_games_cache).toBe('Epic Games Launcher');
    expect(byId.epic_crash_reports).toBe('Epic Games Launcher');
    expect(byId.riot_client_logs).toBe('Riot Client');
    expect(byId.league_of_legends_logs).toBe('League of Legends');
  });
});
```

Confirm `loadCleanerRules` is already imported at the top of this test file (it is, used by other tests in the same file) -- if for some reason it isn't, add `import { loadCleanerRules, ... } from './cleanerRules.js';` matching whatever the file's existing import line already pulls in.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js -t "game/launcher rules require their program"`
Expected: FAIL -- every `byId.*` is `undefined`, none of the fields exist yet.

- [ ] **Step 3: Add the field to the 8 rules**

In `backend/src/data/cleaners.json`, add a `"requiresProgram"` key to each of these 8 rule objects (alongside their existing `"paths"`/`"is_safe"`/`"recommended"` keys -- exact placement within the object doesn't matter, JSON key order isn't semantic here):

- `steam_cache` -> `"requiresProgram": "Steam"`
- `steam_shader_cache` -> `"requiresProgram": "Steam"`
- `steam_depot_cache` -> `"requiresProgram": "Steam"`
- `steam_logs` -> `"requiresProgram": "Steam"`
- `epic_games_cache` -> `"requiresProgram": "Epic Games Launcher"`
- `epic_crash_reports` -> `"requiresProgram": "Epic Games Launcher"`
- `riot_client_logs` -> `"requiresProgram": "Riot Client"`
- `league_of_legends_logs` -> `"requiresProgram": "League of Legends"`

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js -t "game/launcher rules require their program"`
Expected: PASS.

- [ ] **Step 5: Run the full cleanerRules.test.js file to confirm nothing else broke**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js`
Expected: PASS, same pass count as before this task plus the 1 new test (adding a JSON field these tests don't otherwise read should not change any other test's outcome).

- [ ] **Step 6: Commit**

```bash
git add backend/src/data/cleaners.json backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleaners): add requiresProgram to the 8 game/launcher rules"
```

Note: do NOT add a `Co-Authored-By: Claude` line -- this project's convention is no AI attribution in commits.

---

### Task 2: Gate `scanRule` and `rulePathsExist` on `requiresProgram`

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

**Exact current code being changed** (already read in full this session):

`scanRule` starts:
```js
export function scanRule(rule, guards = {}) {
  const normalized = normalizeRule(rule);
```

`rulePathsExist` currently has no `guards` parameter at all:
```js
export function rulePathsExist(rule) {
  if (rule?.command) return true;

  for (const rawPath of rule?.paths || []) {
    if (rulePathsExistFor(expandPath(rawPath))) return true;
  }
  return false;
}
```

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/lib/cleanerRules.test.js`, inside (or right after) the existing `describe('scanRule', ...)` block:

```js
describe('scanRule -- requiresProgram gate', () => {
  it('reports present:false and 0 bytes when the required program is not in guards.installedProgramNames, even though the folder genuinely exists', async () => {
    const dir = join(appDataDir, 'some-game', 'Logs');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'game.log'), '12345'); // 5 real bytes, would normally count

    const rule = { id: 'some_game_logs', paths: ['%APPDATA%\\some-game\\Logs'], requiresProgram: 'Some Game' };
    const result = scanRule(rule, { installedProgramNames: new Set(['other program']) });

    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
    expect(result.fileCount).toBe(0);
  });

  it('scans normally when the required program IS in guards.installedProgramNames', async () => {
    const dir = join(appDataDir, 'some-game', 'Logs');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'game.log'), '12345'); // 5 real bytes

    const rule = { id: 'some_game_logs', paths: ['%APPDATA%\\some-game\\Logs'], requiresProgram: 'Some Game' };
    const result = scanRule(rule, { installedProgramNames: new Set(['some game']) });

    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBe(5);
  });

  it('matches case-insensitively', async () => {
    const dir = join(appDataDir, 'some-game', 'Logs');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'game.log'), '12345');

    const rule = { id: 'some_game_logs', paths: ['%APPDATA%\\some-game\\Logs'], requiresProgram: 'Some Game' };
    const result = scanRule(rule, { installedProgramNames: new Set(['SOME GAME']) });

    expect(result.present).toBe(true);
  });

  it('is unaffected by requiresProgram when guards.installedProgramNames is not provided at all', async () => {
    // scanAllRules() with no guards, and every other existing caller that
    // never heard of this feature, must keep working exactly as before.
    const dir = join(appDataDir, 'some-game', 'Logs');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'game.log'), '12345');

    const rule = { id: 'some_game_logs', paths: ['%APPDATA%\\some-game\\Logs'] }; // no requiresProgram at all
    const result = scanRule(rule);

    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBe(5);
  });
});

describe('rulePathsExist -- requiresProgram gate', () => {
  it('returns false when the required program is not installed, even though the folder exists', async () => {
    const dir = join(appDataDir, 'some-game', 'Logs');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'game.log'), '12345');

    const rule = { id: 'some_game_logs', paths: ['%APPDATA%\\some-game\\Logs'], requiresProgram: 'Some Game' };
    expect(rulePathsExist(rule, { installedProgramNames: new Set(['other program']) })).toBe(false);
  });

  it('returns true when the required program is installed', async () => {
    const dir = join(appDataDir, 'some-game', 'Logs');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'game.log'), '12345');

    const rule = { id: 'some_game_logs', paths: ['%APPDATA%\\some-game\\Logs'], requiresProgram: 'Some Game' };
    expect(rulePathsExist(rule, { installedProgramNames: new Set(['some game']) })).toBe(true);
  });

  it('still works for a rule with no requiresProgram and no guards at all, exactly as before', async () => {
    const dir = join(appDataDir, 'plain-app', 'Cache');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'x'), '1');

    const rule = { id: 'plain_app_cache', paths: ['%APPDATA%\\plain-app\\Cache'] };
    expect(rulePathsExist(rule)).toBe(true);
  });
});
```

Check that `join`, `mkdir`, `writeFile`, `appDataDir` are already available in this test file's top-level scope (they are -- used by the existing `scanRule` describe block above).

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js -t "requiresProgram gate"`
Expected: FAIL -- `scanRule`/`rulePathsExist` don't know about `requiresProgram` yet, so every gated test sees `present: true` when it expects `false`.

- [ ] **Step 3: Implement the gate**

In `backend/src/lib/cleanerRules.js`, change `scanRule`'s opening:

```js
export function scanRule(rule, guards = {}) {
  const normalized = normalizeRule(rule);
```

to:

```js
export function scanRule(rule, guards = {}) {
  // A game/launcher rule's requiresProgram gate wins over everything
  // below -- checked before normalizeRule/the action loop even runs, so
  // a launcher's own scaffolded placeholder folder (confirmed real,
  // e.g. "Install League of Legends eune" under Riot Games' own
  // %LOCALAPPDATA% tree) can never be mistaken for a completed install
  // just because something exists on disk at the expected path.
  if (rule.requiresProgram && !guards.installedProgramNames?.has(rule.requiresProgram.toLowerCase())) {
    return { id: rule.id, sizeBytes: 0, fileCount: 0, heldCount: 0, present: false, accessible: true };
  }

  const normalized = normalizeRule(rule);
```

Then change `rulePathsExist`:

```js
export function rulePathsExist(rule) {
  if (rule?.command) return true;

  for (const rawPath of rule?.paths || []) {
    if (rulePathsExistFor(expandPath(rawPath))) return true;
  }
  return false;
}
```

to:

```js
export function rulePathsExist(rule, guards = {}) {
  if (rule?.command) return true;
  if (rule?.requiresProgram && !guards.installedProgramNames?.has(rule.requiresProgram.toLowerCase())) return false;

  for (const rawPath of rule?.paths || []) {
    if (rulePathsExistFor(expandPath(rawPath))) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run to verify the new tests pass**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js -t "requiresProgram gate"`
Expected: PASS, all 7 (4 `scanRule` + 3 `rulePathsExist`).

- [ ] **Step 5: Run the full file to confirm zero regressions**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js`
Expected: PASS, every pre-existing test in this file unaffected (the gate only fires when `rule.requiresProgram` is truthy, which no existing rule fixture in this file's other tests sets).

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleaners): gate scanRule/rulePathsExist on requiresProgram"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 3: Wire the real installed-programs list into the 3 scanning routes

**Files:**
- Modify: `backend/src/routes/deepClean.js`
- Test: `backend/src/routes/deepClean.test.js`

**Exact current code** (already read in full this session):

```js
import { scanAllRules, executeRules, executeRulesProgressively, scanRulesProgressively, loadCleanerRules, rulePathsExist } from '../lib/cleanerRules.js';
import { getSettings, cleanGuardsFrom } from '../services/settings.js';
```

`/scan/stream` (around line 26-53):
```js
router.get('/scan/stream', async (req, res) => {
  ...
  try {
    const rules = loadCleanerRules();
    sendEvent(res, 'start', { total: rules.length });
    const summary = await scanRulesProgressively(
      (item) => sendEvent(res, 'rule', item),
      { signal: controller.signal, ...cleanGuardsFrom(await getSettings()) }
    );
    ...
```

`/rules` (around line 67-92), currently NOT async:
```js
router.get('/rules', (req, res) => {
  try {
    const grouped = [];
    for (const rule of loadCleanerRules()) {
      const item = { ...rule, sizeBytes: null, fileCount: null, present: rulePathsExist(rule) };
      ...
```

`/scan` (around line 108-114):
```js
router.get('/scan', async (req, res) => {
  try {
    res.json({ categories: scanAllRules(cleanGuardsFrom(await getSettings())) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 1: Write the failing tests**

In `backend/src/routes/deepClean.test.js`, add this mock near the top, alongside the existing `vi.mock('../lib/cleanerActions/cookieDomains.js', ...)` block:

```js
const listInstalledPrograms = vi.fn(async () => [
  { id: 'league', name: 'League of Legends' },
  { id: 'steam', name: 'Steam' }
]);
vi.mock('../services/programs.js', () => ({
  listInstalledPrograms: (...a) => listInstalledPrograms(...a)
}));
```

Then add this describe block:

```js
describe('the real installed-programs list feeds every scan route', () => {
  it('GET /rules calls rulePathsExist with installedProgramNames built from the real list', async () => {
    await server.call('/deep-clean/rules');
    expect(listInstalledPrograms).toHaveBeenCalled();
    const guardsArg = rulePathsExist.mock.calls[0][1];
    expect(guardsArg.installedProgramNames.has('league of legends')).toBe(true);
    expect(guardsArg.installedProgramNames.has('steam')).toBe(true);
    expect(guardsArg.installedProgramNames.has('epic games launcher')).toBe(false);
  });

  it('GET /scan calls scanAllRules with installedProgramNames merged into the existing guards', async () => {
    await server.call('/deep-clean/scan');
    const guardsArg = scanAllRules.mock.calls[0][0];
    expect(guardsArg.excludeFolders).toEqual(['C:\\Keep']); // the existing settings-derived guard, untouched
    expect(guardsArg.installedProgramNames.has('steam')).toBe(true);
  });

  it('GET /scan/stream calls scanRulesProgressively with installedProgramNames merged into the existing guards', async () => {
    const res = await server.call('/deep-clean/scan/stream');
    void res; // the route streams; reaching here without throwing is enough to prove the guards were built
    const guardsArg = scanRulesProgressively.mock.calls[0][1];
    expect(guardsArg.excludeFolders).toEqual(['C:\\Keep']);
    expect(guardsArg.installedProgramNames.has('league of legends')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/routes/deepClean.test.js -t "real installed-programs list"`
Expected: FAIL -- `listInstalledPrograms` is never called (the routes don't know about it yet), and `guardsArg.installedProgramNames` is `undefined`.

- [ ] **Step 3: Wire it in**

In `backend/src/routes/deepClean.js`, add the import alongside the existing ones:

```js
import { listInstalledPrograms } from '../services/programs.js';
```

Add a small local helper right after the existing `sendEvent` function:

```js
/** The real installed-programs list, reduced to a lowercased name Set --
 * fetched once per scan request (not once per rule) and threaded into
 * `guards` the same way `cleanGuardsFrom`'s own fields already are, so
 * `scanRule`/`rulePathsExist` can gate a game/launcher rule's
 * `requiresProgram` field against real registry data instead of trusting
 * a bare folder-exists check. See cleanerRules.js's own requiresProgram
 * gate for why this exists. */
async function installedProgramNames() {
  const programs = await listInstalledPrograms();
  return new Set(programs.map((p) => p.name.toLowerCase()));
}
```

Change `/scan/stream`'s guards line from:

```js
    const summary = await scanRulesProgressively(
      (item) => sendEvent(res, 'rule', item),
      { signal: controller.signal, ...cleanGuardsFrom(await getSettings()) }
    );
```

to:

```js
    const summary = await scanRulesProgressively(
      (item) => sendEvent(res, 'rule', item),
      { signal: controller.signal, ...cleanGuardsFrom(await getSettings()), installedProgramNames: await installedProgramNames() }
    );
```

Change `/rules` from:

```js
router.get('/rules', (req, res) => {
  try {
    const grouped = [];
    for (const rule of loadCleanerRules()) {
      const item = { ...rule, sizeBytes: null, fileCount: null, present: rulePathsExist(rule) };
      const group = grouped.find((g) => g.category === rule.category);
      if (group) group.items.push(item);
      else grouped.push({ category: rule.category, items: [item] });
    }
    res.json({ categories: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

to:

```js
router.get('/rules', async (req, res) => {
  try {
    const guards = { installedProgramNames: await installedProgramNames() };
    const grouped = [];
    for (const rule of loadCleanerRules()) {
      const item = { ...rule, sizeBytes: null, fileCount: null, present: rulePathsExist(rule, guards) };
      const group = grouped.find((g) => g.category === rule.category);
      if (group) group.items.push(item);
      else grouped.push({ category: rule.category, items: [item] });
    }
    res.json({ categories: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Change `/scan` from:

```js
router.get('/scan', async (req, res) => {
  try {
    res.json({ categories: scanAllRules(cleanGuardsFrom(await getSettings())) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

to:

```js
router.get('/scan', async (req, res) => {
  try {
    res.json({
      categories: scanAllRules({ ...cleanGuardsFrom(await getSettings()), installedProgramNames: await installedProgramNames() })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

`/execute` and `/execute/stream` are deliberately NOT touched -- see this feature's own design spec for why (a rule the UI never rendered as selectable can't have been ticked; deleting against a path that turns out not to exist is already a safe no-op).

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/routes/deepClean.test.js -t "real installed-programs list"`
Expected: PASS, all 3.

- [ ] **Step 5: Run the full route test file to confirm zero regressions**

Run: `cd backend && npx vitest run src/routes/deepClean.test.js`
Expected: PASS, every pre-existing test in this file unaffected.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/deepClean.js backend/src/routes/deepClean.test.js
git commit -m "feat(cleaners): thread the real installed-programs list into every scan route"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 4: Full-suite and real manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS, no regressions (the 3 pre-existing elevation-gated `pendingReboot`/`quarantine` failures are expected and unrelated -- see this project's own memory notes; everything else, including this feature's own new tests, green).

- [ ] **Step 2: Manual verification against this real dev machine**

This machine genuinely has League of Legends, Riot Client, Epic Games Launcher, and Steam all installed -- the real positive case this fix must not break. Start the app (`preview_start` with the `prune-frontend` launch config; if the real installed Prune.exe is running and holding port 3101, follow the same ask-first/dev-backend/relaunch-after procedure this project already used for Cookies to Preserve's own manual verification). Open Deep Clean, run a real Preview scan, and confirm `league_of_legends_logs`, `riot_client_logs`, `epic_games_cache`, and any populated Steam rule all still report real, non-zero sizes exactly as they did before this change -- proving the gate doesn't false-negative on a real, legitimate install just because it now checks program-name matching in addition to folder existence.

- [ ] **Step 3: Update the memory file**

If a persistent memory file for this project exists (`prune-project.md`), add a short entry noting this fix shipped: the real reported bug (a game rule showing present on a machine that never had the game), the root cause (folder-exists-only checks, no install verification, real evidence of Riot Client scaffolding placeholder folders), and the fix (requiresProgram cross-checked against the real registry-based installed-programs list, scoped to exactly the 8 affected rules).
