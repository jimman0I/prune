# BleachBit-Parity Engine, Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Prune's cleaning engine a real multi-action-type model (today it only knows "delete a path" or "run a shell command"), and add the two highest-value BleachBit action types on top of it: `sqlite.vacuum` (compact a database file, reclaim real disk space, delete no data) and `winreg` (delete a registry key, fully quarantined/restorable).

**Architecture:** `backend/src/data/cleaners.json` rules gain an optional `actions: [...]` array; a new `normalizeRule()` synthesizes one from the existing `paths`/`command` shape for all 75 current rules, so nothing already in the file needs to change. `scanRule`/`executeRule` in `backend/src/lib/cleanerRules.js` become per-action dispatchers over a small handler registry, one file per action type under `backend/src/lib/cleanerActions/` (`delete.js`, `shell.js`, `sqliteVacuum.js`, `winreg.js`). `sqlite.vacuum` shells out to a bundled `sqlite3.exe` CLI (the backend runs inside Electron's own process, so a native SQLite module would need Electron-ABI rebuilds — avoided). `winreg` calls the EXISTING `quarantineAndDelete()` in `backend/src/services/quarantine.js`, which already exports-then-deletes-then-makes-restorable a registry key — zero new registry code.

**Tech Stack:** Node.js (backend, ESM), a bundled SQLite CLI binary (`sqlite3.exe`), Windows `reg.exe` (already wrapped by `quarantine.js`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-bleachbit-parity-phase-a-design.md`

---

## Before you start

Run the backend suite once to confirm a clean baseline, and read the CONTRIBUTING.md note this codebase already has about registry tests: **run one suite at a time** — `quarantine.test.js` and (after Task 6) `winreg.test.js` both drive real `reg.exe` against real HKCU keys, and two vitest processes racing it intermittently fail each other, not from shared state but from tool contention.

```bash
cd backend && npm test
```

Expected: all tests pass (47+ in `cleanerRules.test.js`, the full suite green).

---

### Task 1: Bundle `sqlite3.exe` and wire its resource path

**Files:**
- Create: `electron/build/sqlite3.exe` (binary, downloaded — see Step 1)
- Modify: `electron/electron-builder.config.cjs` (add to `extraResources`)
- Modify: `electron/main.cjs` (set `UNREVO_SQLITE3_PATH` before the backend import)

- [ ] **Step 1: Download the official SQLite command-line tools and extract `sqlite3.exe`**

From `https://www.sqlite.org/download.html`, under "Precompiled Binaries for Windows", download the win-x64 command-line tools zip. As of this plan being written that file is `sqlite-tools-win-x64-3530400.zip` (SHA3-256 `88b4659fe747896b853af10157316b4ade143553efb89c1c8ca7423a278dcc8b`) — if a newer version exists when you do this, use it; SQLite's CLI is stable and any recent release works. In PowerShell:

```powershell
Invoke-WebRequest -Uri "https://www.sqlite.org/2026/sqlite-tools-win-x64-3530400.zip" -OutFile "$env:TEMP\sqlite-tools.zip"
Expand-Archive "$env:TEMP\sqlite-tools.zip" -DestinationPath "$env:TEMP\sqlite-tools" -Force
Copy-Item "$env:TEMP\sqlite-tools\sqlite-tools-win-x64-3530400\sqlite3.exe" "electron\build\sqlite3.exe"
```

`Get-FileHash` does not support SHA3-256 out of the box on most Windows PowerShell installs (it covers SHA1/256/384/512/MD5, a different algorithm family) — a true checksum match isn't always practical offline. The download is over HTTPS directly from `sqlite.org`'s own domain, and the filename/size should match what `download.html` states; do not substitute a mirror or a different source.

- [ ] **Step 2: Verify it runs**

```bash
cd electron && ./build/sqlite3.exe -version
```

Expected: prints a version string like `3.53.0 2026-...`.

- [ ] **Step 3: Add it to the packaged app's resources**

In `electron/electron-builder.config.cjs`, find this line (it's directly below the icon.png entry):

```js
    { from: 'build/icon.png', to: 'icon.png' },
```

Add immediately after it:

```js
    // The CLI sqlite.vacuum actions shell out to -- see
    // backend/src/lib/cleanerActions/sqliteVacuum.js. A real binary asset
    // shipped the same way icon.png already is, not a build-time-only
    // file: main.cjs points UNREVO_SQLITE3_PATH at this exact spot in a
    // packaged app.
    { from: 'build/sqlite3.exe', to: 'sqlite3.exe' },
```

- [ ] **Step 4: Point the backend at it from main.cjs**

In `electron/main.cjs`, find `startBackend()`:

```js
async function startBackend() {
  const quarantineDir = quarantineRoot();
  if (quarantineDir) process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
  const settingsFile = settingsPath();
  if (settingsFile) process.env.UNREVO_SETTINGS_PATH = settingsFile;
  const entry = pathToFileURL(backendEntryPath()).href;
  await import(entry); // side effect: calls server.listen()
}
```

Change it to also set `UNREVO_SQLITE3_PATH` when packaged (dev mode leaves it unset, so `sqliteVacuum.js`'s own dev fallback in Task 5 is what's actually exercised while developing):

```js
async function startBackend() {
  const quarantineDir = quarantineRoot();
  if (quarantineDir) process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
  const settingsFile = settingsPath();
  if (settingsFile) process.env.UNREVO_SETTINGS_PATH = settingsFile;
  // Packaged only -- see sqliteVacuum.js's own dev-mode fallback, which
  // reaches electron/build/sqlite3.exe directly by relative path when
  // this isn't set, the same packaged-vs-dev split iconPath() above uses.
  if (app.isPackaged) process.env.UNREVO_SQLITE3_PATH = path.join(process.resourcesPath, 'sqlite3.exe');
  const entry = pathToFileURL(backendEntryPath()).href;
  await import(entry); // side effect: calls server.listen()
}
```

- [ ] **Step 5: Commit**

```bash
git add electron/build/sqlite3.exe electron/electron-builder.config.cjs electron/main.cjs
git commit -m "build: bundle sqlite3.exe for the upcoming sqlite.vacuum action"
```

---

### Task 2: Extract the `delete` action into its own file (pure move, no behavior change)

**Files:**
- Create: `backend/src/lib/cleanerActions/delete.js`
- Modify: `backend/src/lib/cleanerRules.js:1-181` (remove what moved, import it back)
- Test: `backend/src/lib/cleanerRules.test.js` (existing tests only — none change yet)

This task moves `resolveRuleFiles`, `collectFiles`, `resolveGlob`, `pathToSegments`, `segmentToRegex`, `isAccessDenied`, and `isFileAccessible` out of `cleanerRules.js` verbatim. Nothing about their behavior changes — this is refactor-only, proven by the existing test suite staying green with zero test edits.

- [ ] **Step 1: Run the existing suite first, to have a true baseline**

```bash
cd backend && npx vitest run src/lib/cleanerRules.test.js
```

Expected: all tests pass (this is the file whose behavior must not move at all).

- [ ] **Step 2: Create `backend/src/lib/cleanerActions/delete.js`**

```js
import * as fs from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { partitionCleanableFiles } from '../cleanGuards.js';
import { quarantineAndDelete } from '../../services/quarantine.js';
import { sendToRecycleBin } from '../../services/recycleBin.js';

/** Converts one `*`-bearing path SEGMENT (not a full path) into a
 * case-insensitive RegExp matching a filename/dirname against it --
 * `thumbcache_*.db` -> /^thumbcache_.*\.db$/i, `*` (Firefox's randomized
 * profile folder) -> /^.*$/i. */
function segmentToRegex(segment) {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Resolves one expanded path (which may contain at most one `*` in any
 * single segment -- a filename glob like `thumbcache_*.db`, or a whole
 * wildcard segment like Firefox's randomized profile folder name) against
 * the real filesystem, returning every concrete path it actually matches.
 * A path with no `*` anywhere resolves to exactly itself (existence is
 * checked later, by the caller) -- no directory listing needed for the
 * overwhelmingly common case. */
export function resolveGlob(basePath, segments) {
  if (segments.length === 0) return [basePath];
  const [segment, ...rest] = segments;
  if (!segment.includes('*')) return resolveGlob(join(basePath, segment), rest);

  let entries;
  try {
    entries = readdirSync(basePath, { withFileTypes: true });
  } catch {
    return []; // the wildcard's parent directory doesn't exist -- 0 matches, not an error
  }
  const regex = segmentToRegex(segment);
  const matches = [];
  for (const entry of entries) {
    if (regex.test(entry.name)) matches.push(...resolveGlob(join(basePath, entry.name), rest));
  }
  return matches;
}

/** Splits an expanded absolute Windows path into segments for resolveGlob.
 * The drive letter ("C:") is its own first segment and never contains a
 * `*`, so it always resolves through the literal (non-glob) branch above. */
export function pathToSegments(expandedPath) {
  return expandedPath.split(/[\\/]+/).filter(Boolean);
}

function isAccessDenied(err) {
  return err && (err.code === 'EPERM' || err.code === 'EACCES');
}

/** Recursively collects every real FILE under `targetPath` -- if it's a
 * file itself, that's the one result; if it's a directory, every file
 * inside it (recursively); if it doesn't exist or can't be read
 * (permission error, gone by the time it's visited), it contributes
 * nothing -- same partial-over-total-failure convention cleanup.js's own
 * dirSize/leftoverScan.js already use. */
export function collectFiles(targetPath, out, denied) {
  let st;
  try {
    st = statSync(targetPath);
  } catch (err) {
    if (isAccessDenied(err)) denied.push(targetPath);
    return;
  }
  if (st.isFile()) {
    out.push({ path: targetPath, sizeBytes: st.size, mtimeMs: st.mtimeMs });
    return;
  }
  if (!st.isDirectory()) return;
  let entries;
  try {
    entries = readdirSync(targetPath, { withFileTypes: true });
  } catch (err) {
    if (isAccessDenied(err)) denied.push(targetPath);
    return;
  }
  for (const entry of entries) {
    const full = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out, denied);
    } else if (entry.isFile()) {
      try {
        const stat = statSync(full);
        out.push({ path: full, sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
      } catch (err) {
        if (isAccessDenied(err)) denied.push(full);
      }
    }
  }
}

/** Every real file a `delete` action's paths currently match, as
 * {path, sizeBytes} -- the single source of truth both scan and execute
 * build on, so a preview always shows exactly what Clean would actually
 * free. `paths` here are already environment-expanded by the caller
 * (cleanerRules.js's expandPath stays there -- it's shared by every
 * action type, not `delete`-specific). */
export function resolveActionFiles(expandedPaths, guards = {}) {
  const files = [];
  const denied = [];
  for (const expanded of expandedPaths) {
    const [driveSegment, ...rest] = pathToSegments(expanded);
    if (!driveSegment) continue;
    for (const match of resolveGlob(driveSegment, rest)) {
      collectFiles(match, files, denied);
    }
  }
  const { cleanable, held } = partitionCleanableFiles(files, guards);
  return { files: cleanable, denied, held };
}

/** True if `filePath` can be opened for read+write right now -- Windows
 * enforces exclusive locks for a file another process has open, so this
 * doubles as a real "is this file free to move" check. */
async function isFileAccessible(filePath) {
  try {
    const handle = await fs.promises.open(filePath, 'r+');
    await handle.close();
    return true;
  } catch {
    return false;
  }
}

/** Scans a `delete` action: how much it would free, without touching
 * anything. `expandedPaths` is pre-expanded (see resolveActionFiles). */
export function scan(action, guards = {}) {
  const { files, denied, held } = resolveActionFiles(action.expandedPaths, guards);
  return {
    sizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    fileCount: files.length,
    heldCount: held.length,
    accessible: denied.length === 0
  };
}

/** Executes a `delete` action for real: pre-filters out any locked/
 * inaccessible file (reported in `skipped`, never thrown), then
 * quarantines everything left through the existing quarantine system --
 * moved, not deleted outright, so a bad match is always recoverable. */
export async function execute(action, ruleName, guards = {}) {
  const { files: candidates, held } = resolveActionFiles(action.expandedPaths, guards);
  const accessible = [];
  const skipped = [...held];
  for (const file of candidates) {
    if (await isFileAccessible(file.path)) accessible.push(file.path);
    else skipped.push({ path: file.path, reason: 'locked or inaccessible' });
  }

  if (accessible.length === 0) return { freedBytes: 0, skipped };

  if (guards.autoQuarantine === false) {
    const sizeOf = new Map(candidates.map((f) => [f.path, f.sizeBytes]));
    const { recycled, failed, error } = await sendToRecycleBin(accessible);
    for (const path of failed) skipped.push({ path, reason: error ? `could not be recycled: ${error}` : 'could not be recycled' });
    return {
      freedBytes: recycled.reduce((sum, path) => sum + (sizeOf.get(path) || 0), 0),
      recycled: true,
      skipped
    };
  }

  try {
    const manifest = await quarantineAndDelete({
      programName: `Deep Clean: ${ruleName}`,
      files: accessible,
      registryKeys: []
    });
    return { freedBytes: manifest.totalSizeBytes, quarantineBatch: manifest.batchDir, skipped };
  } catch (err) {
    return {
      freedBytes: 0,
      skipped: [...skipped, ...accessible.map((p) => ({ path: p, reason: err.message }))]
    };
  }
}
```

Note the shape change from the original: `scan`/`execute` here take an `action` (with `expandedPaths` already resolved by the caller) instead of a whole `rule` (with raw `paths`). `expandPath` itself stays in `cleanerRules.js` — Task 4 wires the expansion step into the dispatcher, once, before calling any action handler, since `sqlite.vacuum` and `winreg` will need path expansion too and neither should duplicate it.

- [ ] **Step 3: Update `cleanerRules.js` to use it, keeping today's exact behavior**

Remove `segmentToRegex`, `resolveGlob`, `pathToSegments`, `collectFiles`, `isAccessDenied`, `resolveRuleFiles`, and `isFileAccessible` from `cleanerRules.js` (they now live in `delete.js`). Replace the top imports:

```js
import { readFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as deleteAction from './cleanerActions/delete.js';
```

(`quarantineAndDelete`, `partitionCleanableFiles`, `sendToRecycleBin`, `readdirSync`, `statSync`, and `fs` are no longer used directly in `cleanerRules.js` -- they moved with the functions that used them.)

Update `scanRule` to call the moved logic through `delete.js`, keeping its own signature and return shape EXACTLY as before (this task does not yet introduce the `actions` array or `normalizeRule` -- that's Task 4):

```js
export function scanRule(rule, guards = {}) {
  if (rule.command) return { id: rule.id, sizeBytes: null, fileCount: null, present: true, accessible: true };
  const expandedPaths = rule.paths.map(expandPath);
  const result = deleteAction.scan({ expandedPaths }, guards);
  return {
    id: rule.id,
    sizeBytes: result.sizeBytes,
    fileCount: result.fileCount,
    heldCount: result.heldCount,
    present: rulePathsExist(rule),
    accessible: result.accessible
  };
}
```

Update `rulePathsExist` to use the moved `resolveGlob`/`pathToSegments` via `deleteAction`:

```js
export function rulePathsExist(rule) {
  if (rule?.command) return true;
  for (const rawPath of rule?.paths || []) {
    const [driveSegment, ...rest] = deleteAction.pathToSegments(expandPath(rawPath));
    if (!driveSegment) continue;
    for (const match of deleteAction.resolveGlob(driveSegment, rest)) {
      if (existsSync(match)) return true;
    }
  }
  return false;
}
```

Update `executeRule`'s path-rule branch (leave the `rule.command` branch untouched for now -- Task 3 moves that):

```js
export async function executeRule(rule, guards = {}) {
  if (rule.command) {
    try {
      await execFileAsync(rule.command.split(' ')[0], rule.command.split(' ').slice(1));
      return { id: rule.id, ranCommand: true, freedBytes: 0, skipped: [] };
    } catch (err) {
      return { id: rule.id, ranCommand: true, freedBytes: 0, skipped: [], error: err.message };
    }
  }

  const expandedPaths = rule.paths.map(expandPath);
  const result = await deleteAction.execute({ expandedPaths }, rule.name, guards);
  return { id: rule.id, ...result };
}
```

- [ ] **Step 4: Run the full existing suite -- must be unchanged, zero edits to the test file**

```bash
npx vitest run src/lib/cleanerRules.test.js
```

Expected: same pass count as Step 1. If anything fails, the refactor changed behavior somewhere -- compare the failing test's expectation against the moved code line by line before touching the test.

- [ ] **Step 5: Run the whole backend suite, since other files import from `cleanerRules.js`**

```bash
npx vitest run
```

Expected: all pass (this exercises `deepClean.js`, `sandboxTest.js`, `scheduleRunner.js`, `cleanerCategoryIcons.js`, `startupItems.js` -- every consumer listed in the spec's architecture section).

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerActions/delete.js backend/src/lib/cleanerRules.js
git commit -m "refactor(cleanerRules): move the delete action into cleanerActions/delete.js"
```

---

### Task 3: Extract the `shell` action (command rules) into its own file

**Files:**
- Create: `backend/src/lib/cleanerActions/shell.js`
- Modify: `backend/src/lib/cleanerRules.js`

- [ ] **Step 1: Create `backend/src/lib/cleanerActions/shell.js`**

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** A command-based rule (e.g. `ipconfig /flushdns`) has nothing to look
 * for on disk, so it's always applicable. */
export function scan() {
  return { sizeBytes: null, fileCount: null, accessible: true };
}

export async function execute(action) {
  try {
    await execFileAsync(action.command.split(' ')[0], action.command.split(' ').slice(1));
    return { ranCommand: true, freedBytes: 0, skipped: [] };
  } catch (err) {
    return { ranCommand: true, freedBytes: 0, skipped: [], error: err.message };
  }
}
```

- [ ] **Step 2: Wire it into `cleanerRules.js`**

Add the import:

```js
import * as shellAction from './cleanerActions/shell.js';
```

`execFile`/`promisify`/`execFileAsync` are no longer used directly in `cleanerRules.js` -- remove those two imports and the `const execFileAsync = promisify(execFile);` line.

Replace the `rule.command` branch in both `scanRule` and `executeRule`:

```js
export function scanRule(rule, guards = {}) {
  if (rule.command) return { id: rule.id, ...shellAction.scan(), present: true };
  // ...unchanged path-rule branch from Task 2...
}
```

```js
export async function executeRule(rule, guards = {}) {
  if (rule.command) {
    const result = await shellAction.execute({ command: rule.command });
    return { id: rule.id, ...result };
  }
  // ...unchanged path-rule branch from Task 2...
}
```

- [ ] **Step 3: Run the suite**

```bash
npx vitest run
```

Expected: all pass, unchanged.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/cleanerActions/shell.js backend/src/lib/cleanerRules.js
git commit -m "refactor(cleanerRules): move the shell/command action into cleanerActions/shell.js"
```

---

### Task 4: `normalizeRule()` and the `actions` array (foundation)

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

This task introduces the `actions` array WITHOUT changing `scanRule`/`executeRule`'s external behavior at all -- `normalizeRule` is additive and unused by anything else yet, proven by a new, narrowly-scoped test before it touches the dispatchers.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/lib/cleanerRules.test.js` (near the top-level `describe` blocks, after the `executeRules` describe block):

```js
describe('normalizeRule', () => {
  it('synthesizes a delete action from a legacy paths rule, unchanged', () => {
    const rule = { id: 'x', paths: ['%APPDATA%\\X\\Cache'] };
    expect(normalizeRule(rule)).toEqual({
      ...rule,
      actions: [{ type: 'delete', paths: ['%APPDATA%\\X\\Cache'] }]
    });
  });

  it('synthesizes a shell action from a legacy command rule', () => {
    const rule = { id: 'dns', command: 'ipconfig /flushdns' };
    expect(normalizeRule(rule)).toEqual({
      ...rule,
      actions: [{ type: 'shell', command: 'ipconfig /flushdns' }]
    });
  });

  it('passes an already-actions-shaped rule through untouched', () => {
    const rule = { id: 'y', actions: [{ type: 'sqlite.vacuum', path: '%APPDATA%\\Y\\db' }] };
    expect(normalizeRule(rule)).toBe(rule);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerRules.test.js -t "normalizeRule"
```

Expected: `FAIL` -- `normalizeRule is not defined` (not exported/imported in the test file yet).

Add the import in the test file's existing import block from `'./cleanerRules.js'`:

```js
  normalizeRule
```

Run again -- expected: `FAIL` -- `normalizeRule is not a function` (not yet exported from `cleanerRules.js`).

- [ ] **Step 3: Implement it**

Add to `backend/src/lib/cleanerRules.js`, right after `loadCleanerRules`:

```js
/** Gives every rule an `actions` array, synthesizing one from the legacy
 * `paths`/`command` shape when a rule doesn't already have one -- so all
 * 75 rules in cleaners.json keep working with ZERO data migration, and a
 * new rule can be written directly in the richer shape. Every OTHER
 * function in this file reads `rule.actions`, never `rule.paths`/
 * `rule.command` directly, once this normalizes it -- that's what makes
 * adding a new action type (sqlite.vacuum, winreg) a matter of adding a
 * new case to the dispatcher, not touching every rule already written. */
export function normalizeRule(rule) {
  if (rule.actions) return rule;
  if (rule.command) return { ...rule, actions: [{ type: 'shell', command: rule.command }] };
  return { ...rule, actions: [{ type: 'delete', paths: rule.paths }] };
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerRules.test.js -t "normalizeRule"
```

Expected: 3 passed.

- [ ] **Step 5: Run the full suite -- `normalizeRule` is additive, nothing else should move**

```bash
npx vitest run
```

Expected: all pass, same count as before this task.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleanerRules): add normalizeRule(), the actions-array foundation"
```

---

### Task 5: `sqlite.vacuum` action

**Files:**
- Create: `backend/src/lib/cleanerActions/sqliteVacuum.js`
- Test: `backend/src/lib/cleanerActions/sqliteVacuum.test.js`

This action is built and tested standalone in this task -- it is not yet wired into `scanRule`/`executeRule`'s dispatch (that's Task 7). Building and proving each action handler in isolation first means Task 7's dispatch wiring only has to prove ROUTING, not action correctness.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/cleanerActions/sqliteVacuum.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { scan, execute, sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-vacuum-test-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

/** A real SQLite database with real reclaimable free space: insert a lot
 * of rows, then delete most of them. SQLite marks their pages free but
 * does not shrink the file until VACUUM runs -- this is the exact
 * condition the action exists to fix, so the test proves it against a
 * real file rather than asserting on a mock. */
async function makeBloatedDb(path) {
  const sql = [
    'CREATE TABLE t (id INTEGER PRIMARY KEY, data TEXT);',
    ...Array.from({ length: 500 }, (_, i) => `INSERT INTO t (data) VALUES ('${'x'.repeat(500)}-${i}');`),
    'DELETE FROM t WHERE id % 2 = 0;'
  ].join('\n');
  await execFileAsync(sqlite3ExePath(), [path, sql]);
}

describe('sqlite.vacuum scan', () => {
  it('reports the file\'s current size as the (upper-bound) reclaimable amount', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: realSize } = await stat(dbPath);

    const result = scan({ expandedPath: dbPath });

    expect(result.sizeBytes).toBe(realSize);
    expect(result.present).toBe(true);
  });

  it('reports present:false for a file that does not exist', () => {
    const result = scan({ expandedPath: join(scratchDir, 'nope.db') });
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });
});

describe('sqlite.vacuum execute', () => {
  it('shrinks a real bloated database and reports the real byte delta', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: before } = await stat(dbPath);

    const result = await execute({ expandedPath: dbPath });
    const { size: after } = await stat(dbPath);

    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBe(before - after);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.skipped).toEqual([]);
  });

  it('never reports a negative freedBytes when nothing shrinks', async () => {
    const dbPath = join(scratchDir, 'empty.db');
    await execFileAsync(sqlite3ExePath(), [dbPath, 'CREATE TABLE t (id INTEGER);']);

    const result = await execute({ expandedPath: dbPath });

    expect(result.freedBytes).toBeGreaterThanOrEqual(0);
  });

  it('skips a file that is not actually a SQLite database, with a reason, rather than corrupting it', async () => {
    const notADb = join(scratchDir, 'notadb.db');
    await writeFile(notADb, 'this is plain text, not a SQLite file', 'utf8');
    const before = await stat(notADb);

    const result = await execute({ expandedPath: notADb });
    const after = await stat(notADb);

    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].path).toBe(notADb);
    expect(after.size).toBe(before.size); // untouched
  });

  it('reports 0 freedBytes and no error for a file that does not exist', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope.db') });
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('respects excludeExtensions -- the same guard a delete action would honor', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: before } = await stat(dbPath);

    const result = await execute({ expandedPath: dbPath }, { excludeExtensions: ['.db'] });
    const { size: after } = await stat(dbPath);

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
    expect(after.size).toBe(before.size); // untouched
  });

  it('respects skipRecentHours -- refuses a file modified inside the window', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath); // just written -- well inside any positive window

    const result = await execute({ expandedPath: dbPath }, { skipRecentHours: 24 });

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/recently/);
  });

  it('is exempt from autoQuarantine -- vacuums even with autoQuarantine: false, since nothing is deleted', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: before } = await stat(dbPath);

    const result = await execute({ expandedPath: dbPath }, { autoQuarantine: false });
    const { size: after } = await stat(dbPath);

    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/sqliteVacuum.test.js
```

Expected: `FAIL` -- `Cannot find module './sqliteVacuum.js'`.

- [ ] **Step 3: Implement it**

Create `backend/src/lib/cleanerActions/sqliteVacuum.js`:

```js
import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isExcluded, isTooRecent } from '../cleanGuards.js';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

/** Where the bundled sqlite3.exe CLI actually is.
 *
 * A function, not a constant -- read at call time, not import time, same
 * reason settings.js's settingsPath() and quarantine.js's quarantineRoot()
 * both are: a test can override it via env var without touching the real
 * install.
 *
 * Packaged mode: electron/main.cjs sets UNREVO_SQLITE3_PATH from
 * process.resourcesPath before importing the backend (see Task 1). Dev/
 * standalone/test mode: this reaches electron/build/sqlite3.exe directly
 * by relative path -- backend/ and electron/ are sibling folders in this
 * repo, and up 4 levels from this file's own directory
 * (cleanerActions -> lib -> src -> backend) is the repo root. */
export function sqlite3ExePath() {
  return process.env.UNREVO_SQLITE3_PATH
    || join(here, '..', '..', '..', '..', 'electron', 'build', 'sqlite3.exe');
}

/** Same two guards `partitionCleanableFiles` applies to a `delete` action's
 * files, applied here to the ONE file a sqlite.vacuum action names --
 * there's no batch to partition, so this calls the same two underlying
 * checks (`isExcluded`/`isTooRecent`) directly rather than routing through
 * a function built for an array. Returns the reason it's held back, or
 * null if it's clear to touch. `autoQuarantine` is deliberately NOT
 * checked here -- see execute()'s own comment for why. */
function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a sqlite.vacuum action: the file's CURRENT size, which is an
 * upper bound on what vacuuming could reclaim, not a promise -- SQLite's
 * own free-page accounting is only knowable by actually running VACUUM,
 * and a scan must never mutate anything. A file the guards would hold
 * back still reports its real present/size (same as a `delete` action's
 * own scan, which counts held files in `heldCount` rather than hiding
 * them) -- only `execute` actually skips it. */
export function scan(action, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a sqlite.vacuum action: stat before, run VACUUM, stat after.
 * freedBytes is the real byte delta, never negative -- a vacuum that
 * doesn't shrink the file frees 0, not a fabricated negative number.
 *
 * A file that is not actually a valid SQLite database is skipped with a
 * reason rather than risking corruption -- sqlite3.exe itself refuses and
 * exits non-zero against a non-database file, which this treats as the
 * signal to skip rather than throw. A missing file is not an error either
 * -- "nothing to clean" is a normal outcome, same as an absent cache
 * folder for the delete action.
 *
 * `excludeFolders`/`excludeExtensions`/`skipRecentHours` apply exactly as
 * they do to a `delete` action's files. `autoQuarantine` does NOT apply --
 * there is nothing to quarantine here. The file isn't deleted, it's
 * rewritten in place by VACUUM, so "move it to Quarantine first" has no
 * meaning for this action type. This is the one guard sqlite.vacuum is
 * deliberately exempt from. */
export async function execute(action, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }
  try {
    await execFileAsync(sqlite3ExePath(), [action.expandedPath, 'VACUUM;']);
  } catch (err) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: err.message }] };
  }
  const after = statSync(action.expandedPath).size;
  return { freedBytes: Math.max(0, before.size - after), skipped: [] };
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerActions/sqliteVacuum.test.js
```

Expected: 10 passed. (If `sqlite3.exe` isn't yet at `electron/build/sqlite3.exe` because Task 1 was skipped, every test here fails with `ENOENT` -- go back and do Task 1 first.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cleanerActions/sqliteVacuum.js backend/src/lib/cleanerActions/sqliteVacuum.test.js
git commit -m "feat(cleanerActions): add the sqlite.vacuum action, standalone"
```

---

### Task 6: `winreg` action

**Files:**
- Create: `backend/src/lib/cleanerActions/winreg.js`
- Test: `backend/src/lib/cleanerActions/winreg.test.js`

Same "standalone, not yet wired into dispatch" posture as Task 5. Registry tests here follow `quarantine.test.js`'s own established convention EXACTLY: a real, disposable HKCU key unique to this process, not a mock -- because the point of these tests is that a real registry key actually goes away and comes back, which a mock cannot prove. **Run this file alone, not concurrently with `quarantine.test.js`** (both drive `reg.exe` against real keys; per CONTRIBUTING.md, run one suite at a time).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/cleanerActions/winreg.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './winreg.js';

const execFileAsync = promisify(execFile);

// Unique per process, same reasoning quarantine.test.js's own TEST_KEY
// documents: a fixed name means two concurrent runs tear down each
// other's fixture.
const TEST_KEY_NAME = `prune-winreg-test-${process.pid}`;
const TEST_KEY = `HKCU\\Software\\${TEST_KEY_NAME}`;

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), `prune-winreg-test-${process.pid}-`));
  process.env.UNREVO_QUARANTINE_ROOT = scratchDir;
  await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Marker', '/d', 'test-value', '/f']);
});
afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(scratchDir, { recursive: true, force: true });
  try { await execFileAsync('reg', ['delete', TEST_KEY, '/f']); } catch { /* already gone */ }
});

describe('winreg scan', () => {
  it('reports present:true for a key that exists', async () => {
    expect(await scan({ expandedKey: TEST_KEY })).toEqual({ present: true });
  });

  it('reports present:false for a key that does not exist', async () => {
    expect(await scan({ expandedKey: `${TEST_KEY}-does-not-exist` })).toEqual({ present: false });
  });
});

describe('winreg execute', () => {
  it('deletes a real key and reports registryKeysRemoved: 1', async () => {
    const result = await execute({ expandedKey: TEST_KEY }, 'Test Rule');

    expect(result.registryKeysRemoved).toBe(1);
    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();
  });

  it('is quarantined, not permanently gone -- the .reg backup exists in the batch', async () => {
    const result = await execute({ expandedKey: TEST_KEY }, 'Test Rule');

    expect(result.quarantineBatch).toBeTruthy();
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(result.quarantineBatch);
    expect(files.some((f) => f.endsWith('.reg'))).toBe(true);
  });

  it('reports registryKeysRemoved: 0 for a key that is already absent, without erroring', async () => {
    const result = await execute({ expandedKey: `${TEST_KEY}-does-not-exist` }, 'Test Rule');
    expect(result.registryKeysRemoved).toBe(0);
    expect(result.freedBytes).toBe(0);
  });

  it('refuses a protected key, the same guard quarantine.js already enforces', async () => {
    // Depth under 3 segments is always protected -- see registryLeftovers.js's
    // isProtectedKey. 'HKCU\Software' alone is exactly that case.
    const result = await execute({ expandedKey: 'HKCU\\Software' }, 'Test Rule');
    expect(result.registryKeysRemoved).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/winreg.test.js
```

Expected: `FAIL` -- `Cannot find module './winreg.js'`.

- [ ] **Step 3: Implement it**

Create `backend/src/lib/cleanerActions/winreg.js`:

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { quarantineAndDelete } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

/** Whether a registry key exists at all -- `reg query` throws (non-zero
 * exit) when it doesn't, which this treats as the answer rather than an
 * error. No byte size is reported: a registry key doesn't have one worth
 * showing, and `0` would read as "measured and empty" rather than "not
 * the kind of thing this is measured in." */
export async function scan(action) {
  try {
    await execFileAsync('reg', ['query', action.expandedKey]);
    return { present: true };
  } catch {
    return { present: false };
  }
}

/** Deletes one registry key -- through quarantineAndDelete, NOT a raw
 * `reg delete` call. That function already exports the key to a .reg file
 * in the quarantine batch BEFORE deleting it, and restoreQuarantineBatch
 * already re-imports it -- the same path an uninstall's own leftover
 * registry removal already uses. This is not new registry code; it's the
 * same primitive called from a second place.
 *
 * registryKeysRemoved is read off how many keys quarantineAndDelete
 * actually recorded as removed (0 if the key was already gone or was
 * refused as protected -- either way not an error, same "nothing to
 * clean" posture an absent cache folder gets from the delete action). */
export async function execute(action, ruleName) {
  const present = await scan(action);
  if (!present.present) return { freedBytes: 0, registryKeysRemoved: 0, skipped: [] };

  const manifest = await quarantineAndDelete({
    programName: `Deep Clean: ${ruleName}`,
    files: [],
    registryKeys: [action.expandedKey]
  });

  return {
    freedBytes: 0,
    registryKeysRemoved: manifest.registryKeys.length,
    quarantineBatch: manifest.batchDir,
    skipped: manifest.failedRegistryKeys.map((key) => ({ path: key, reason: 'protected or could not be removed' }))
  };
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerActions/winreg.test.js
```

Expected: 6 passed.

- [ ] **Step 5: Run the FULL backend suite once, alone (registry contention -- see the note at the top of this task)**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerActions/winreg.js backend/src/lib/cleanerActions/winreg.test.js
git commit -m "feat(cleanerActions): add the winreg action, standalone -- quarantined via quarantineAndDelete"
```

---

### Task 7: Wire `sqlite.vacuum` and `winreg` into the dispatcher

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

This is where `scanRule`/`executeRule` become genuine per-action dispatchers over ALL FOUR action types, and where a rule mixing action types is proven to sum correctly end to end.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/lib/cleanerRules.test.js`:

```js
import * as sqliteVacuum from './cleanerActions/sqliteVacuum.js';

describe('actions-array rules', () => {
  it('sums freedBytes across a delete action AND a sqlite.vacuum action under one rule', async () => {
    const dir1 = join(appDataDir, 'mixed', 'cache');
    await mkdir(dir1, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345'); // 5 bytes

    const dbPath = join(appDataDir, 'mixed', 'test.db');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    await execFileAsync(sqliteVacuum.sqlite3ExePath(), [dbPath,
      'CREATE TABLE t (id INTEGER PRIMARY KEY, data TEXT);' +
      Array.from({ length: 300 }, (_, i) => `INSERT INTO t (data) VALUES ('${'x'.repeat(500)}-${i}');`).join('') +
      'DELETE FROM t WHERE id % 2 = 0;'
    ]);
    const { statSync } = await import('node:fs');
    const dbSizeBefore = statSync(dbPath).size;

    const rule = {
      id: 'mixed', category: 'Test', name: 'Mixed rule',
      actions: [
        { type: 'delete', paths: ['%APPDATA%\\mixed\\cache'] },
        { type: 'sqlite.vacuum', path: '%APPDATA%\\mixed\\test.db' }
      ]
    };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBeGreaterThan(5); // the 5-byte file, plus real vacuum reclaim
    expect(statSync(dbPath).size).toBeLessThan(dbSizeBefore);
  });

  it('reports registryKeysRemoved, not a fabricated freedBytes, for a winreg-only rule', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const testKey = `HKCU\\Software\\prune-dispatch-test-${process.pid}`;
    await execFileAsync('reg', ['add', testKey, '/v', 'Marker', '/d', 'x', '/f']);

    const rule = {
      id: 'reg-only', category: 'Test', name: 'Registry-only rule',
      actions: [{ type: 'winreg', key: testKey }]
    };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBe(0);
    expect(result.registryKeysRemoved).toBe(1);

    try { await execFileAsync('reg', ['delete', testKey, '/f']); } catch { /* already gone, expected */ }
  });

  it('scans a sqlite.vacuum-only rule, reporting the file size as sizeBytes', async () => {
    const dbPath = join(appDataDir, 'solo.db');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    await execFileAsync(sqliteVacuum.sqlite3ExePath(), [dbPath, 'CREATE TABLE t (id INTEGER);']);
    const { statSync } = await import('node:fs');
    const realSize = statSync(dbPath).size;

    const rule = { id: 'solo', category: 'Test', name: 'Solo vacuum', actions: [{ type: 'sqlite.vacuum', path: '%APPDATA%\\solo.db' }] };

    const result = scanRule(rule);

    expect(result.sizeBytes).toBe(realSize);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerRules.test.js -t "actions-array rules"
```

Expected: `FAIL` -- `scanRule`/`executeRule` don't recognize `sqlite.vacuum`/`winreg` action types yet (they'll either throw or silently do nothing, since today's `scanRule`/`executeRule` only branch on `rule.command` vs `rule.paths`, neither of which a new-shape rule has).

- [ ] **Step 3: Implement the dispatcher**

In `backend/src/lib/cleanerRules.js`, add the two new action imports alongside the existing `deleteAction`/`shellAction` ones:

```js
import * as sqliteVacuumAction from './cleanerActions/sqliteVacuum.js';
import * as winregAction from './cleanerActions/winreg.js';
```

Replace `scanRule` with a real per-action dispatcher over the normalized `actions` array:

```js
export function scanRule(rule, guards = {}) {
  const normalized = normalizeRule(rule);
  let sizeBytes = null, fileCount = null, heldCount = 0, accessible = true, present = false;

  for (const action of normalized.actions) {
    if (action.type === 'shell') {
      present = true;
      accessible = accessible && true;
      // sizeBytes/fileCount stay null -- a shell action has nothing to measure.
    } else if (action.type === 'delete') {
      const expandedPaths = action.paths.map(expandPath);
      const result = deleteAction.scan({ expandedPaths }, guards);
      sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
      fileCount = (fileCount ?? 0) + result.fileCount;
      heldCount += result.heldCount;
      accessible = accessible && result.accessible;
      if (expandedPaths.some((p) => rulePathsExistFor(p))) present = true;
    } else if (action.type === 'sqlite.vacuum') {
      const result = sqliteVacuumAction.scan({ expandedPath: expandPath(action.path) });
      sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
      if (result.present) present = true;
    } else if (action.type === 'winreg') {
      // Presence is checked asynchronously by winreg's own scan(), which
      // this synchronous function can't await -- reported via `present`
      // best-effort as true (registry actions don't gate `present` the
      // way a missing cache folder does; executeRule's own winreg branch
      // is what actually determines whether anything happens). Revisit
      // if a future rule needs an accurate pre-scan presence check for a
      // registry-only rule.
      present = true;
    }
  }

  return { id: rule.id, sizeBytes, fileCount, heldCount, present, accessible };
}

/** Whether ONE already-expanded path (from a delete action) exists --
 * used by scanRule's per-action loop above so a rule mixing action types
 * can still answer "present" correctly without calling the whole-rule
 * rulePathsExist(), which expects raw (unexpanded) rule.paths. */
function rulePathsExistFor(expandedPath) {
  const [driveSegment, ...rest] = deleteAction.pathToSegments(expandedPath);
  if (!driveSegment) return false;
  return deleteAction.resolveGlob(driveSegment, rest).some((match) => existsSync(match));
}
```

Replace `executeRule`:

```js
export async function executeRule(rule, guards = {}) {
  const normalized = normalizeRule(rule);
  let freedBytes = 0;
  let registryKeysRemoved;
  const skipped = [];
  let recycled, quarantineBatch, ranCommand, error;

  for (const action of normalized.actions) {
    if (action.type === 'shell') {
      const result = await shellAction.execute(action);
      ranCommand = true;
      if (result.error) error = result.error;
    } else if (action.type === 'delete') {
      const expandedPaths = action.paths.map(expandPath);
      const result = await deleteAction.execute({ expandedPaths }, rule.name, guards);
      freedBytes += result.freedBytes;
      skipped.push(...result.skipped);
      if (result.recycled) recycled = true;
      if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
    } else if (action.type === 'sqlite.vacuum') {
      const result = await sqliteVacuumAction.execute({ expandedPath: expandPath(action.path) }, guards);
      freedBytes += result.freedBytes;
      skipped.push(...result.skipped);
    } else if (action.type === 'winreg') {
      const result = await winregAction.execute({ expandedKey: expandPath(action.key) }, rule.name);
      freedBytes += result.freedBytes;
      registryKeysRemoved = (registryKeysRemoved || 0) + result.registryKeysRemoved;
      skipped.push(...result.skipped);
      if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
    }
  }

  return {
    id: rule.id,
    freedBytes,
    skipped,
    ...(registryKeysRemoved !== undefined ? { registryKeysRemoved } : {}),
    ...(recycled ? { recycled } : {}),
    ...(quarantineBatch ? { quarantineBatch } : {}),
    ...(ranCommand ? { ranCommand } : {}),
    ...(error ? { error } : {})
  };
}
```

Note: `expandPath` already understands plain strings; a `winreg` action's `key` (e.g. `HKCU\Software\Adobe\Acrobat Reader\9.0\AVGeneral\cRecentFiles`) contains no `%TOKEN%` so `expandPath` is a harmless no-op on it here -- it's called for consistency (every action field that could theoretically need expansion goes through the one expander) rather than because a real `winreg` rule needs it today.

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerRules.test.js
```

Expected: all pass, including the new `actions-array rules` describe block (47+3 = 50+).

- [ ] **Step 5: Run the full backend suite**

```bash
npx vitest run
```

Expected: all pass. Run this one alone (registry + reg.exe contention, per the note at the top of Task 6).

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleanerRules): wire sqlite.vacuum and winreg into scanRule/executeRule"
```

---

### Task 8: `executeLogLine` picks its verb from the rule's dominant action type

**Files:**
- Modify: `frontend/src/lib/scanLog.js`
- Test: `frontend/src/lib/scanLog.test.js`

The spec flags this: `executeLogLine` currently always says "Delete X" / "Recycle X", which reads oddly for a rule that only vacuums a database or only removes a registry key. This task is small and self-contained -- it depends only on the STREAMED RESULT SHAPE (`registryKeysRemoved` present or not), not on the backend dispatch wiring being reachable from a real HTTP call, so it can be done independently of whether Task 7's backend changes have been deployed anywhere the frontend can see yet.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/lib/scanLog.test.js`, inside the existing `describe('executeLogLine', ...)` block:

```js
it('says "Compact", not "Delete", for a rule with no files removed but a real byte reduction', () => {
  const line = executeLogLine({ id: 'x', name: 'X Database', freedBytes: 2048, skipped: [], fileCount: 0 });
  expect(line.label).toBe('Compact X Database');
});

it('says "Reset", not "Delete", for a registry-only rule', () => {
  const line = executeLogLine({ id: 'x', name: 'X Recent Files', freedBytes: 0, registryKeysRemoved: 1, skipped: [] });
  expect(line).toEqual({ label: 'Reset X Recent Files', detail: '1 registry key', tone: 'size' });
});

it('still says "Delete" for an ordinary file-removal rule, unchanged', () => {
  const line = executeLogLine({ id: 'x', name: 'X Cache', freedBytes: 1024, skipped: [] });
  expect(line.label).toBe('Delete X Cache');
});
```

- [ ] **Step 2: Run it, confirm the new two fail**

```bash
cd frontend && npx vitest run src/lib/scanLog.test.js -t "Compact|Reset"
```

Expected: 2 failures (both currently say "Delete X...").

- [ ] **Step 3: Implement it**

In `frontend/src/lib/scanLog.js`, replace `executeLogLine`:

```js
export function executeLogLine(item) {
  if (item.error) {
    return { label: item.name ?? item.id, detail: item.error, tone: 'warning' };
  }

  // The verb says what actually happened, not just what was chosen --
  // a rule that only vacuums a database or only removes a registry key
  // never "Deletes" anything, and saying so would be inaccurate, not
  // just imprecise.
  if (item.registryKeysRemoved !== undefined) {
    const label = `Reset ${item.name ?? item.id}`;
    return item.registryKeysRemoved > 0
      ? { label, detail: `${item.registryKeysRemoved} registry key${item.registryKeysRemoved === 1 ? '' : 's'}`, tone: 'size' }
      : { label, detail: 'already absent', tone: 'muted' };
  }

  // A rule whose freedBytes came entirely from compacting a database
  // (fileCount explicitly 0, not merely absent/undefined) rather than
  // removing files.
  if (item.fileCount === 0 && item.freedBytes > 0) {
    return { label: `Compact ${item.name ?? item.id}`, detail: formatBytes(item.freedBytes), tone: 'size' };
  }

  const verb = item.recycled ? 'Recycle' : 'Delete';
  const label = `${verb} ${item.name ?? item.id}`;

  if (item.freedBytes > 0) {
    const lockedSuffix = item.skipped?.length > 0 ? `, ${item.skipped.length} locked` : '';
    return { label, detail: `${formatBytes(item.freedBytes)}${lockedSuffix}`, tone: 'size' };
  }

  if (item.skipped?.length > 0) {
    return { label, detail: `${item.skipped.length} locked`, tone: 'warning' };
  }

  return { label, detail: 'already empty', tone: 'muted' };
}
```

This is additive over the existing function -- every existing test in the `describe('executeLogLine', ...)` block (a plain delete/recycle rule, an error, an empty rule, a locked-files rule) hits none of the two new early-return branches (`registryKeysRemoved` is `undefined` for those, and `fileCount` isn't explicitly `0`), so they keep passing unchanged.

- [ ] **Step 4: Run it, confirm all three new tests pass, and nothing existing broke**

```bash
npx vitest run src/lib/scanLog.test.js
```

Expected: all pass (the pre-existing count plus 3).

- [ ] **Step 5: Regression-check -- revert the new branches, confirm the new tests fail, restore**

```bash
git stash
```

(stashes the scanLog.js implementation change, keeping the new tests since they're in a different hunk if committed separately -- if working in one uncommitted diff, temporarily comment out the two new `if` blocks instead)

```bash
npx vitest run src/lib/scanLog.test.js -t "Compact|Reset"
```

Expected: FAIL (confirms the tests actually exercise the new code).

```bash
git stash pop
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/scanLog.js frontend/src/lib/scanLog.test.js
git commit -m "feat(scanLog): executeLogLine picks Compact/Reset for non-delete action results"
```

---

### Task 9: Final verification and spec cross-check

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: all green across all three.

- [ ] **Step 2: Cross-check against the spec's own goals**

Re-read `docs/superpowers/specs/2026-09-14-bleachbit-parity-phase-a-design.md`'s "Goals" section against what was actually built:

- "A rule can declare a mix of action types" -- Task 7's mixed-rule test proves this.
- "Every one of the 75 existing rules keeps working exactly as it does today, with zero data migration" -- Task 2/3's zero-test-edit refactor plus Task 4's `normalizeRule` prove this; confirm by running `npx vitest run src/lib/cleanerRules.test.js` one more time and diffing the pass count against the very first `npm test` run at the top of this plan.
- "sqlite.vacuum and winreg are scannable and executable, following the same guard rules" -- `sqlite.vacuum` respects `excludeFolders`/`excludeExtensions`/`skipRecentHours` only insofar as they'd apply to a single named file (this phase's action shape is one file, not a glob -- if a future rule needs a glob of database files, that's a real follow-up, not silently missing here since the spec's own examples are all single-file). `winreg` has no meaningful file-based guards to apply (a registry key isn't a file) -- this is expected, not a gap, and matches the "wherever they meaningfully apply" wording in the spec's own Goals section.
- "New cleaner rules using the new action types can be authored once this ships" -- explicitly NOT part of this phase's deliverable per the spec's own Non-goals; confirm no actual new `cleaners.json` rules were added as part of this plan (there shouldn't be any -- this phase is the engine, not new content).

- [ ] **Step 3: Update the project memory / backlog note**

This phase is Phase A of item 5 in Prune's 2.6.0 backlog. Once this plan's tasks are all checked off and committed, item 5 is "Phase A done, Phases B/C/D (json, cookie, per-app bespoke SQL) not started" -- not "item 5 done." Say so plainly wherever this project's own progress notes live, rather than letting "the rewrite" read as finished when three of its four phases haven't started.
