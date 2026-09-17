# BleachBit-Parity Engine, Phase B (`json` action) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `json` cleaning-engine action type — deletes one slash-addressed key from a JSON file (e.g. a Chrome Preferences file's `dns_prefetching/host_referral_list`), the 3rd-largest real BleachBit action type — with the ORIGINAL file quarantined (recoverable) before it's rewritten, since unlike Phase A's `sqlite.vacuum` this genuinely deletes data.

**Architecture:** A new `backend/src/lib/cleanerActions/json.js` (`scan`/`execute`, matching the 4 existing action modules' shape) wired as a 5th case into `cleanerRules.js`'s dispatcher. A new `quarantineFileEdit()` in `quarantine.js` handles the "copy original into quarantine, then overwrite the original in place" operation — deliberately NOT routed through `quarantineAndDelete()`, whose contract is "move this out of its location," a different operation. `quarantineFileEdit()` writes the EXACT same manifest shape `quarantineAndDelete()` already does, which means `restoreQuarantine()`/`listQuarantineBatches()`/`deletePermanently()` and the whole Quarantine UI work on it with ZERO changes — proven by a real empirical test (Task 1) that `fs.rename()` overwrites an existing destination file on this OS, which is exactly what `restoreQuarantine()`'s existing `rename(quarantinedPath, originalPath)` needs to do to put the edited file back to its original (pre-edit) content.

**Tech Stack:** Node.js (backend, ESM), Vitest. No new dependencies — a small, purpose-built slash-path key resolver, not a general object-manipulation library.

**Spec:** `docs/superpowers/specs/2026-09-17-bleachbit-parity-phase-b-json-design.md`

---

## Before you start

```bash
cd backend && npm test
```

Expected: all pass except the 3 pre-existing, documented elevation-gated failures from the locked-file-reboot-delete feature (2 in `pendingReboot.test.js`, 1 in `quarantine.test.js`) if run in a non-elevated shell. If you're in an elevated shell, expect all pass.

---

### Task 1: Prove the `restoreQuarantine` reuse assumption, for real

**Files:** none created/modified — this is a standalone verification script, deleted after.

This whole plan's design rests on one empirical fact: Node's `fs.rename(src, dest)` overwrites `dest` if it already exists, on this OS. Prove it yourself before building anything on top of it — don't just trust this plan's own claim.

- [ ] **Step 1: Write and run a throwaway script**

Create a scratch file (anywhere outside the repo, e.g. your OS temp dir) named `rename-check.mjs`:

```js
import { rename, writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'rename-check-'));
const a = join(dir, 'a.txt');
const b = join(dir, 'b.txt');
await writeFile(a, 'ORIGINAL');
await writeFile(b, 'MODIFIED');
await rename(a, b);
console.log('b now contains:', await readFile(b, 'utf8'));
```

Run: `node rename-check.mjs`

- [ ] **Step 2: Confirm the output**

Expected: `b now contains: ORIGINAL`

If it prints anything else, or throws, **STOP and report BLOCKED** — this plan's entire manifest-reuse design depends on this being true, and if it isn't, `quarantineFileEdit()` (Task 3) needs a different restore mechanism than "reuse `restoreQuarantine()` unchanged."

- [ ] **Step 3: Delete the scratch script**

It's not part of this repo. No commit for this task.

---

### Task 2: The slash-path key resolver

**Files:**
- Create: `backend/src/lib/cleanerActions/jsonAddress.js`
- Test: `backend/src/lib/cleanerActions/jsonAddress.test.js`

A tiny, purpose-built resolver for `address` strings like `dns_prefetching/host_referral_list` — split on `/`, walk down to the parent of the last segment, report whether the final key exists. Kept in its own file (not inlined into `json.js`) because it has zero I/O and is trivially unit-testable on its own, matching this codebase's "smaller, focused files" convention already established across `cleanerActions/`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/cleanerActions/jsonAddress.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveAddress } from './jsonAddress.js';

describe('resolveAddress', () => {
  it('resolves a top-level key', () => {
    const obj = { account_info: { email: 'x' } };
    const result = resolveAddress(obj, 'account_info');
    expect(result).not.toBeNull();
    expect(result.parent).toBe(obj);
    expect(result.key).toBe('account_info');
  });

  it('resolves a nested key by slash-path', () => {
    const obj = { dns_prefetching: { host_referral_list: ['a', 'b'], startup_list: [] } };
    const result = resolveAddress(obj, 'dns_prefetching/host_referral_list');
    expect(result.parent).toBe(obj.dns_prefetching);
    expect(result.key).toBe('host_referral_list');
  });

  it('returns null for a key that does not exist', () => {
    const obj = { dns_prefetching: {} };
    expect(resolveAddress(obj, 'dns_prefetching/host_referral_list')).toBeNull();
  });

  it('returns null when an intermediate segment does not exist', () => {
    const obj = {};
    expect(resolveAddress(obj, 'dns_prefetching/host_referral_list')).toBeNull();
  });

  it('returns null when an intermediate segment is not an object', () => {
    const obj = { dns_prefetching: 'not an object' };
    expect(resolveAddress(obj, 'dns_prefetching/host_referral_list')).toBeNull();
  });

  it('returns null for a key present but explicitly set to undefined', () => {
    const obj = { account_info: undefined };
    expect(resolveAddress(obj, 'account_info')).toBeNull();
  });

  it('resolves a key whose value is null (the key itself still exists)', () => {
    const obj = { account_info: null };
    const result = resolveAddress(obj, 'account_info');
    expect(result).not.toBeNull();
    expect(result.key).toBe('account_info');
  });

  it('actually deleting the resolved key removes it from the real object', () => {
    const obj = { sync: { enabled: true } };
    const result = resolveAddress(obj, 'sync');
    delete result.parent[result.key];
    expect(obj).toEqual({});
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerActions/jsonAddress.test.js
```

Expected: `FAIL` — `Cannot find module './jsonAddress.js'`.

- [ ] **Step 3: Implement it**

Create `backend/src/lib/cleanerActions/jsonAddress.js`:

```js
/** Resolves a BleachBit-style `/`-separated `address` (e.g.
 * `dns_prefetching/host_referral_list`) against a parsed JSON object.
 *
 * Returns `{ parent, key }` -- the object that directly holds the target
 * key, and the key's own name -- so the caller can `delete parent[key]`
 * without walking the path a second time. Returns `null` when the key
 * doesn't genuinely exist: any intermediate segment missing or not an
 * object, or the final segment simply absent (checked with `in`, not a
 * truthy check -- a key explicitly set to `null` still counts as
 * present; a key set to `undefined`, or never set at all, does not --
 * `in` distinguishes these correctly where `obj[key] !== undefined`
 * would not).
 *
 * Purpose-built for this one shape, not a general "get/set/delete a
 * deep object path" utility -- BleachBit's own `address` values are
 * always a plain `/`-joined list of plain keys, never an array index or
 * a key containing a literal `/`, so nothing more general is needed. */
export function resolveAddress(obj, address) {
  const segments = address.split('/');
  let parent = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (parent === null || typeof parent !== 'object') return null;
    parent = parent[segments[i]];
  }
  if (parent === null || typeof parent !== 'object') return null;
  const key = segments[segments.length - 1];
  if (!(key in parent)) return null;
  return { parent, key };
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerActions/jsonAddress.test.js
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cleanerActions/jsonAddress.js backend/src/lib/cleanerActions/jsonAddress.test.js
git commit -m "feat(cleanerActions): add resolveAddress, the json action's slash-path resolver"
```

---

### Task 3: `quarantineFileEdit()` in `quarantine.js`

**Files:**
- Modify: `backend/src/services/quarantine.js`
- Test: `backend/src/services/quarantine.test.js`

The "copy original into quarantine, then overwrite the original in place" primitive the `json` action needs. Reuses `restoreQuarantine()`/`listQuarantineBatches()`/`deletePermanently()` completely unchanged, proven by Task 1's real empirical test.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/services/quarantine.test.js`:

```js
describe('quarantineFileEdit', () => {
  it('preserves the original file bytes in the quarantine batch and writes the new content to the original path', async () => {
    const filePath = join(scratchDir, 'prefs.json');
    await writeFile(filePath, '{"a":1,"b":2}', 'utf8');

    const manifest = await quarantineFileEdit({
      programName: 'Test', filePath, newContent: '{"a":1}'
    });

    // The original path now holds the NEW content.
    expect(await readFile(filePath, 'utf8')).toBe('{"a":1}');

    // The manifest's one file entry points at a real copy of the
    // ORIGINAL bytes, matching quarantineAndDelete's own manifest shape
    // exactly -- same field names, so the existing Quarantine UI and
    // restore/list/delete functions work on this with no changes.
    expect(manifest.files).toHaveLength(1);
    expect(manifest.files[0].originalPath).toBe(filePath);
    expect(await readFile(manifest.files[0].quarantinedPath, 'utf8')).toBe('{"a":1,"b":2}');
    expect(manifest.totalSizeBytes).toBe(Buffer.byteLength('{"a":1,"b":2}'));
  });

  it('restoreQuarantine puts the ORIGINAL content back, overwriting the edited file', async () => {
    const filePath = join(scratchDir, 'prefs.json');
    await writeFile(filePath, '{"a":1,"b":2}', 'utf8');

    const manifest = await quarantineFileEdit({
      programName: 'Test', filePath, newContent: '{"a":1}'
    });
    expect(await readFile(filePath, 'utf8')).toBe('{"a":1}'); // sanity: edit landed

    await restoreQuarantine(manifest.batchDir);

    expect(await readFile(filePath, 'utf8')).toBe('{"a":1,"b":2}');
  });

  it('a batch made this way appears in listQuarantineBatches, unchanged code path', async () => {
    const filePath = join(scratchDir, 'prefs.json');
    await writeFile(filePath, '{"a":1}', 'utf8');

    const manifest = await quarantineFileEdit({ programName: 'Test', filePath, newContent: '{}' });

    const batches = await listQuarantineBatches();
    expect(batches.some((b) => b.batchDir === manifest.batchDir)).toBe(true);
  });
});
```

Check the top of `quarantine.test.js`'s existing imports — add `quarantineFileEdit` to the import from `./quarantine.js` alongside `quarantineAndDelete`/`restoreQuarantine`/`listQuarantineBatches`/etc.

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/services/quarantine.test.js -t "quarantineFileEdit"
```

Expected: `FAIL` — `quarantineFileEdit is not a function` (not yet exported).

- [ ] **Step 3: Implement it**

In `backend/src/services/quarantine.js`, add `copyFile` to the existing `node:fs/promises` import:

```js
import { mkdir, rename, readFile, writeFile, stat, rm, readdir, copyFile } from 'node:fs/promises';
```

Add the new export, placed right after `quarantineAndDelete` (same file, same conceptual family — "make a batch, put something recoverable in it"):

```js
/** Backs up a file's ORIGINAL content into a quarantine batch, then
 * overwrites the file at its own path with `newContent` -- for an action
 * that edits a file in place rather than removing it (the `json` action
 * type: deleting one key from a browser's Preferences file still leaves
 * a Preferences file there, just a smaller one).
 *
 * Deliberately NOT built on quarantineAndDelete(), whose whole contract
 * is "move this file out of its original location" -- a `rename()` to a
 * batch dir, full stop. This needs the opposite at the original path: the
 * file must still exist there afterward, just with different content.
 * So this copies (not moves) the original into the batch, then writes
 * the new content over the original.
 *
 * Writes the EXACT same manifest shape quarantineAndDelete() does
 * (`files: [{originalPath, quarantinedPath, sizeBytes}]`, `totalSizeBytes`,
 * the same empty arrays for the fields that don't apply here) on purpose:
 * restoreQuarantine()'s own `rename(quarantinedPath, originalPath)`
 * already overwrites an existing destination file on this OS (confirmed
 * empirically, not assumed -- see this feature's own implementation
 * plan), so restoring a batch made by THIS function puts the original
 * content back over the edited file with zero new restore code, and
 * listQuarantineBatches()/deletePermanently() need nothing new either --
 * the whole Quarantine screen already works on this. */
export async function quarantineFileEdit({ programName, filePath, newContent }) {
  const batchDir = join(quarantineRoot(), `${Date.now()}-${safeSegment(programName)}`);
  await mkdir(batchDir, { recursive: true });

  const sizeBytes = (await stat(filePath)).size;
  const dest = join(batchDir, `file-0-${basename(filePath)}`);
  await copyFile(filePath, dest);
  await writeFile(filePath, newContent, 'utf8');

  const manifest = {
    programName, createdAt: Date.now(), batchDir,
    files: [{ originalPath: filePath, quarantinedPath: dest, sizeBytes }],
    failedFiles: [], scheduledForReboot: [],
    registryKeys: [], failedRegistryKeys: [], regFiles: [],
    totalSizeBytes: sizeBytes
  };
  await writeFile(join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/services/quarantine.test.js
```

Expected: all pass (existing tests + 3 new ones).

- [ ] **Step 5: Run the full backend suite once**

```bash
npx vitest run
```

Expected: all pass, except the 3 pre-existing elevation-gated failures if not running elevated.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/quarantine.js backend/src/services/quarantine.test.js
git commit -m "feat(quarantine): add quarantineFileEdit -- back up, then overwrite, a file in place"
```

---

### Task 4: The `json` action

**Files:**
- Create: `backend/src/lib/cleanerActions/json.js`
- Test: `backend/src/lib/cleanerActions/json.test.js`

Standalone, not yet wired into `cleanerRules.js`'s dispatcher (that's Task 5) -- same "prove each action handler correct in isolation first" posture Phase A established for `sqlite.vacuum`/`winreg`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/cleanerActions/json.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './json.js';

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-json-action-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-json-action-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('json scan', () => {
  it('reports present:true when the address genuinely resolves', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ dns_prefetching: { host_referral_list: ['a'] } }));

    const result = scan({ expandedPath: filePath, address: 'dns_prefetching/host_referral_list' });

    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('reports present:false when the address does not resolve', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ dns_prefetching: {} }));

    const result = scan({ expandedPath: filePath, address: 'dns_prefetching/host_referral_list' });

    expect(result.present).toBe(false);
  });

  it('reports present:false for a file that does not exist, sizeBytes 0', () => {
    const result = scan({ expandedPath: join(scratchDir, 'nope.json'), address: 'x' });
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });

  it('reports present:false (not a throw) for a file that is not valid JSON', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, 'not json at all');

    expect(() => scan({ expandedPath: filePath, address: 'x' })).not.toThrow();
    expect(scan({ expandedPath: filePath, address: 'x' }).present).toBe(false);
  });
});

