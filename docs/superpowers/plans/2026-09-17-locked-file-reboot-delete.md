# Locked-File Reboot-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real crash-on-locked-file bug in `quarantineAndDelete`'s file-move loop, then add an opt-in "delete locked files on next restart" feature on top of the now-safe skip path, using Windows' own `MOVEFILE_DELAY_UNTIL_REBOOT` mechanism (a direct `PendingFileRenameOperations` registry write, since Node has no `MoveFileEx` binding).

**Architecture:** `quarantine.js`'s file loop gains the same try/catch-and-record pattern its registry loop already has. A new `pendingReboot.js` service wraps the `PendingFileRenameOperations` read/append/write as its own tested unit. `settings.js` gains a new opt-in flag, off by default, matching the existing `restorePointBeforeUninstall`/`registryBackupBeforeUninstall` posture. `quarantineAndDelete` takes an optional guard object and, only when the setting is on AND a file is genuinely locked, schedules it for reboot instead of merely reporting it failed.

**Tech Stack:** Node.js (backend, ESM), Windows `reg.exe` (already the codebase's registry-write tool), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-locked-file-reboot-delete-design.md`

---

## Before you start

```bash
cd backend && npm test
```

Expected: all tests pass. **Registry tests exist in this suite (`quarantine.test.js` and this plan's new `pendingReboot.test.js`) — per this repo's CONTRIBUTING.md, run one suite at a time; don't run two registry-touching test files concurrently.**

---

### Task 1: Fix the crash-on-locked-file bug in `quarantineAndDelete`

**Files:**
- Modify: `backend/src/services/quarantine.js`
- Test: `backend/src/services/quarantine.test.js`

**The bug**: `quarantineAndDelete`'s file loop (currently):
```js
const movedFiles = [];
for (const filePath of files) {
  if (!existsSync(filePath)) continue;
  const sizeBytes = (await stat(filePath)).size;
  const dest = join(batchDir, `file-${movedFiles.length}-${basename(filePath)}`);
  await rename(filePath, dest);
  movedFiles.push({ originalPath: filePath, quarantinedPath: dest, sizeBytes });
}
```
has no try/catch. If `rename()` throws (a locked file — `EBUSY` on Windows, or occasionally `EPERM`), the whole function throws, aborting every file after the locked one AND every registry key in the loop below (which never runs at all). The registry loop a few lines below already has the right pattern (`try { ... } catch { failedKeys.push(entry); }`) — the file loop needs the same shape, not a new one.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/services/quarantine.test.js`, inside (or near) the `describe('quarantineAndDelete', ...)` block:

```js
it('does not abort the whole batch when one file is locked -- reports it and keeps going', async () => {
  const lockedPath = join(scratchDir, 'locked.txt');
  const laterPath = join(scratchDir, 'later.txt');
  await writeFile(lockedPath, 'locked content');
  await writeFile(laterPath, 'later content');

  // Simulate a real Windows sharing violation without holding a genuine
  // OS-level lock -- same vi.mock partial-passthrough technique
  // cleanerRules.test.js already establishes for fs.promises.open, applied
  // here to fs.promises.rename instead (this file doesn't already mock
  // node:fs, so add the mock here).
  const { rename: realRename } = await import('node:fs/promises');
  vi.spyOn(await import('node:fs/promises'), 'rename').mockImplementation(async (src, dest) => {
    if (src === lockedPath) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    return realRename(src, dest);
  });

  const manifest = await quarantineAndDelete({ programName: 'Test', files: [lockedPath, laterPath], registryKeys: [] });

  expect(manifest.files.some((f) => f.originalPath === laterPath)).toBe(true);
  expect(manifest.failedFiles).toHaveLength(1);
  expect(manifest.failedFiles[0].path).toBe(lockedPath);
  expect(manifest.failedFiles[0].reason).toMatch(/EBUSY|locked/i);

  vi.restoreAllMocks();
});
```

Check the top of `quarantine.test.js` for its existing imports first — if `vi` isn't already imported from `vitest`, add it to the existing import line.

- [ ] **Step 2: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/services/quarantine.test.js -t "does not abort the whole batch"
```

Expected: `FAIL` — either the mocked rejection propagates out of `quarantineAndDelete` uncaught (the test's own `await quarantineAndDelete(...)` throws instead of returning), or `manifest.failedFiles` is `undefined` (the field doesn't exist yet).

- [ ] **Step 3: Fix it**

In `backend/src/services/quarantine.js`, replace the file loop:

```js
const movedFiles = [];
const failedFiles = [];
for (const filePath of files) {
  if (!existsSync(filePath)) continue;
  try {
    // Stat BEFORE the rename -- same file either side of a same-volume move
    // (rename never changes size), but stat-ing after would be one more
    // opportunity to race a file that vanishes between the two calls.
    const sizeBytes = (await stat(filePath)).size;
    const dest = join(batchDir, `file-${movedFiles.length}-${basename(filePath)}`);
    await rename(filePath, dest);
    movedFiles.push({ originalPath: filePath, quarantinedPath: dest, sizeBytes });
  } catch (err) {
    // A locked file (EBUSY, occasionally EPERM) must not abort every file
    // after it, or every registry key in the loop below -- same
    // partial-results-over-total-failure philosophy the registry loop a
    // few lines down already follows. Recorded, not swallowed: a caller
    // that only reads `files` would report a clean batch while a file is
    // still sitting exactly where it was.
    failedFiles.push({ path: filePath, reason: err.message });
  }
}
```

Add `failedFiles` to the returned manifest:

```js
const manifest = {
  programName, createdAt: Date.now(), batchDir,
  files: movedFiles, failedFiles, registryKeys: exportedKeys, failedRegistryKeys: failedKeys, regFiles,
  totalSizeBytes: movedFiles.reduce((sum, f) => sum + f.sizeBytes, 0)
};
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/services/quarantine.test.js -t "does not abort the whole batch"
```

Expected: 1 passed.

- [ ] **Step 5: Run the full `quarantine.test.js` file, then the full backend suite (alone -- registry contention)**

```bash
npx vitest run src/services/quarantine.test.js
npx vitest run
```

Expected: all pass. `leftoverRemoval.test.js` and any other caller of `quarantineAndDelete` should be unaffected — `failedFiles` is a new, additive field, and `movedFiles`/`registryKeys` behavior for every already-passing scenario is unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/quarantine.js backend/src/services/quarantine.test.js
git commit -m "fix(quarantine): a locked file must not abort the whole quarantine batch

quarantineAndDelete's file loop had no try/catch -- rename() throwing on
one locked file (EBUSY) aborted every file after it AND every registry
key in the loop below, which never ran at all. The registry loop a few
lines down already has the right pattern; the file loop gets the same
one now. New failedFiles field on the manifest, same shape as the
existing failedRegistryKeys."
```

---

### Task 2: `pendingReboot.js` — the `PendingFileRenameOperations` primitive

**Files:**
- Create: `backend/src/services/pendingReboot.js`
- Test: `backend/src/services/pendingReboot.test.js`

This is the actual new Windows mechanism: `MoveFileExW(path, NULL, MOVEFILE_DELAY_UNTIL_REBOOT)`'s own documented behavior, reimplemented as a direct registry read/append/write since Node has no `MoveFileEx` binding and this codebase's convention is to shell out (via `reg.exe`) rather than add a native module.

`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations` is a `REG_MULTI_SZ` — a list of NUL-separated strings, in pairs: `\??\<source path>` followed by either `\??\<dest path>` (a scheduled rename) or an empty string `""` (a scheduled delete). The kernel replays every pair during the next boot's session-manager phase, before any user-mode process starts — which is why this exists at all: it's the one moment nothing can hold a handle to the file.

This task is standalone and fully testable on its own (no wiring into `quarantine.js` yet — that's Task 4).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/pendingReboot.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { schedulePendingDelete, readPendingOperations, PENDING_KEY, PENDING_VALUE } from './pendingReboot.js';

const execFileAsync = promisify(execFile);

/* Real reg.exe against the real key -- same "no mock, prove the real
 * mechanism" convention quarantine.test.js already establishes for the
 * registry. HKLM\SYSTEM\...\Session Manager is a real, always-present
 * Windows key (it holds this value or doesn't; the key itself is never
 * absent on any real Windows install), so there's nothing to create in
 * beforeEach -- only something to clean up in afterEach, and only if
 * this test run actually added to it. */
const MARKER = `\\??\\C:\\prune-pendingreboot-test-marker-${process.pid}.tmp`;

afterEach(async () => {
  // Remove exactly the pairs this test run added, never the whole value --
  // a real machine's PendingFileRenameOperations can legitimately hold
  // entries from Windows Update or another installer, and clobbering the
  // value here would silently cancel a pending operation that has nothing
  // to do with this test.
  const current = await readPendingOperations();
  const cleaned = [];
  for (let i = 0; i < current.length; i += 2) {
    if (current[i] === MARKER) continue;
    cleaned.push(current[i], current[i + 1]);
  }
  if (cleaned.length !== current.length) {
    if (cleaned.length === 0) {
      await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
    } else {
      const args = ['add', PENDING_KEY, '/v', PENDING_VALUE, '/t', 'REG_MULTI_SZ', '/d', cleaned.join('\\0'), '/f'];
      await execFileAsync('reg', args).catch(() => {});
    }
  }
});

describe('readPendingOperations', () => {
  it('returns an array (possibly empty) without throwing on a real machine', async () => {
    const result = await readPendingOperations();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('schedulePendingDelete', () => {
  it('appends a real \\??\\path + empty-string pair to the real registry value', async () => {
    const before = await readPendingOperations();

    await schedulePendingDelete('C:\\prune-pendingreboot-test-marker-' + process.pid + '.tmp');

    const after = await readPendingOperations();
    expect(after.length).toBe(before.length + 2);
    expect(after[after.length - 2]).toBe(MARKER);
    expect(after[after.length - 1]).toBe('');
  });

  it('appends rather than replacing whatever was already pending', async () => {
    await schedulePendingDelete('C:\\prune-pendingreboot-test-marker-' + process.pid + '.tmp');
    const afterFirst = await readPendingOperations();

    await schedulePendingDelete('C:\\prune-pendingreboot-test-marker-' + process.pid + '-second.tmp');
    const afterSecond = await readPendingOperations();

    expect(afterSecond.length).toBe(afterFirst.length + 2);
    expect(afterSecond.slice(0, afterFirst.length)).toEqual(afterFirst);

    // Second cleanup this test itself is responsible for, since afterEach
    // only strips the module-level MARKER.
    const cleaned = afterSecond.filter((_, i) => afterSecond[i - (i % 2)] !== `\\??\\C:\\prune-pendingreboot-test-marker-${process.pid}-second.tmp`);
    // Simplest correct cleanup: just remove the "-second" pair explicitly.
    const secondMarker = `\\??\\C:\\prune-pendingreboot-test-marker-${process.pid}-second.tmp`;
    const withoutSecond = [];
    for (let i = 0; i < afterSecond.length; i += 2) {
      if (afterSecond[i] === secondMarker) continue;
      withoutSecond.push(afterSecond[i], afterSecond[i + 1]);
    }
    if (withoutSecond.length === 0) {
      await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
    } else {
      await execFileAsync('reg', ['add', PENDING_KEY, '/v', PENDING_VALUE, '/t', 'REG_MULTI_SZ', '/d', withoutSecond.join('\\0'), '/f']).catch(() => {});
    }
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/services/pendingReboot.test.js
```

Expected: `FAIL` — `Cannot find module './pendingReboot.js'`.

- [ ] **Step 3: Implement it**

Create `backend/src/services/pendingReboot.js`:

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** The one place Windows itself looks for reboot-scheduled file operations
 * -- this is not Prune's own key, it's the kernel's. Session Manager
 * replays every pair in here during the next boot, before any user-mode
 * process (including Explorer) starts, which is the one moment nothing
 * can hold a handle to a locked file. */
export const PENDING_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager';
export const PENDING_VALUE = 'PendingFileRenameOperations';

/** Reads the current value as a flat array of strings, in the same
 * source/dest pairs Windows itself stores them in. `reg query`'s own
 * REG_MULTI_SZ output separates entries with backslash-zero
 * (`\0`) when queried this way -- confirmed against a real Windows
 * machine's `reg query` output, not assumed from documentation alone.
 * An absent value (nothing pending -- the common case on almost every
 * real machine) is not an error; it's an empty array, same as a rule
 * with nothing to clean is 0 bytes, not a failure. */
export async function readPendingOperations() {
  try {
    const { stdout } = await execFileAsync('reg', ['query', PENDING_KEY, '/v', PENDING_VALUE]);
    // reg query's text output for a REG_MULTI_SZ puts the whole value on
    // one line after the type token, with entries separated by literal
    // "\0" text (not a real NUL byte -- reg.exe escapes it for display).
    const match = stdout.match(/REG_MULTI_SZ\s+(.*)/);
    if (!match) return [];
    const raw = match[1].trim();
    if (!raw) return [];
    return raw.split('\\0');
  } catch {
    // Value or key genuinely absent -- reg query exits non-zero. This is
    // the normal, common state, not a failure.
    return [];
  }
}

/** Schedules `filePath` for deletion at the next boot -- the direct
 * registry-write equivalent of
 * `MoveFileExW(filePath, NULL, MOVEFILE_DELAY_UNTIL_REBOOT)`. Appends
 * rather than replacing: another installer or Windows Update may already
 * have a pending operation queued, and clobbering it would silently
 * cancel work that has nothing to do with this one. Requires admin --
 * `HKLM\SYSTEM` is not writable by a standard user token, and the caller
 * (quarantine.js) only reaches this when the setting that gates it is on
 * AND the file is genuinely locked. */
export async function schedulePendingDelete(filePath) {
  const current = await readPendingOperations();
  const next = [...current, `\\??\\${filePath}`, ''];
  await execFileAsync('reg', ['add', PENDING_KEY, '/v', PENDING_VALUE, '/t', 'REG_MULTI_SZ', '/d', next.join('\\0'), '/f']);
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/services/pendingReboot.test.js
```

Expected: 3 passed. **This test writes to a real, machine-wide, admin-only registry key.** If it fails with an access-denied error, the test process itself isn't elevated -- run it from an elevated terminal, same requirement `quarantine.test.js`'s own HKCU tests don't have (HKCU needs no elevation; HKLM does).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pendingReboot.js backend/src/services/pendingReboot.test.js
git commit -m "feat(pendingReboot): schedule a locked file for delete-on-next-boot

MOVEFILE_DELAY_UNTIL_REBOOT's own documented mechanism, reimplemented
as a direct PendingFileRenameOperations registry read/append/write --
Node has no MoveFileEx binding, and this codebase shells out to reg.exe
rather than adding a native module. Standalone, not yet wired into
quarantine.js's locked-file path."
```

---

### Task 3: Settings toggle

**Files:**
- Modify: `backend/src/services/settings.js`
- Test: `backend/src/services/settings.test.js`

Adds one new field to `DEFAULT_SETTINGS`, off by default, matching `restorePointBeforeUninstall`/`registryBackupBeforeUninstall`'s exact posture (an admin-requiring, system-level opt-in never silently on).

- [ ] **Step 1: Write the failing test**

`settings.test.js`'s `describe('getSettings', ...)` block has ONE big test asserting the whole default shape, one field per line — not a separate `it()` per field. Find this line (around line 45):

```js
expect(settings.registryBackupBeforeUninstall).toBe(false); // ~140 MB each time
```

Add immediately after it, same test, same style:

```js
expect(settings.deleteLockedFilesOnRestart).toBe(false); // writes to HKLM, needs admin
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/services/settings.test.js -t "returns the full default shape"
```

(Use whatever the actual enclosing `it(...)` description is — read it off the line just above the block quoted above; it's the one test this whole default-shape assertion lives inside.)

Expected: `FAIL` — `expected undefined to be false`.

- [ ] **Step 3: Implement it**

In `backend/src/services/settings.js`, find `restorePointBeforeUninstall: false,` inside `DEFAULT_SETTINGS` and add the new field right after it (same section, same reasoning style as its neighbors):

```js
  restorePointBeforeUninstall: false,
  registryBackupBeforeUninstall: false,
  /* Revo's own "force deletion" cousin -- a file quarantine/removal
     couldn't move because something has it open gets scheduled for
     deletion at the next restart (MOVEFILE_DELAY_UNTIL_REBOOT's own
     mechanism -- see services/pendingReboot.js) instead of just being
     reported as skipped. Off by default, same posture as the two
     settings above: this writes to HKLM\SYSTEM, a machine-wide key,
     and needs admin -- never something to turn on silently. */
  deleteLockedFilesOnRestart: false,
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/services/settings.test.js
```

Expected: all pass, including the new test.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/settings.js backend/src/services/settings.test.js
git commit -m "feat(settings): add deleteLockedFilesOnRestart, off by default"
```

---

### Task 4: Wire it into `quarantineAndDelete`

**Files:**
- Modify: `backend/src/services/quarantine.js`
- Test: `backend/src/services/quarantine.test.js`

`quarantineAndDelete` gains an optional 4th field on its input object: `deleteLockedFilesOnRestart` (boolean, defaults to `false` if omitted — every existing call site that doesn't pass it keeps today's behavior exactly). When true AND a file's `rename()` fails, schedule it via `pendingReboot.js` instead of only recording it as failed.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/services/quarantine.test.js`:

```js
it('schedules a locked file for delete-on-restart when the setting is on', async () => {
  const lockedPath = join(scratchDir, 'locked.txt');
  await writeFile(lockedPath, 'locked content');

  vi.spyOn(await import('node:fs/promises'), 'rename').mockImplementation(async () => {
    throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
  });

  const manifest = await quarantineAndDelete({
    programName: 'Test', files: [lockedPath], registryKeys: [], deleteLockedFilesOnRestart: true
  });

  expect(manifest.failedFiles).toEqual([]); // scheduled, not failed
  expect(manifest.scheduledForReboot).toEqual([lockedPath]);

  vi.restoreAllMocks();
  // Clean up the real registry write this test caused.
  const { readPendingOperations, PENDING_KEY, PENDING_VALUE } = await import('./pendingReboot.js');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const current = await readPendingOperations();
  const marker = `\\??\\${lockedPath}`;
  const cleaned = [];
  for (let i = 0; i < current.length; i += 2) {
    if (current[i] === marker) continue;
    cleaned.push(current[i], current[i + 1]);
  }
  if (cleaned.length === 0) {
    await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
  } else {
    await execFileAsync('reg', ['add', PENDING_KEY, '/v', PENDING_VALUE, '/t', 'REG_MULTI_SZ', '/d', cleaned.join('\\0'), '/f']).catch(() => {});
  }
});

it('does NOT schedule a locked file for reboot when the setting is off (default)', async () => {
  const lockedPath = join(scratchDir, 'locked.txt');
  await writeFile(lockedPath, 'locked content');

  vi.spyOn(await import('node:fs/promises'), 'rename').mockImplementation(async () => {
    throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
  });

  const manifest = await quarantineAndDelete({ programName: 'Test', files: [lockedPath], registryKeys: [] });

  expect(manifest.failedFiles).toHaveLength(1);
  expect(manifest.scheduledForReboot ?? []).toEqual([]);

  vi.restoreAllMocks();
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/services/quarantine.test.js -t "schedules a locked file"
```

Expected: `FAIL` — `manifest.scheduledForReboot` is `undefined`, not `[lockedPath]`.

- [ ] **Step 3: Implement it**

In `backend/src/services/quarantine.js`, add the import:

```js
import { schedulePendingDelete } from './pendingReboot.js';
```

Update the signature and the file loop's catch branch:

```js
export async function quarantineAndDelete({ programName, files, registryKeys, deleteLockedFilesOnRestart = false }) {
  const batchDir = join(quarantineRoot(), `${Date.now()}-${safeSegment(programName)}`);
  await mkdir(batchDir, { recursive: true });

  const movedFiles = [];
  const failedFiles = [];
  const scheduledForReboot = [];
  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    try {
      const sizeBytes = (await stat(filePath)).size;
      const dest = join(batchDir, `file-${movedFiles.length}-${basename(filePath)}`);
      await rename(filePath, dest);
      movedFiles.push({ originalPath: filePath, quarantinedPath: dest, sizeBytes });
    } catch (err) {
      if (deleteLockedFilesOnRestart) {
        try {
          await schedulePendingDelete(filePath);
          scheduledForReboot.push(filePath);
          continue;
        } catch (scheduleErr) {
          // Scheduling itself failed (not elevated, key genuinely
          // unwritable) -- falls through to the ordinary failed-file
          // report below rather than losing the failure silently.
          failedFiles.push({ path: filePath, reason: scheduleErr.message });
          continue;
        }
      }
      failedFiles.push({ path: filePath, reason: err.message });
    }
  }
```

Add `scheduledForReboot` to the manifest:

```js
  const manifest = {
    programName, createdAt: Date.now(), batchDir,
    files: movedFiles, failedFiles, scheduledForReboot,
    registryKeys: exportedKeys, failedRegistryKeys: failedKeys, regFiles,
    totalSizeBytes: movedFiles.reduce((sum, f) => sum + f.sizeBytes, 0)
  };
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/services/quarantine.test.js
```

Expected: all pass (Task 1's test + these 2 new ones + everything pre-existing).

- [ ] **Step 5: Run the full backend suite once, alone (registry contention)**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/quarantine.js backend/src/services/quarantine.test.js
git commit -m "feat(quarantine): schedule a locked file for reboot-delete when the setting is on"
```

---

### Task 5: Thread the setting from `removeLeftovers` through to `quarantineAndDelete`

**Files:**
- Modify: `backend/src/services/leftoverRemoval.js`
- Test: `backend/src/services/leftoverRemoval.test.js`

`removeLeftovers` (the uninstall-flow caller) needs to read the setting and pass it through — this is the one real caller of `quarantineAndDelete` that handles genuinely-locked leftover files (a program's own files can still be running/locked mid-uninstall). Deep Clean's own caller (`cleanerActions/delete.js`) pre-filters locked files via `isFileAccessible()` BEFORE ever reaching `quarantineAndDelete`, so it never needs this — leave that file alone, don't add the setting there.

- [ ] **Step 1: Read the current call site**

In `backend/src/services/leftoverRemoval.js`, find:

```js
export async function removeLeftovers({ programName, files = [], registryKeys = [], destination = 'quarantine' }) {
  if (destination === 'quarantine') {
    return { ...(await quarantineAndDelete({ programName, files, registryKeys })), destination };
  }
```

- [ ] **Step 2: Write the failing test**

Read `backend/src/services/leftoverRemoval.test.js` first to see how its existing tests call `removeLeftovers` and how `quarantineAndDelete` is imported/mocked there (if it's mocked, follow that convention for this test too; if the file's existing tests call the real `quarantineAndDelete`, do the same). Add:

```js
it('passes deleteLockedFilesOnRestart through to quarantineAndDelete', async () => {
  const lockedPath = join(scratchDir, 'locked.txt'); // adjust to match this file's existing fixture setup
  await writeFile(lockedPath, 'locked content');
  vi.spyOn(await import('node:fs/promises'), 'rename').mockImplementation(async () => {
    throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
  });

  const result = await removeLeftovers({
    programName: 'Test', files: [lockedPath], registryKeys: [], destination: 'quarantine',
    deleteLockedFilesOnRestart: true
  });

  expect(result.scheduledForReboot).toEqual([lockedPath]);

  vi.restoreAllMocks();
  // Same registry cleanup as Task 4's test -- remove the pair this test added.
  const { readPendingOperations, PENDING_KEY, PENDING_VALUE } = await import('./pendingReboot.js');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const current = await readPendingOperations();
  const marker = `\\??\\${lockedPath}`;
  const cleaned = [];
  for (let i = 0; i < current.length; i += 2) {
    if (current[i] === marker) continue;
    cleaned.push(current[i], current[i + 1]);
  }
  if (cleaned.length === 0) {
    await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
  } else {
    await execFileAsync('reg', ['add', PENDING_KEY, '/v', PENDING_VALUE, '/t', 'REG_MULTI_SZ', '/d', cleaned.join('\\0'), '/f']).catch(() => {});
  }
});
```

If this test file's existing tests mock `quarantine.js` entirely (check the top of the file for `vi.mock('./quarantine.js', ...)`), adjust: instead of asserting a real `scheduledForReboot` array, assert that the mocked `quarantineAndDelete` was called with `deleteLockedFilesOnRestart: true` in its argument object — `expect(quarantineAndDelete).toHaveBeenCalledWith(expect.objectContaining({ deleteLockedFilesOnRestart: true }))`. Use whichever style matches this file's own established convention; don't introduce a second mocking style into one test file.

- [ ] **Step 3: Run it, confirm it fails**

```bash
npx vitest run src/services/leftoverRemoval.test.js -t "deleteLockedFilesOnRestart"
```

Expected: `FAIL` — the field isn't threaded through yet, so it never reaches `quarantineAndDelete`.

- [ ] **Step 4: Implement it**

```js
export async function removeLeftovers({ programName, files = [], registryKeys = [], destination = 'quarantine', deleteLockedFilesOnRestart = false }) {
  if (destination === 'quarantine') {
    return { ...(await quarantineAndDelete({ programName, files, registryKeys, deleteLockedFilesOnRestart })), destination };
  }
```

- [ ] **Step 5: Run it, confirm it passes, then the full backend suite once (alone -- registry contention)**

```bash
npx vitest run src/services/leftoverRemoval.test.js
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/leftoverRemoval.js backend/src/services/leftoverRemoval.test.js
git commit -m "feat(leftoverRemoval): thread deleteLockedFilesOnRestart through to quarantineAndDelete"
```

---

### Task 6: Route wiring — read the setting, pass it through

**Files:**
- Modify: `backend/src/routes/quarantine.js:38-65` (the `POST /remove` handler)
- Test: `backend/src/routes/quarantine.destination.test.js`

`POST /remove` already calls `getSettings()` (line 53, for `createRestorePoint`) and already calls `removeLeftovers` (line 57). This is one more field off the same settings object, added to the same call.

`quarantine.destination.test.js`'s own mocking shape (read it first, it's short): `settings` is a module-level `let` the `getSettings` mock closure reads directly (`getSettings: async () => settings`), reset to `{ createRestorePoint: true }` in `beforeEach` — NOT a `vi.fn().mockResolvedValue(...)`. Two of its EXISTING tests assert `removeLeftovers` was called with an EXACT 4-key object via `toHaveBeenCalledWith({ programName, files, registryKeys, destination })` — once this task adds a 5th key to every real call, those two exact-match assertions break and must be updated in the SAME commit, not left failing.

- [ ] **Step 1: Update the two pre-existing exact-match assertions**

In `backend/src/routes/quarantine.destination.test.js`, the first test (`'goes to Quarantine when the request names no destination'`) currently asserts:

```js
expect(removeLeftovers).toHaveBeenCalledWith({
  programName: 'Thing', files: ['C:\\x'], registryKeys: [], destination: 'quarantine'
});
```

Change to:

```js
expect(removeLeftovers).toHaveBeenCalledWith({
  programName: 'Thing', files: ['C:\\x'], registryKeys: [], destination: 'quarantine',
  deleteLockedFilesOnRestart: false
});
```

The `'still makes the restore point first, whatever the destination'` test and any other exact-match `toHaveBeenCalledWith` on `removeLeftovers` in this file need the same one-key addition — search the whole file for `toHaveBeenCalledWith` to find every instance (there are at least 2; check for more).

- [ ] **Step 2: Write the new failing test**

Add to the same `describe` block:

```js
it('passes deleteLockedFilesOnRestart from settings through to removeLeftovers', async () => {
  settings = { createRestorePoint: true, deleteLockedFilesOnRestart: true };
  await remove({});
  expect(removeLeftovers.mock.calls[0][0].deleteLockedFilesOnRestart).toBe(true);
});

it('defaults deleteLockedFilesOnRestart to false when settings does not have it', async () => {
  settings = { createRestorePoint: true };
  await remove({});
  expect(removeLeftovers.mock.calls[0][0].deleteLockedFilesOnRestart).toBe(false);
});
```

- [ ] **Step 3: Run it, confirm the two new tests fail and the two updated ones fail too (until Step 4)**

```bash
cd backend && npx vitest run src/routes/quarantine.destination.test.js
```

Expected: 4 failures — the 2 exact-match tests (now expecting a 5th key the route doesn't send yet) and the 2 new ones.

- [ ] **Step 4: Implement it**

In `backend/src/routes/quarantine.js`, change line 57:

```js
const manifest = await removeLeftovers({
  programName, files: files || [], registryKeys: registryKeys || [], destination,
  deleteLockedFilesOnRestart: settings.deleteLockedFilesOnRestart === true
});
```

(`=== true`, not a bare pass-through — a raw `undefined` would fail the exact-match tests' `toBe(false)` assertion, and `=== true` also matches this file's own established defensive style a few lines up: `settings.createRestorePoint === false ? ... : ...`.)

- [ ] **Step 5: Run the test file, then the full backend suite once (alone -- registry contention)**

```bash
npx vitest run src/routes/quarantine.destination.test.js
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/quarantine.js backend/src/routes/quarantine.destination.test.js
git commit -m "feat(quarantine route): read deleteLockedFilesOnRestart from settings"
```

---

### Task 7: Settings UI toggle

**Files:**
- Modify: `frontend/src/components/SettingsPage.jsx` (find the existing `restorePointBeforeUninstall`/`registryBackupBeforeUninstall` toggles and add this one beside them)
- Test: `frontend/src/components/SettingsPage.render.test.jsx` (or whichever test file covers the Uninstall settings section — `grep -rn "restorePointBeforeUninstall" frontend/src` to find it)
- Modify: `frontend/src/i18n/catalog.js` — new catalog key(s) for the toggle's label/description, in the SAME namespace the two neighboring toggles already use, authored in ALL 40 languages (this project's own established i18n convention — see any existing settings toggle for the exact key shape to copy)

- [ ] **Step 1: Find the two existing toggles**

```bash
cd frontend && grep -n "restorePointBeforeUninstall\|registryBackupBeforeUninstall" src/components/SettingsPage.jsx
```

Read the surrounding JSX for one of them in full — its `Toggle` component usage, its label/description `t(...)` calls, and its `onChange` wiring to `saveSettings.mutate(...)`.

- [ ] **Step 2: Write the failing test**

Find this settings section's existing render test (search for `restorePointBeforeUninstall` or `registryBackupBeforeUninstall` across `frontend/src/components/*.test.jsx`) and add a test in the same style: renders the toggle, asserts its label text, asserts clicking it calls `saveSettings.mutate` with `{ deleteLockedFilesOnRestart: true }` (mirroring the existing toggle's own test exactly, one field name swapped).

- [ ] **Step 3: Run it, confirm it fails**

```bash
npx vitest run <that test file> -t "deleteLockedFilesOnRestart"
```

Expected: `FAIL` — the toggle doesn't exist in the JSX yet.

- [ ] **Step 4: Add the catalog keys**

Find the exact namespace and key shape the `restorePointBeforeUninstall` toggle's label/description use in `frontend/src/i18n/catalog.js` (e.g. `settings.uninstall.restorePointBeforeUninstall.label` / `.description`, or whatever the real key path is — read the real file, don't guess). Add matching sibling keys for `deleteLockedFilesOnRestart` in the SAME namespace, authored in all 40 languages this catalog already covers — copy the exact per-language structure the neighboring key uses and translate:
  - Label: something conveying "Delete locked files on next restart" (English)
  - Description: something conveying "Files another program still has open are removed the next time you restart your computer, instead of only being reported as skipped." (English)

This is the single largest step in this task by volume (40 languages × 2 strings) — follow this project's own established pipeline exactly: author every language in the same pass, don't defer any.

- [ ] **Step 5: Add the toggle to `SettingsPage.jsx`**

Immediately after the `registryBackupBeforeUninstall` toggle's own JSX block, add a new one following its exact structure (same `Toggle` component, same `saveSettings.mutate` wiring, new catalog keys from Step 4, new settings field name from Task 3).

- [ ] **Step 6: Run the test file, confirm it passes, then the full frontend suite**

```bash
npx vitest run <that test file>
npx vitest run
```

Expected: all pass, including `catalog.test.js` (which enforces key-set parity across all 40 languages — if Step 4 missed a language, this is where it's caught).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SettingsPage.jsx frontend/src/i18n/catalog.js <the test file>
git commit -m "feat(settings): add the Delete locked files on next restart toggle, all 40 languages"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: all green.

- [ ] **Step 2: Cross-check against the spec**

Re-read `docs/superpowers/specs/2026-09-17-locked-file-reboot-delete-design.md`'s "Implementation scope for this session" paragraph against what was built: the Settings toggle (Task 7) exists, off by default (Task 3); a locked file scheduled via `PendingFileRenameOperations` (Tasks 2, 4) instead of only reported as skipped, when the setting is on; explicitly NOT built: Restart Manager / process-based unlocking (correctly out of scope, not silently missing).

- [ ] **Step 3: Note the bonus fix**

Task 1's fix (the crash-on-locked-file bug in `quarantineAndDelete`'s file loop) was NOT in the original spec — it was found while grounding the plan against the real code, and it's a real, independently-valuable fix regardless of whether the reboot-delete feature is used at all. Make sure whoever reviews the final diff knows this was a genuine pre-existing bug fix, not scope creep — the spec's `docs/superpowers/specs/2026-09-17-locked-file-reboot-delete-design.md` doesn't mention it because it was discovered afterward, during plan-writing, not during the original spec's own investigation.
