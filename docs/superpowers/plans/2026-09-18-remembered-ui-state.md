# Remembered UI State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three independent pieces of UI state that currently reset every relaunch -- window size/position/maximized state, Settings' active sub-tab, and Deep Clean's rule selection -- start persisting, closing the gap between "every real Settings option already persists" and "some UI state doesn't."

**Architecture:** Each piece uses whichever persistence layer already fits it, matching existing precedent exactly rather than inventing a new one: window bounds get a new small Electron-side JSON file (mirroring `settingsPath()`'s own pattern), the Settings tab uses localStorage (mirroring `theme.js`'s exact precedent), and Deep Clean's selection uses the existing backend `settings.json` (mirroring `acknowledgedCleanWarnings`' own shape and consumption pattern).

**Tech Stack:** Electron main process (CJS, `node --test`), React frontend (Vitest + Testing Library), Node/Express backend (Vitest).

---

### Task 1: `electron/windowState.cjs` -- the pure bounds-resolution logic

**Files:**
- Create: `electron/windowState.cjs`
- Test: `electron/windowState.test.cjs`

- [ ] **Step 1: Write the failing tests**

Create `electron/windowState.test.cjs`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { resolveWindowState, loadWindowState, saveWindowState } = require('./windowState.cjs');

const DEFAULT_BOUNDS = { width: 1280, height: 860 };

// A real single-display layout: 0,0 to 1920,1080.
const ONE_DISPLAY = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];