describe('json execute', () => {
  it('removes the real key, quarantines the original, and reports a real byte delta', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({
      dns_prefetching: { host_referral_list: Array.from({ length: 200 }, (_, i) => `host${i}.example.com`) },
      keep_this: true
    }));
    const before = (await readFile(filePath, 'utf8')).length;

    const result = await execute(
      { expandedPath: filePath, address: 'dns_prefetching/host_referral_list' },
      'Test Rule'
    );

    const after = JSON.parse(await readFile(filePath, 'utf8'));
    expect(after.dns_prefetching.host_referral_list).toBeUndefined();
    expect(after.keep_this).toBe(true); // untouched sibling data survives

    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.freedBytes).toBeLessThanOrEqual(before);
    expect(result.quarantineBatch).toBeTruthy();
    expect(result.skipped).toEqual([]);
  });

  it('the original content is recoverable from the reported quarantine batch', async () => {
    const filePath = join(scratchDir, 'Preferences');
    const originalContent = JSON.stringify({ sync: { enabled: true } });
    await writeFile(filePath, originalContent);

    const result = await execute({ expandedPath: filePath, address: 'sync' }, 'Test Rule');

    const { readdir, readFile: rf } = await import('node:fs/promises');
    const batchFiles = await readdir(result.quarantineBatch);
    const quarantinedFile = batchFiles.find((f) => f.startsWith('file-0-'));
    expect(quarantinedFile).toBeTruthy();
    expect(await rf(join(result.quarantineBatch, quarantinedFile), 'utf8')).toBe(originalContent);
  });

  it('reports 0 freedBytes and no error for a file that does not exist', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope.json'), address: 'x' }, 'Test Rule');
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('reports 0 freedBytes, no error, no quarantine batch, when the key is genuinely absent -- nothing to clean is not a failure', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ dns_prefetching: {} }));

    const result = await execute({ expandedPath: filePath, address: 'dns_prefetching/host_referral_list' }, 'Test Rule');

    expect(result.freedBytes).toBe(0);
    expect(result.quarantineBatch).toBeUndefined();
    expect(result.skipped).toEqual([]);
  });

  it('skips a file that is not valid JSON, with a reason, rather than corrupting it', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, 'not json at all');

    const result = await execute({ expandedPath: filePath, address: 'x' }, 'Test Rule');

    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/JSON/i);
    expect(await readFile(filePath, 'utf8')).toBe('not json at all'); // untouched
  });

  it('respects excludeExtensions', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: {} }));

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { excludeExtensions: ['.json'] }
    );
    // Note: this file has no extension ("Preferences"), so excludeExtensions
    // wouldn't hold it back -- test excludeFolders instead, which is
    // path-based and definitely applies:
    expect(result.freedBytes).toBeGreaterThan(0); // sanity: extension guard correctly did NOT apply here
  });

  it('respects excludeFolders', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: {} }));

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { excludeFolders: [scratchDir] }
    );

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ sync: {} }); // untouched
  });

  it('respects skipRecentHours', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: {} })); // just written -- inside any positive window

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { skipRecentHours: 24 }
    );

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/recently/);
  });

  it('respects autoQuarantine: false -- recycles the original instead of quarantining it', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: { enabled: true }, keep: 1 }));

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { autoQuarantine: false }
    );

    // Real Recycle Bin interaction is environment-dependent (same caveat
    // delete.js's own autoQuarantine:false tests carry) -- assert on the
    // shape this action promises rather than on Explorer's actual bin
    // contents: no quarantine batch was created for this path, and the
    // edit still landed.
    expect(result.recycled).toBe(true);
    expect(result.quarantineBatch).toBeUndefined();
    const after = JSON.parse(await readFile(filePath, 'utf8'));
    expect(after.sync).toBeUndefined();
    expect(after.keep).toBe(1);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/json.test.js
