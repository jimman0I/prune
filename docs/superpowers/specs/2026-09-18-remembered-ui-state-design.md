# Remembered UI state: design

## Why

User request: "make the app remember every setting and option." Every real Settings-screen option already persists via `settings.json` (confirmed by grep this session -- `excludeFolders`, `theme`, `autoQuarantine`, `cookieKeepList`, and every other toggle already round-trip through the backend). What actually resets on relaunch, confirmed by direct code inspection: the Electron window's size/position/maximized state (hardcoded `1280x860` every launch), the Settings screen's active sub-tab (always reopens on General), and Deep Clean's checkbox selection (always reseeds to `defaultSelection()`, discarding whatever was ticked last time).

## Scope

Three independent, small pieces, approved together:
1. Window bounds (size/position/maximized) -- Electron main process only.
2. Settings' active sub-tab -- frontend-only, localStorage.
3. Deep Clean's rule selection -- backend `settings.json`, same mechanism `cookieKeepList` already uses.

## 1. Window bounds

**Storage:** a new `window-state.json` next to the existing `settings.json`, both under `app.getPath('userData')` (`%APPDATA%\Prune` when packaged) -- same `settingsPath()`/`quarantineRoot()` pattern `electron/main.cjs` already establishes for exactly this reason (survives an app upgrade; an install-relative path wouldn't).

**New file, `electron/windowState.cjs`** (small, separately testable via `node --test`, matching this project's own file-size and testability conventions):

```
resolveWindowState({ saved, displays, defaultBounds }) -> { width, height, x, y, isMaximized }
```

Pure function, no Electron runtime dependency beyond the shapes `screen.getAllDisplays()` and a saved-state object already provide. If `saved` is missing, malformed, or its `x`/`y` position doesn't fall within any display's current work area (a laptop undocked from a second monitor since the last save, the most likely real case), returns `defaultBounds` with `isMaximized: false`. Otherwise returns `saved` as-is. This is the one piece of real logic worth unit-testing in isolation -- the display-validation branch is exactly the kind of thing that's easy to get backwards (inclusive vs. exclusive bounds, an off-by-one on a multi-monitor edge) and cheap to test without ever opening a real window.

`loadWindowState(filePath)` / `saveWindowState(filePath, state)` are the thin, best-effort file I/O wrappers -- a read or write failure never blocks app startup or shutdown (same "best-effort, degrade quietly" posture `allowChildWindowToForeground()` already established in the uninstaller fix).

**`electron/main.cjs` changes:** a new `windowStatePath()` helper (identical shape to `settingsPath()`). Before `new BrowserWindow({...})`, resolve the real bounds via `resolveWindowState()` and spread them into the constructor options in place of the hardcoded `width: 1280, height: 860`. After creation, call `win.maximize()` if the resolved state says `isMaximized: true`. Wire `win.on('resize', ...)` and `win.on('move', ...)` to a debounced (~500ms) save, plus one final unconditional save on `win.on('close', ...)` -- debounced during interaction so a drag doesn't write a file on every pixel, unconditional on close so the very last state is never lost to a pending debounce that got cancelled by the window closing.

## 2. Settings' active sub-tab

**Storage:** localStorage, not `settings.json` -- mirrors `frontend/src/lib/theme.js`'s own precedent exactly: pure UI-navigation memory nobody needs synced, backed up, or exposed in the config file. New `frontend/src/lib/settingsTab.js`, same shape as `theme.js`:

```
SETTINGS_TAB_STORAGE_KEY = 'prune.settingsTab'
readStoredSettingsTab(storage, validTabs) -> tab id or null
writeStoredSettingsTab(storage, tab) -> boolean
```

`validTabs` is passed in by the caller (`SettingsPage.jsx`'s own existing `TAB_IDS` array) rather than duplicated in the lib file, so the lib stays a dependency-free pure module and the one place that actually knows which tabs exist stays the only place that knows. A stored value not in `validTabs` is treated as absent, not trusted -- same defensive rule `theme.js` already applies to a stored value outside `THEMES`.

**`SettingsPage.jsx` change:** `useState('general')` becomes a lazy initializer reading `readStoredSettingsTab(window.localStorage, TAB_IDS) ?? 'general'`; `setTab` gains a small wrapper that also calls `writeStoredSettingsTab`.

## 3. Deep Clean's rule selection

**Storage:** `backend/src/services/settings.js`'s `DEFAULT_SETTINGS` gains `deepCleanSelection: []`, normalized the same defensive way `cookieKeepList` already is (`Array.isArray(settings?.deepCleanSelection) ? settings.deepCleanSelection : []`).

**`DeepClean.jsx` changes:**
- The existing default-selection effect gains one branch: when `categories` first loads and `selected` is still empty, seed from `settings.deepCleanSelection` (as a `Set`) when it's non-empty, falling back to `defaultSelection(categories)` exactly as today when it's empty. The existing post-scan reconciliation effect (which already drops any id a real scan proves invalid) needs zero changes -- it already operates on whatever `selected` currently holds, regardless of where that value came from.
- One new effect: whenever `selected` changes (after `categories` has loaded, so the very first render doesn't write back an empty seed), call `save({ deepCleanSelection: [...selected] })`. A single centralized effect rather than threading a `save()` call into every individual toggle/select-everything/clear/category-tick call site -- all of those already funnel through `setSelected`, so one effect watching the result covers every mutation path at once, including the reconciliation effect's own pruning.

## Testing

- `electron/windowState.test.cjs`: `resolveWindowState()`'s branches (no saved state, saved state on a still-connected display, saved state off-screen after a display was disconnected, saved `isMaximized: true` restored) -- pure, no real window needed. `loadWindowState`/`saveWindowState` against a real temp file (missing file, corrupt JSON, a genuine round-trip).
- `frontend/src/lib/settingsTab.test.js`: mirrors `theme.js`'s own existing test shape -- valid stored tab returned, invalid/unknown stored tab treated as absent, storage-throws tolerated.
- `SettingsPage.render.test.jsx`: a stored tab in `localStorage` before render means Settings opens on that tab, not General.
- `backend/src/services/settings.test.js`: `deepCleanSelection` defaults to `[]`, normalizes a non-array value to `[]`, round-trips a real array through `updateSettings`/`getSettings`.
- `DeepClean.render.test.jsx`: a non-empty `settings.deepCleanSelection` fixture seeds the tree's initial ticks instead of `defaultSelection()`; ticking/unticking a checkbox calls `save` with the updated array.

## Manual verification

- Resize/move/maximize the real window, quit, relaunch -- confirm it reopens exactly where it was left, including maximized state; then physically disconnect a second monitor (or simulate via a display list the window was last positioned on) and confirm it falls back to the default rather than opening off-screen.
- Change a Settings tab, quit, relaunch -- confirm it reopens on that tab.
- Tick a few Deep Clean rules away from the defaults, quit, relaunch, open Deep Clean without running a fresh scan -- confirm the same ticks are still there before any scan runs, then run a scan and confirm any since-invalidated tick is pruned exactly as it already is today.