test('resolveWindowState -- returns the default with isMaximized:false when nothing was saved', () => {
  const result = resolveWindowState({ saved: null, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.deepEqual(result, { ...DEFAULT_BOUNDS, x: undefined, y: undefined, isMaximized: false });
});

test('resolveWindowState -- returns the saved bounds when the saved position is still on a real display', () => {
  const saved = { width: 1000, height: 700, x: 100, y: 100, isMaximized: false };
  const result = resolveWindowState({ saved, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.deepEqual(result, saved);
});

test('resolveWindowState -- falls back to the default when the saved position is on no currently-connected display', () => {
  // A second monitor at x:1920+ that no longer exists -- ONE_DISPLAY only covers 0-1920.
  const saved = { width: 1000, height: 700, x: 2200, y: 100, isMaximized: false };
  const result = resolveWindowState({ saved, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.deepEqual(result, { ...DEFAULT_BOUNDS, x: undefined, y: undefined, isMaximized: false });
});

test('resolveWindowState -- preserves a real isMaximized:true', () => {
  const saved = { width: 1000, height: 700, x: 100, y: 100, isMaximized: true };
  const result = resolveWindowState({ saved, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.equal(result.isMaximized, true);
});

test('resolveWindowState -- treats a malformed saved value as absent', () => {
  for (const junk of [{}, { width: 'nope' }, { width: 1000, height: 700 }, 'not an object', null]) {
    const result = resolveWindowState({ saved: junk, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
    assert.deepEqual(result, { ...DEFAULT_BOUNDS, x: undefined, y: undefined, isMaximized: false });
  }
});

test('loadWindowState / saveWindowState -- round-trips through a real file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'prune-window-state-test-'));
  const filePath = path.join(dir, 'window-state.json');
  try {
    assert.equal(await loadWindowState(filePath), null); // nothing written yet

    const state = { width: 1400, height: 900, x: 50, y: 50, isMaximized: false };
    await saveWindowState(filePath, state);
    assert.deepEqual(await loadWindowState(filePath), state);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadWindowState -- tolerates a corrupt file, returns null rather than throwing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'prune-window-state-test-'));
  const filePath = path.join(dir, 'window-state.json');
  const { writeFile } = require('node:fs/promises');
  try {
    await writeFile(filePath, 'not valid json{{{');
    assert.equal(await loadWindowState(filePath), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd electron && node --test windowState.test.cjs`
Expected: FAIL — `Cannot find module './windowState.cjs'`.

- [ ] **Step 3: Write `windowState.cjs`**

Create `electron/windowState.cjs`:

```js
const { readFile, writeFile } = require('node:fs/promises');

/** Whether a saved window position falls within any currently-connected
 * display's work area. A laptop undocked from a second monitor since the
 * last save is the real case this exists for -- without it, a window
 * saved at x:2200 (once a real second monitor's coordinate space) opens
 * off-screen and invisible on a single-display machine, indistinguishable
 * from the app not launching at all. */
function isOnAnyDisplay(bounds, displays) {
  return displays.some((display) => {
    const area = display.workArea;
    return bounds.x >= area.x && bounds.x < area.x + area.width
      && bounds.y >= area.y && bounds.y < area.y + area.height;
  });
}

function isValidSavedState(saved) {
  return saved
    && typeof saved.width === 'number' && typeof saved.height === 'number'
    && typeof saved.x === 'number' && typeof saved.y === 'number';
}

/** Real bounds to open the window with: the saved ones if they're valid
 * and still on a real, currently-connected display, the app's own
 * default otherwise. Pure -- no Electron runtime dependency beyond the
 * plain shapes `screen.getAllDisplays()` and a saved-state object already
 * provide, so the one piece of real logic here (the display-validation
 * branch) is testable without ever opening a real window. */
function resolveWindowState({ saved, displays, defaultBounds }) {
  if (isValidSavedState(saved) && isOnAnyDisplay(saved, displays)) {
    return saved;
  }
  return { ...defaultBounds, x: undefined, y: undefined, isMaximized: false };
}

/** Best-effort, like every other piece of this feature -- a read failure
 * (missing file, corrupt JSON) means "nothing saved yet", never a crash
 * that blocks the window from opening at all. */
async function loadWindowState(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Best-effort on the write side too -- a failed save should never block
 * app shutdown or resizing. */
async function saveWindowState(filePath, state) {
  try {
    await writeFile(filePath, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

module.exports = { resolveWindowState, loadWindowState, saveWindowState };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd electron && node --test windowState.test.cjs`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add electron/windowState.cjs electron/windowState.test.cjs
git commit -m "feat(window): add windowState, the pure bounds-resolution logic"
```

Note: do NOT add a `Co-Authored-By: Claude` line — this project's convention is no AI attribution in commits.

---

### Task 2: Wire window-state persistence into `electron/main.cjs`

**Files:**
- Modify: `electron/main.cjs`

No test for this task -- `main.cjs` has zero existing test coverage in this project (only `updater.cjs`/`installerLanguages` have their own `.test.cjs` files, both pure-logic modules `main.cjs` delegates to). This is verified by a real `npm start` launch instead, matching this project's own established convention for `main.cjs` changes.

**Exact current code being changed** (already read in full):

```js
function settingsPath() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'settings.json') : null;
}
```

```js
async function createWindow() {
  const startTheme = startingTheme();
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    title: 'Prune',
    backgroundColor: OVERLAY_COLORS[startTheme].color,
    icon: iconPath(),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      ...OVERLAY_COLORS[startTheme],
      height: 40
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  win.removeMenu();
  nudgeOnDisplayChange(win);
```

- [ ] **Step 1: Add the import and a `windowStatePath()` helper**

In `electron/main.cjs`, add the import near the top (alongside the other `require`s):

```js
const { resolveWindowState, loadWindowState, saveWindowState } = require('./windowState.cjs');
```

Add a new helper right after the existing `settingsPath()` function:

```js
/** Same reasoning as settingsPath() -- outside the install directory so
 * an upgrade never wipes it, in the same userData root as everything
 * else Prune persists. */
function windowStatePath() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'window-state.json') : null;
}
```

- [ ] **Step 2: Resolve real bounds before creating the window**

Change `createWindow`'s opening from:

```js
async function createWindow() {
  const startTheme = startingTheme();
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 560,
```

to:

```js
async function createWindow() {
  const startTheme = startingTheme();
  const stateFile = windowStatePath();
  const saved = stateFile ? await loadWindowState(stateFile) : null;
  const resolvedBounds = resolveWindowState({
    saved,
    displays: screen.getAllDisplays(),
    defaultBounds: { width: 1280, height: 860 }
  });
  const win = new BrowserWindow({
    width: resolvedBounds.width,
    height: resolvedBounds.height,
    x: resolvedBounds.x,
    y: resolvedBounds.y,
    minWidth: 900,
    minHeight: 560,
```

(`x`/`y` as `undefined` is safe to pass to `BrowserWindow` -- Electron centers the window on the primary display exactly as it already does today when no position is given, which is the current, unchanged behavior for a fresh install with nothing saved yet.)

- [ ] **Step 3: Maximize if the saved state says so, and wire the save-on-change listeners**

Right after the existing `nudgeOnDisplayChange(win);` line, add:

```js
  if (resolvedBounds.isMaximized) win.maximize();

  if (stateFile) {
    let saveTimer = null;
    const scheduleSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (win.isDestroyed()) return;
        saveWindowState(stateFile, { ...win.getBounds(), isMaximized: win.isMaximized() });
      }, 500);
    };
    win.on('resize', scheduleSave);
    win.on('move', scheduleSave);
    win.on('close', () => {
      // Unconditional, not debounced -- the window is closing right now,
      // so a pending debounce that hasn't fired yet must not be lost.
      clearTimeout(saveTimer);
      saveWindowState(stateFile, { ...win.getBounds(), isMaximized: win.isMaximized() });
    });
  }
```

- [ ] **Step 4: Manual verification**

Run: `cd electron && npm start`
Expected: the app launches with no crash, exactly as before (this machine has no saved `window-state.json` yet, so it opens at the same default 1280x860 centered position it always has). Resize the window, move it, then quit (close the window). Confirm a real `window-state.json` file now exists at the packaged app's userData path (or, in dev mode where `app.isPackaged` is false and `windowStatePath()` returns `null`, confirm instead that nothing crashes and the feature simply doesn't activate in dev -- this matches `settingsPath()`'s and `quarantineRoot()`'s own existing dev-mode-is-null convention exactly, so no dev-specific test path is expected here).

- [ ] **Step 5: Commit**

```bash
git add electron/main.cjs
git commit -m "feat(window): remember size, position and maximized state across relaunch"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 3: `frontend/src/lib/settingsTab.js` -- the pure storage read/write

**Files:**
- Create: `frontend/src/lib/settingsTab.js`
- Test: `frontend/src/lib/settingsTab.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/settingsTab.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SETTINGS_TAB_STORAGE_KEY, readStoredSettingsTab, writeStoredSettingsTab } from './settingsTab.js';

const VALID_TABS = ['general', 'uninstall', 'cleanup', 'about'];

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; }
  };
}

describe('readStoredSettingsTab', () => {
  it('returns a stored value that is one of the real tabs', () => {
    const storage = fakeStorage({ [SETTINGS_TAB_STORAGE_KEY]: 'cleanup' });
    expect(readStoredSettingsTab(storage, VALID_TABS)).toBe('cleanup');
  });

  it('treats a stored value that is not a real tab as absent', () => {
    // localStorage is editable by hand and survives upgrades -- a stale
    // or typo'd value must not crash the tab bar or silently pick
    // something that doesn't exist.
    const storage = fakeStorage({ [SETTINGS_TAB_STORAGE_KEY]: 'not-a-real-tab' });
    expect(readStoredSettingsTab(storage, VALID_TABS)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredSettingsTab(fakeStorage(), VALID_TABS)).toBeNull();
  });

  it('tolerates storage being unavailable rather than throwing', () => {
    const throwingStorage = { getItem: () => { throw new Error('blocked'); } };
    expect(readStoredSettingsTab(throwingStorage, VALID_TABS)).toBeNull();
  });
});

describe('writeStoredSettingsTab', () => {
  it('writes the value under the real key', () => {
    const storage = fakeStorage();
    writeStoredSettingsTab(storage, 'about');
    expect(storage.getItem(SETTINGS_TAB_STORAGE_KEY)).toBe('about');
  });

  it('tolerates storage being unavailable rather than throwing', () => {
    const throwingStorage = { setItem: () => { throw new Error('blocked'); } };
    expect(() => writeStoredSettingsTab(throwingStorage, 'about')).not.toThrow();
    expect(writeStoredSettingsTab(throwingStorage, 'about')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/lib/settingsTab.test.js`
Expected: FAIL — `Cannot find module './settingsTab.js'`.

- [ ] **Step 3: Write `settingsTab.js`**

Create `frontend/src/lib/settingsTab.js`, mirroring `theme.js`'s own exact shape:

```js
/** Which Settings sub-tab reopens by default -- pure UI-navigation
 * memory, stored in localStorage rather than the app's own settings.json
 * for the same reason theme.js's own choice is: nobody needs this
 * synced, backed up, or exposed in the config file, and it's the
 * lightweight place this codebase already keeps exactly this kind of
 * value.
 *
 * `validTabs` is passed in by the caller (SettingsPage.jsx's own real
 * TAB_IDS) rather than duplicated here, so this file stays a
 * dependency-free pure module and the one place that actually knows
 * which tabs exist stays the only place that knows. */
export const SETTINGS_TAB_STORAGE_KEY = 'prune.settingsTab';

/** A stored value not in `validTabs` is treated as absent, not trusted --
 * same defensive rule theme.js already applies to a stored value outside
 * THEMES. Wrapped in try/catch because storage access itself can throw,
 * not just return null (a packaged Electron renderer with site data
 * blocked raises on the getter). */
export function readStoredSettingsTab(storage, validTabs) {
  try {
    const value = storage?.getItem(SETTINGS_TAB_STORAGE_KEY) ?? null;
    return validTabs.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredSettingsTab(storage, tab) {
  try {
    storage?.setItem(SETTINGS_TAB_STORAGE_KEY, tab);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/settingsTab.test.js`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/settingsTab.js frontend/src/lib/settingsTab.test.js
git commit -m "feat(settings): add settingsTab, the pure sub-tab storage read/write"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 4: Wire the remembered tab into `SettingsPage.jsx`

**Files:**
- Modify: `frontend/src/components/SettingsPage.jsx`
- Test: `frontend/src/components/SettingsPage.render.test.jsx`

**Exact current code:**

```js
const TAB_IDS = ['general', 'uninstall', 'cleanup', 'about'];
```
```js
  const [tab, setTab] = useState('general');
```
```jsx
            onClick={() => setTab(tabDef.id)}
```

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/SettingsPage.render.test.jsx`, add this test inside (or alongside) the `describe('cookies to preserve', ...)` block added by an earlier feature, or as its own new `describe`:

```jsx
describe('the remembered Settings tab', () => {
  it('reopens on the tab last chosen, not General', async () => {
    window.localStorage.setItem('prune.settingsTab', 'cleanup');
    renderScreen(<SettingsPage />);
    // The Cleanup tab's own content (its exclusions panel) should be
    // visible without ever clicking the Cleanup button.
    expect(await screen.findByText('Exclude Folders')).toBeTruthy();
  });

  it('writes the choice when a tab is clicked, so it survives the next relaunch', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Cleanup' }));
    expect(window.localStorage.getItem('prune.settingsTab')).toBe('cleanup');
  });
});
```

This file's existing `beforeEach` (used for `vi.clearAllMocks()` and the settings/update-check fixtures) needs one line added so a `localStorage` value written by one test can't leak into another. Find:

```js
beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
  fetchUpdateCheck.mockResolvedValue({ enabled: false, current: '2.3.4' });
});
```

and add `window.localStorage.clear();` as its first line:

```js
beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
  fetchUpdateCheck.mockResolvedValue({ enabled: false, current: '2.3.4' });
});
```

No new import needed -- `window.localStorage` is jsdom's own real implementation, already available in this file's `// @vitest-environment jsdom` test environment without importing anything.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/SettingsPage.render.test.jsx -t "remembered Settings tab"`
Expected: FAIL — the first test finds General's own content instead of Cleanup's; the second finds nothing written to localStorage.

- [ ] **Step 3: Wire it in**

In `frontend/src/components/SettingsPage.jsx`, add the import alongside the other lib imports:

```js
import { readStoredSettingsTab, writeStoredSettingsTab } from '../lib/settingsTab.js';
```

Change:

```js
  const [tab, setTab] = useState('general');
```

to:

```js
  const [tab, setTab] = useState(() => readStoredSettingsTab(window.localStorage, TAB_IDS) ?? 'general');
```

Add a small handler right after (or replacing the inline arrow currently used at the click site):

```js
  const handleTabChange = (id) => {
    setTab(id);
    writeStoredSettingsTab(window.localStorage, id);
  };
```

Change the tab button's `onClick` from:

```jsx
            onClick={() => setTab(tabDef.id)}
```

to:

```jsx
            onClick={() => handleTabChange(tabDef.id)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/components/SettingsPage.render.test.jsx -t "remembered Settings tab"`
Expected: PASS, both tests.

- [ ] **Step 5: Run the full file to confirm zero regressions**

Run: `cd frontend && npx vitest run src/components/SettingsPage.render.test.jsx`
Expected: PASS, every pre-existing test in this file unaffected.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SettingsPage.jsx frontend/src/components/SettingsPage.render.test.jsx
git commit -m "feat(settings): reopen on the last-used Settings tab"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 5: `deepCleanSelection` in `settings.js`

**Files:**
- Modify: `backend/src/services/settings.js`
- Test: `backend/src/services/settings.test.js`

**Exact current code:**

```js
  acknowledgedCleanWarnings: [],
```

(this is the sibling field this task's own new field is modeled on directly -- same shape, same non-involvement in `cleanGuardsFrom()`, since neither is something the cleaning engine itself reads during a real clean; both are pure frontend selection/preference state that just needs to round-trip through `settings.json`.)

- [ ] **Step 1: Write the failing test**

In `backend/src/services/settings.test.js`, add `'deepCleanSelection'` to the existing key list in the `'returns every key the app reads, so a missing one fails here'` test:

```js
  it('returns every key the app reads, so a missing one fails here', async () => {
    const settings = await getSettings();
    for (const key of [
      'excludeFolders', 'excludeExtensions', 'autoQuarantine', 'theme',
      'minimizeToTray', 'skipRecentHours', 'createRestorePoint', 'hideUnavailableRules',
      'acknowledgedCleanWarnings', 'deepCleanSelection',
      'quarantineRetentionDays', 'quarantineMaxSizeGb', 'automation', 'updateCheck'
    ]) {
      expect(settings, key).toHaveProperty(key);
    }
  });
```

Also add a small dedicated test nearby (e.g. right after the `updateSettings` describe block's existing round-trip test):

```js
it('deepCleanSelection defaults to an empty array and round-trips a real one', async () => {
  const before = await getSettings();
  expect(before.deepCleanSelection).toEqual([]);

  await updateSettings({ deepCleanSelection: ['chrome_cache', 'brave_cookies'] });
  const after = await getSettings();
  expect(after.deepCleanSelection).toEqual(['chrome_cache', 'brave_cookies']);
});
```

This file's temp-settings-file isolation (`beforeEach`/`afterEach` setting `process.env.UNREVO_SETTINGS_PATH` to a fresh `mkdtempSync` directory per test) is already at module top-level, not nested inside any one `describe` block -- so every test in this file, including this new one, already gets its own real isolated settings file automatically. Place the new test inside the existing `describe('updateSettings', ...)` block, right after its own "persists a real change that a later getSettings call reads back" test, purely for reading order -- no isolation setup of its own is needed.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/services/settings.test.js -t "deepCleanSelection"`
Expected: FAIL — `deepCleanSelection` doesn't exist on the settings object yet.

- [ ] **Step 3: Add the field**

In `backend/src/services/settings.js`, add a new key right after `acknowledgedCleanWarnings: [],`:

```js
  /* Deep Clean's own checkbox selection, by rule id -- so reopening the
     tab (or relaunching the app) shows the same rules ticked, instead of
     always resetting to defaultSelection(). Not read by cleanGuardsFrom:
     this is pure frontend selection state, never consulted by the
     cleaning engine itself during a real scan or clean, exactly like
     acknowledgedCleanWarnings above it. */
  deepCleanSelection: [],
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/services/settings.test.js -t "deepCleanSelection"`
Expected: PASS.

- [ ] **Step 5: Run the full file to confirm zero regressions**

Run: `cd backend && npx vitest run src/services/settings.test.js`
Expected: PASS, every pre-existing test in this file unaffected.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/settings.js backend/src/services/settings.test.js
git commit -m "feat(deep-clean): add deepCleanSelection to settings.json"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 6: Wire the remembered selection into `DeepClean.jsx`

**Files:**
- Modify: `frontend/src/components/DeepClean.jsx`
- Test: `frontend/src/components/DeepClean.render.test.jsx`

**Exact current code** (already read in full):

```js
  // The listed tree arrives before anything is measured, so the default
  // ticks land as soon as there is something to tick.
  useEffect(() => {
    if (!categories) return;
    setSelected((prev) => (prev.size > 0 ? prev : defaultSelection(categories)));
  }, [categories]);
```

`settings`/`saveSettings` are already destructured earlier in the component: `const { settings, save: saveSettings } = useSettings();`.

**This test file's real fixtures/mocks** (already read in full): `fetchSettings`/`updateSettings` are the mocked functions (not a bare `save`/`saveSettings` name -- `DeepClean.jsx`'s own `useSettings()` hook calls these two under the hood). The `beforeEach` sets `fetchSettings.mockResolvedValue({ excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24, acknowledgedCleanWarnings: [] })`. The `rules` fixture is:

```js
const rules = [{
  category: 'Windows',
  items: [
    { id: 'temp', name: 'Temporary files', sizeBytes: null, fileCount: null },
    { id: 'thumbs', name: 'Thumbnail cache', sizeBytes: null, fileCount: null }
  ]
}];
```

Neither fixture item has `recommended: true`, so `defaultSelection()` already picks nothing for this fixture (confirmed by the existing "cannot clean with nothing selected" test in this same file, which relies on exactly that) -- which makes this fixture ideal for proving the new behavior: if `thumbs` starts checked, it can only be because `settings.deepCleanSelection` seeded it, not the defaults.

- [ ] **Step 1: Write the failing tests**

Add this describe block to `frontend/src/components/DeepClean.render.test.jsx`:

```jsx
describe('the remembered Deep Clean selection', () => {
  it('seeds the initial ticks from settings.deepCleanSelection when defaultSelection would otherwise pick nothing', async () => {
    fetchSettings.mockResolvedValue({
      excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
      skipRecentHours: 24, acknowledgedCleanWarnings: [], deepCleanSelection: ['thumbs']
    });
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');

    const thumbsRow = screen.getByText('Thumbnail cache').closest('div');
    expect(within(thumbsRow).getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
    const tempRow = screen.getByText('Temporary files').closest('div');
    expect(within(tempRow).getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  });

  it('saves the selection whenever it changes, so the next relaunch sees it', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');

    await user.click(screen.getByRole('button', { name: 'Select everything' }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ deepCleanSelection: expect.arrayContaining(['temp', 'thumbs']) })
      );
    });
  });
});
```

`within` and `waitFor` are already imported at the top of this file (`import { screen, waitFor, within, act } from '@testing-library/react';`) -- no new import needed.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/DeepClean.render.test.jsx -t "remembered Deep Clean selection"`
Expected: FAIL — `selected` still seeds from `defaultSelection()` only, and no save call happens on toggle.

- [ ] **Step 3: Wire it in**

In `frontend/src/components/DeepClean.jsx`, change:

```js
  // The listed tree arrives before anything is measured, so the default
  // ticks land as soon as there is something to tick.
  useEffect(() => {
    if (!categories) return;
    setSelected((prev) => (prev.size > 0 ? prev : defaultSelection(categories)));
  }, [categories]);
```

to:

```js
  // The listed tree arrives before anything is measured, so the default
  // ticks land as soon as there is something to tick -- unless a real
  // selection was already saved from a previous session, in which case
  // that's what reopens instead of the defaults.
  useEffect(() => {
    if (!categories) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const saved = settings?.deepCleanSelection;
      if (Array.isArray(saved) && saved.length > 0) return new Set(saved);
      return defaultSelection(categories);
    });
  }, [categories, settings?.deepCleanSelection]);

  // Persists every change to `selected` -- every tick, untick, category
  // toggle, Select Everything/Clear, and the post-scan reconciliation
  // effect's own pruning all funnel through setSelected, so one effect
  // watching the result covers all of them at once rather than a save()
  // call threaded into each individual call site. Gated on `categories`
  // so the very first render (before anything has loaded) never writes
  // back an empty Set over a real saved selection before it's even been
  // read.
  useEffect(() => {
    if (!categories) return;
    saveSettings.mutate({ deepCleanSelection: [...selected] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
```

(The `eslint-disable` comment matches this file's own existing convention -- see the icon-fetching effect earlier in this same file, which already carries an identical comment for the same reason: intentionally excluding a stable-identity dependency from the array.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/components/DeepClean.render.test.jsx -t "remembered Deep Clean selection"`
Expected: PASS, both tests.

- [ ] **Step 5: Run the full file to confirm zero regressions**

Run: `cd frontend && npx vitest run src/components/DeepClean.render.test.jsx`
Expected: PASS, every pre-existing test in this file unaffected -- in particular, confirm the existing "highlights the row of the rule currently being cleaned" and post-scan reconciliation tests still pass unchanged, since the new persistence effect runs alongside them without altering their own logic.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DeepClean.jsx frontend/src/components/DeepClean.render.test.jsx
git commit -m "feat(deep-clean): remember the checkbox selection across relaunch"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 7: Full-suite and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full electron test suite**

Run: `cd electron && node --test *.test.cjs`
Expected: PASS, 26 + the new `windowState.test.cjs` tests, all green.

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS, no regressions (the 3-4 pre-existing elevation-gated `pendingReboot`/`quarantine` failures are expected and unrelated).

- [ ] **Step 3: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 4: Manual verification -- window bounds**

Start the real app (`cd electron && npm run dist` for a real packaged build, or accept that dev mode's `app.isPackaged === false` means `windowStatePath()` returns `null` and this feature is inert in dev -- verify against a real packaged install if one is available, following this project's own established `--remote-debugging-port` or direct launch convention). Resize and move the window, quit, relaunch -- confirm it reopens at the same size/position. Maximize, quit, relaunch -- confirm it reopens maximized.

- [ ] **Step 5: Manual verification -- Settings tab and Deep Clean selection**

Using the dev frontend + dev backend combo (`preview_start` with `prune-frontend`; if the real installed Prune.exe is running and holding port 3101, follow this project's now-established ask-first/dev-backend/relaunch-after procedure): open Settings, switch to Cleanup, reload the page (simulating relaunch, since a full Electron quit/relaunch isn't available from a browser-only dev check) -- confirm it reopens on Cleanup. Open Deep Clean, run a Preview, tick/untick a few rules away from the defaults, reload -- confirm the same ticks are still there before a fresh scan runs.

- [ ] **Step 6: Update the memory file**

If a persistent memory file for this project exists (`prune-project.md`), add a short entry noting this feature shipped: window bounds, Settings tab, and Deep Clean selection all now persist, closing the "remember every setting and option" gap the real Settings options didn't already cover.