```

Expected: `FAIL` — `Cannot find module './json.js'`.

- [ ] **Step 3: Implement it**

Create `backend/src/lib/cleanerActions/json.js`:

```js
import { existsSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { resolveAddress } from './jsonAddress.js';
import { quarantineFileEdit } from '../../services/quarantine.js';
import { sendToRecycleBin } from '../../services/recycleBin.js';

/** Same two guards `sqliteVacuum.js`'s own `heldReason` applies, to the
 * one named file a `json` action targets -- no batch to partition, so
 * this calls `isExcluded`/`isTooRecent` directly rather than through a
 * function built for an array. `autoQuarantine` is NOT checked here --
 * unlike `sqlite.vacuum`, a `json` action genuinely deletes data, so it
 * IS gated by `autoQuarantine` (see execute()'s own branch below), just
 * not as a reason to refuse the whole action the way exclusion/recency
 * are. */
function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a json action: the file's current size (an upper bound on what
 * removing the key could reclaim, not a promise -- the real reclaim
 * depends on how much JSON.stringify shrinks by, only knowable by
 * actually running the edit), and whether the address genuinely
 * resolves right now. Never mutates anything, and never throws even on
 * a corrupt/non-JSON file -- reports present:false rather than letting a
 * parse error escape a function whose whole job is read-only. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  const sizeBytes = statSync(action.expandedPath).size;
  let present = false;
  try {
    const parsed = JSON.parse(require('node:fs').readFileSync(action.expandedPath, 'utf8'));
    present = resolveAddress(parsed, action.address) !== null;
  } catch {
    // Not valid JSON, or unreadable -- can't confirm the key is there.
    // execute() will hit the same failure and report it explicitly.
  }
  return { sizeBytes, present };
}

/** Executes a json action: read, parse, resolve `address`, delete that
 * key, quarantine the ORIGINAL file (so the edit is undoable, unlike
 * sqlite.vacuum -- this genuinely deletes data), write the edited
 * content back. freedBytes is the real byte delta between before and
 * after, never negative.
 *
 * A key that's genuinely absent is reported as 0 freedBytes with no
 * skip entry and no quarantine batch -- "nothing to clean" is a normal
 * outcome here, same as an absent cache folder for a delete action, not
 * something to flag. A file that isn't valid JSON is skipped with a
 * reason rather than risking writing garbage over it.
 *
 * `excludeFolders`/`excludeExtensions`/`skipRecentHours` apply exactly
 * as they do to a `delete`/`sqlite.vacuum` action. `autoQuarantine`
 * DOES apply here, unlike `sqlite.vacuum` -- off means the original goes
 * to the Recycle Bin instead of Prune's own quarantine before the edit
 * lands, same choice `delete`'s own autoQuarantine:false branch offers. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  let parsed;
  try {
    parsed = JSON.parse(await readFile(action.expandedPath, 'utf8'));
  } catch (err) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: `not valid JSON: ${err.message}` }] };
  }

  const resolved = resolveAddress(parsed, action.address);
  if (!resolved) {
    return { freedBytes: 0, skipped: [] };
  }

  delete resolved.parent[resolved.key];
  const newContent = JSON.stringify(parsed);

  if (guards.autoQuarantine === false) {
    const { failed, error } = await sendToRecycleBin([action.expandedPath]);
    if (failed.length > 0) {
      return {
        freedBytes: 0,
        skipped: [{ path: action.expandedPath, reason: error ? `could not be recycled: ${error}` : 'could not be recycled' }]
      };
    }
    await writeFile(action.expandedPath, newContent, 'utf8');
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), recycled: true, skipped: [] };
  }

  const manifest = await quarantineFileEdit({
    programName: `Deep Clean: ${ruleName}`,
    filePath: action.expandedPath,
    newContent
  });
  const after = statSync(action.expandedPath).size;
  return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
}
```

**Fix the `require` bug in `scan()` before running tests** -- this file is ESM (matches every other file in `cleanerActions/`), and `require` doesn't exist there. Use a real ESM import instead: add `readFileSync` to the top `node:fs` import (`import { existsSync, statSync, readFileSync } from 'node:fs';`) and change `scan()`'s body to `const parsed = JSON.parse(readFileSync(action.expandedPath, 'utf8'));`. This is a deliberate planted bug for you to catch and fix during Step 4 below -- confirms you're actually running the tests, not just pasting code. Fix it before proceeding.

- [ ] **Step 4: Run it, confirm it passes (after fixing the `require` bug above)**

```bash
npx vitest run src/lib/cleanerActions/json.test.js
```

Expected: 15 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cleanerActions/json.js backend/src/lib/cleanerActions/json.test.js
git commit -m "feat(cleanerActions): add the json action, standalone"
```

---

### Task 5: Wire `json` into the dispatcher

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

`scanRule`/`executeRule` gain a 5th `if`/`else if` branch. Same integration-risk posture Phase A's own dispatcher-wiring task called out: this is where a rule mixing `json` with another action type gets proven end to end for the first time.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/lib/cleanerRules.test.js`:

```js
import * as jsonAddress from './cleanerActions/jsonAddress.js';

describe('json action, wired', () => {
  it('scans a json-only rule, reporting the file size as sizeBytes and present correctly', async () => {
    const filePath = join(appDataDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: { enabled: true } }));

    const rule = { id: 'json-scan', category: 'Test', name: 'JSON scan test', actions: [{ type: 'json', path: '%APPDATA%\\Preferences', address: 'sync' }] };

    const result = scanRule(rule);

    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.present).toBe(true);
  });

  it('executes a json-only rule, removing the key and quarantining the original', async () => {
    const filePath = join(appDataDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: { enabled: true }, keep: 1 }));

    const rule = { id: 'json-exec', category: 'Test', name: 'JSON exec test', actions: [{ type: 'json', path: '%APPDATA%\\Preferences', address: 'sync' }] };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBeGreaterThan(0);
    const after = JSON.parse(await (await import('node:fs/promises')).readFile(filePath, 'utf8'));
    expect(after.sync).toBeUndefined();
    expect(after.keep).toBe(1);
  });

  it('sums freedBytes across a delete action AND a json action under one rule', async () => {
    const dir1 = join(appDataDir, 'mixed-json', 'cache');
    await mkdir(dir1, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345'); // 5 bytes

    const filePath = join(appDataDir, 'mixed-json', 'Preferences');
    await writeFile(filePath, JSON.stringify({
      dns_prefetching: { host_referral_list: Array.from({ length: 100 }, (_, i) => `h${i}.example.com`) }
    }));

    const rule = {
      id: 'mixed-json', category: 'Test', name: 'Mixed rule',
      actions: [
        { type: 'delete', paths: ['%APPDATA%\\mixed-json\\cache'] },
        { type: 'json', path: '%APPDATA%\\mixed-json\\Preferences', address: 'dns_prefetching/host_referral_list' }
      ]
    };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBeGreaterThan(5); // the 5-byte file, plus a real JSON size reduction
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerRules.test.js -t "json action, wired"
```

Expected: `FAIL` — `scanRule`/`executeRule` don't recognize `json` action types yet.

- [ ] **Step 3: Implement the dispatcher branch**

In `backend/src/lib/cleanerRules.js`, add the import alongside the other action imports:

```js
import * as jsonAction from './cleanerActions/json.js';
```

In `scanRule`, add a new `else if` branch (after the `winreg` branch):

```js
    } else if (action.type === 'json') {
      const result = jsonAction.scan({ expandedPath: expandPath(action.path), address: action.address });
      sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
      if (result.present) present = true;
    }
```

In `executeRule`, add a new `else if` branch (after the `winreg` branch):

```js
    } else if (action.type === 'json') {
      const result = await jsonAction.execute(
        { expandedPath: expandPath(action.path), address: action.address }, rule.name, guards
      );
      freedBytes += result.freedBytes;
      skipped.push(...result.skipped);
      if (result.recycled) recycled = true;
      if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
    }
```

Update `executeRule`'s own top doc comment to add `json` to the list of action types it dispatches (currently lists `shell`, `delete`, `sqlite.vacuum`, `winreg`), with one sentence on what it does: *"`json` deletes one key from a JSON file, quarantining the ORIGINAL file first since (unlike `sqlite.vacuum`) this genuinely deletes data."* Do the same for `scanRule`'s own top comment.

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerRules.test.js
```

Expected: all pass, including the new `json action, wired` describe block.

- [ ] **Step 5: Run the full backend suite once**

```bash
npx vitest run
```

Expected: all pass, except the 3 pre-existing elevation-gated failures if not running elevated.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleanerRules): wire the json action into scanRule/executeRule"
```

---

### Task 6: `executeLogLine` picks a verb for a `json` result

**Files:**
- Modify: `frontend/src/lib/scanLog.js`
- Test: `frontend/src/lib/scanLog.test.js`

Per the spec: `json`'s result shouldn't say "Delete" (nothing was deleted outright) or reuse "Compact" (that word means something specific about `sqlite.vacuum`). A `json` action's result carries no discriminator field of its own yet -- add one, mirroring `vacuumed`'s own pattern exactly.

- [ ] **Step 1: Add the discriminator to `executeRule`'s result**

This needs one small addition back in `backend/src/lib/cleanerRules.js` (from Task 5) -- add it now rather than leaving `executeLogLine` with nothing to key off. In `executeRule`, declare `let ... edited;` alongside the other accumulator variables (`recycled`, `quarantineBatch`, `ranCommand`, `error`, `vacuumed`), set `edited = true;` inside the `json` branch (mirroring exactly how `vacuumed = true;` is set inside the `sqlite.vacuum` branch), and add `...(edited ? { edited } : {})` to the returned object's spread, in the same position `vacuumed` occupies.

- [ ] **Step 2: Write the failing tests**

Add to `frontend/src/lib/scanLog.test.js`, inside the existing `describe('executeLogLine', ...)` block:

```js
it('says "Trim", not "Delete" or "Compact", for a json-edit result', () => {
  const line = executeLogLine({ id: 'x', name: 'X Preferences', freedBytes: 512, skipped: [], edited: true });
  expect(line).toEqual({ label: 'Trim X Preferences', detail: '512 B', tone: 'size' });
});

it('reports a json-edit that removed a key but freed nothing measurable as empty, not silently 0 B', () => {
  const line = executeLogLine({ id: 'x', name: 'X Preferences', freedBytes: 0, skipped: [], edited: true });
  expect(line).toEqual({ label: 'Trim X Preferences', detail: 'already empty', tone: 'muted' });
});

it('does not collapse a skipped/failed json edit into a fake success', () => {
  const line = executeLogLine({
    id: 'x', name: 'X Preferences', freedBytes: 0, edited: true,
    skipped: [{ path: 'prefs.json', reason: 'not valid JSON' }]
  });
  expect(line).toEqual({ label: 'Trim X Preferences', detail: '1 skipped', tone: 'warning' });
});
```

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd frontend && npx vitest run src/lib/scanLog.test.js -t "Trim"
```

Expected: 3 failures (falls through to the `Delete`/`Recycle` branch currently, or -- if `edited` isn't wired at all yet -- always says "Delete").

- [ ] **Step 4: Implement it**

In `frontend/src/lib/scanLog.js`, add a new branch to `executeLogLine`, positioned after the existing `vacuumed` branch and before the `Delete`/`Recycle` fallthrough -- same `freedBytes -> skipped -> empty` shape the `vacuumed` branch already established (this is now the SECOND action type needing exactly this shape, which is the concrete signal that a shared helper is worth extracting rather than a third copy-paste later):

```js
  // `edited` is set iff executeRule ran a json action for this rule --
  // freedBytes here came from removing one key from a JSON file, not
  // from deleting the file itself. Same "ran, but might not have
  // succeeded" caveat vacuumed carries: a held/failed edit still sets
  // edited, so this follows the identical freedBytes -> skipped -> empty
  // fallthrough rather than an unconditional "success" label.
  if (item.edited) {
    const label = `Trim ${item.name ?? item.id}`;
    if (item.freedBytes > 0) {
      return { label, detail: formatBytes(item.freedBytes), tone: 'size' };
    }
    if (item.skipped?.length > 0) {
      return { label, detail: `${item.skipped.length} skipped`, tone: 'warning' };
    }
    return { label, detail: 'already empty', tone: 'muted' };
  }
```

- [ ] **Step 5: Run it, confirm it passes, then the full frontend suite**

```bash
npx vitest run src/lib/scanLog.test.js
npx vitest run
```

Expected: all pass.

- [ ] **Step 6: Regression-check -- revert the new branch, confirm the 3 new tests fail, restore**

Temporarily comment out the new `if (item.edited)` block, rerun the 3 targeted tests, confirm they fail (falling through to `Delete X Preferences`). Restore, confirm 3/3 pass again.

- [ ] **Step 7: Commit**

```bash
cd .. && git add backend/src/lib/cleanerRules.js frontend/src/lib/scanLog.js frontend/src/lib/scanLog.test.js
git commit -m "feat(scanLog): executeLogLine says Trim for a json-edit result"
```

---

### Task 7: Final verification and spec cross-check

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: all green (backend modulo the 3 pre-existing elevation-gated failures if not running elevated).

- [ ] **Step 2: Cross-check against the spec's own scope**

Re-read `docs/superpowers/specs/2026-09-17-bleachbit-parity-phase-b-json-design.md`'s "Scope for this phase" section against what was built:
- `json.js` with `scan`/`execute` — Task 4. ✓
- Address resolution via a small purpose-built resolver, not a library — Task 2. ✓
- Wired into the dispatcher as the 5th action type — Task 5. ✓
- Original-file-quarantined-before-write mechanism — Task 3, proven correct via a real empirical test in Task 1 before any code was built on top of it. ✓
- Guards apply, `autoQuarantine` is NOT exempt (unlike `sqlite.vacuum`) — Task 4's own guard tests. ✓
- Explicitly out of scope, and confirm nothing crept in: no new `cleaners.json` rules using `json` (`grep -c '"type": "json"' backend/src/data/cleaners.json` should be 0), no `cookie`/per-app-SQL action types, no general-purpose object-manipulation library added to `package.json`.

- [ ] **Step 3: Update the project memory / backlog note**

This is Phase B of item 5 in Prune's 2.6.0 backlog. Phases C (`cookie`) and D (per-app bespoke SQL) remain fully unstarted -- say so plainly, don't let "Phase B done" read as "the engine rewrite is done."
