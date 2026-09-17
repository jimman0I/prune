import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import * as fsPromises from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quarantineAndDelete, restoreQuarantine, deletePermanently, emptyQuarantine } from './quarantine.js';
import { readPendingOperations, PENDING_KEY, PENDING_VALUE } from './pendingReboot.js';
import * as pendingReboot from './pendingReboot.js';

const execFileAsync = promisify(execFile);

/** Rewrites PENDING_VALUE to exactly `strings`, via the same `hex(7)` /
 * `.reg`-file round trip pendingReboot.js itself uses internally, and the
 * same technique pendingReboot.test.js's own writeAllPendingOperations
 * uses for its cleanup -- duplicated here rather than imported (neither
 * pendingReboot.js nor its test file exports it) for the same reason
 * pendingReboot.test.js gives: this is this test's OWN verification/
 * cleanup path, kept independent of the module under test.
 *
 * `reg add ... /t REG_MULTI_SZ /d "..."` cannot be used for this -- it
 * silently drops a trailing empty-string element, which is exactly what a
 * delete pair's second half is (see pendingReboot.js's writeMultiSzValue
 * comment). This dev machine's PENDING_VALUE genuinely holds real pending
 * deletes from Windows Update / Brave, so every call site here rebuilds
 * `strings` from a `readPendingOperations()` taken moments earlier and
 * only removes the one pair this test itself added -- never a blanket
 * overwrite. */
async function writeAllPendingOperations(strings) {
  const encodeMultiSz = (list) => {
    const parts = list.map((s) => Buffer.concat([Buffer.from(s, 'utf16le'), Buffer.from([0, 0])]));
    return Buffer.concat([...parts, Buffer.from([0, 0])]);
  };
  const bytes = encodeMultiSz(strings);
  const hexList = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(',');
  const fullKeyPath = PENDING_KEY.replace(/^HKLM\\?/i, 'HKEY_LOCAL_MACHINE\\');
  const regFileText = `Windows Registry Editor Version 5.00\r\n\r\n[${fullKeyPath}]\r\n"${PENDING_VALUE}"=hex(7):${hexList}\r\n\r\n`;
  const regFileBytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(regFileText, 'utf16le')]);
  const importFile = join(tmpdir(), `prune-quarantine-test-pfro-cleanup-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.reg`);
  await writeFile(importFile, regFileBytes);
  try {
    await execFileAsync('reg', ['import', importFile]);
  } finally {
    await rm(importFile, { force: true }).catch(() => {});
  }
}

/** Removes exactly the one pending-reboot pair this test added (matched by
 * its `\??\<path>` marker), never a blanket overwrite -- same
 * read-modify-only-your-own-entry-write-back contract pendingReboot.test.js's
 * own afterEach uses. */
async function removePendingDeleteFor(filePath) {
  const marker = `\\??\\${filePath}`;
  const current = await readPendingOperations();
  const cleaned = [];
  for (let i = 0; i < current.length; i += 2) {
    if (current[i] === marker) continue;
    cleaned.push(current[i], current[i + 1]);
  }
  if (cleaned.length === current.length) return; // nothing of ours was there
  if (cleaned.length === 0) {
    await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
  } else {
    await writeAllPendingOperations(cleaned);
  }
}

// Same vi.mock partial-passthrough technique cleanerRules.test.js already
// establishes for fs.promises.open (there, mocking 'node:fs' since that
// file imports the fs default export) -- applied here to node:fs/promises'
// named `rename` export instead, since that's how quarantine.js imports it.
// vi.spyOn cannot do this directly: ESM module namespaces are not
// configurable, so "Cannot redefine property: rename" the moment a real
// rename() would otherwise fire (confirmed live). vi.mock's factory swaps
// in a vi.fn() wrapper at module-load time instead, which IS allowed, and
// __actualRename keeps the real implementation reachable so the mock can
// pass every other call straight through unmodified.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rename: vi.fn(actual.rename), __actualRename: actual.rename };
});

/* A key name unique to this process, not a fixed one.
 *
 * These tests create and delete a REAL registry key -- the point of them
 * is that quarantine.js exports and removes something Windows actually
 * holds, which a mock cannot prove. A fixed name means two concurrent
 * runs of this suite on one machine tear down each other's fixture, and
 * the failures land in the assertions rather than in the setup: the key
 * is still there after the call, or the manifest comes back empty.
 *
 * Found exactly that way -- twelve failures from a second vitest process
 * sweeping this file at the same time, and all sixteen green when run
 * alone. Two terminals, or an editor's watcher beside a manual run, is
 * enough to hit it.
 *
 * This removes the deterministic half of that and not all of it. Measured
 * after the change, over three concurrent pairs: two pairs fully green,
 * one pair with a single failure, and the failing test MOVED between runs
 * -- which is reg.exe contention rather than shared state, since the keys
 * no longer overlap. Whatever these tests do, they drive one machine-wide
 * tool, and two suites racing it will occasionally lose. Run one suite at
 * a time; CONTRIBUTING.md says so.
 *
 * The name also no longer says "unrevo", which is what the app was called
 * before the rebrand. */
const TEST_KEY_NAME = `prune-test-${process.pid}`;
const TEST_KEY = `HKCU\\Software\\${TEST_KEY_NAME}`;
/* The same key as PowerShell spells it, which is the form quarantine.js
 * takes. Derived from one name rather than written out twice, so the two
 * spellings cannot drift apart. */
const PS_KEY = `HKCU:\\Software\\${TEST_KEY_NAME}`;
const PS_MISSING_KEY = `HKCU:\\Software\\${TEST_KEY_NAME}-does-not-exist`;

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), `prune-quarantine-test-${process.pid}-`));
  process.env.UNREVO_QUARANTINE_ROOT = scratchDir;
  await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Marker', '/d', 'test-value', '/f']);
});

afterEach(async () => {
  fsPromises.rename.mockImplementation(fsPromises.__actualRename);
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(scratchDir, { recursive: true, force: true });
  try { await execFileAsync('reg', ['delete', TEST_KEY, '/f']); } catch { /* already gone */ }
});

describe('quarantineAndDelete', () => {
  it('moves listed files into a quarantine batch folder', async () => {
    const filePath = join(scratchDir, 'leftover.txt');
    await writeFile(filePath, 'leftover content', 'utf8');

    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });

    expect(existsSync(filePath)).toBe(false); // moved, not just copied
    expect(manifest.files).toHaveLength(1);
    expect(existsSync(manifest.files[0].quarantinedPath)).toBe(true);
    const content = await readFile(manifest.files[0].quarantinedPath, 'utf8');
    expect(content).toBe('leftover content');
  });

  it('exports and deletes a real registry key, writing a restorable .reg file', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: [PS_KEY] });

    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();
    expect(manifest.registryKeys).toEqual([PS_KEY]);
    expect(manifest.regFiles).toHaveLength(1);
    // reg.exe writes .reg files as UTF-16LE, not UTF-8 — reading it as utf8
    // would produce mojibake and this assertion would silently never match.
    const regContent = await readFile(manifest.regFiles[0], 'utf16le');
    expect(regContent).toMatch(new RegExp(TEST_KEY_NAME, 'i'));
    expect(manifest.failedRegistryKeys).toEqual([]);
  });

  // A key whose `reg export`/`reg delete` fails is skipped so one bad key
  // can't abort the batch -- but silently, which meant callers could only
  // tell by diffing their own request against the manifest, and none did.
  // A forced uninstall reporting a clean removal while the Add/Remove
  // Programs entry is still sitting there is the same class of lie as
  // reporting 0 bytes for a directory we couldn't read.
  it('records a registry key it could not remove instead of dropping it silently', async () => {
    const manifest = await quarantineAndDelete({
      programName: 'OldApp',
      files: [],
      registryKeys: [PS_KEY, PS_MISSING_KEY]
    });

    expect(manifest.registryKeys).toEqual([PS_KEY]);
    expect(manifest.failedRegistryKeys).toEqual([PS_MISSING_KEY]);
  });

  // Startup entries are VALUES inside HKCU\...\Run, a key that every
  // program starting with Windows shares. Removing one by deleting its key
  // would take every other program's startup entry with it, so a leftover
  // can name a single value and only that value comes out.
  it('deletes a single registry value and leaves its neighbours alone', async () => {
    await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Keep', '/d', 'keep-me', '/f']);

    const manifest = await quarantineAndDelete({
      programName: 'OldApp',
      files: [],
      registryKeys: [{ path: PS_KEY, valueName: 'Marker' }]
    });

    const { stdout } = await execFileAsync('reg', ['query', TEST_KEY]);
    expect(stdout).not.toMatch(/Marker/);
    expect(stdout).toMatch(/Keep/);
    expect(manifest.registryKeys).toEqual([{ path: PS_KEY, valueName: 'Marker' }]);
    expect(manifest.failedRegistryKeys).toEqual([]);
  });

  it('backs up the whole key a deleted value lived in, so the value can come back', async () => {
    const manifest = await quarantineAndDelete({
      programName: 'OldApp',
      files: [],
      registryKeys: [{ path: PS_KEY, valueName: 'Marker' }]
    });

    // reg.exe writes .reg files as UTF-16LE; reading it as utf8 would
    // produce mojibake and this assertion would silently never match.
    const regContent = await readFile(manifest.regFiles[0], 'utf16le');
    expect(regContent).toMatch(/Marker/);
    expect(regContent).toMatch(/test-value/);
  });

  it('reports a value it could not remove, naming the value and not just the key', async () => {
    const manifest = await quarantineAndDelete({
      programName: 'OldApp',
      files: [],
      registryKeys: [{ path: PS_KEY, valueName: 'NoSuchValue' }]
    });

    expect(manifest.registryKeys).toEqual([]);
    expect(manifest.failedRegistryKeys).toEqual([
      { path: PS_KEY, valueName: 'NoSuchValue' }
    ]);
    // The key itself must still be there: a failed value delete is not
    // permission to fall back to deleting the whole key.
    await expect(execFileAsync('reg', ['query', TEST_KEY])).resolves.toBeTruthy();
  });

  // The scanner already refuses to offer these, so reaching here means a
  // caller built the list some other way -- a stale scan result, a bug, a
  // hand-made request to the route. The remover is the last thing standing
  // between that and a machine that no longer boots, so it checks too.
  it('refuses to delete a key that belongs to Windows rather than to a program', async () => {
    const manifest = await quarantineAndDelete({
      programName: 'OldApp',
      files: [],
      registryKeys: ['HKLM:\\Software\\Microsoft', PS_KEY]
    });

    expect(manifest.registryKeys).toEqual([PS_KEY]);
    expect(manifest.failedRegistryKeys).toEqual(['HKLM:\\Software\\Microsoft']);
    // Nothing was even exported for it -- the refusal comes before reg.exe.
    expect(manifest.regFiles).toHaveLength(1);
  });

  it('skips a file that no longer exists rather than throwing', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [join(scratchDir, 'nope.txt')], registryKeys: [] });
    expect(manifest.files).toEqual([]);
  });

  it('records each moved file\'s real byte size and a correct totalSizeBytes', async () => {
    const a = join(scratchDir, 'a.txt');
    const b = join(scratchDir, 'b.txt');
    await writeFile(a, '12345'); // 5 bytes
    await writeFile(b, '1234567890'); // 10 bytes

    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [a, b], registryKeys: [] });

    const sizeFor = (originalPath) => manifest.files.find(f => f.originalPath === originalPath).sizeBytes;
    expect(sizeFor(a)).toBe(5);
    expect(sizeFor(b)).toBe(10);
    expect(manifest.totalSizeBytes).toBe(15);
  });

  it('does not abort the whole batch when one file is locked -- reports it and keeps going', async () => {
    const lockedPath = join(scratchDir, 'locked.txt');
    const laterPath = join(scratchDir, 'later.txt');
    await writeFile(lockedPath, 'locked content');
    await writeFile(laterPath, 'later content');

    // Simulate a real Windows sharing violation without holding a genuine
    // OS-level lock -- via the module-level vi.mock('node:fs/promises')
    // above (vi.spyOn can't redefine an ESM named export directly: "Cannot
    // redefine property: rename", confirmed live).
    const realRename = fsPromises.__actualRename;
    fsPromises.rename.mockImplementation((src, dest) => {
      if (src === lockedPath) return Promise.reject(Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' }));
      return realRename(src, dest);
    });

    const manifest = await quarantineAndDelete({ programName: 'Test', files: [lockedPath, laterPath], registryKeys: [] });

    expect(manifest.files.some((f) => f.originalPath === laterPath)).toBe(true);
    expect(manifest.failedFiles).toHaveLength(1);
    expect(manifest.failedFiles[0].path).toBe(lockedPath);
    expect(manifest.failedFiles[0].reason).toMatch(/EBUSY|locked/i);
  });

  // Known environmental limitation, same as pendingReboot.test.js's own
  // schedulePendingDelete tests: writing HKLM\SYSTEM requires an elevated
  // shell. If this test process is not elevated, schedulePendingDelete's
  // own `reg import` fails with an access-denied error, which surfaces
  // here as a rejected quarantineAndDelete call (or, depending on how the
  // implementation handles that failure, as a failedFiles entry rather
  // than scheduledForReboot) -- NOT as evidence quarantine.js's wiring is
  // wrong. Run from an elevated shell to actually exercise the write path.
  it('schedules a locked file for delete-on-restart when the setting is on', async () => {
    const lockedPath = join(scratchDir, 'locked.txt');
    await writeFile(lockedPath, 'locked content');

    fsPromises.rename.mockImplementation(async () => {
      throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    });

    try {
      const manifest = await quarantineAndDelete({
        programName: 'Test', files: [lockedPath], registryKeys: [], deleteLockedFilesOnRestart: true
      });

      expect(manifest.failedFiles).toEqual([]); // scheduled, not failed
      expect(manifest.scheduledForReboot).toEqual([lockedPath]);
    } finally {
      // Clean up the real registry write this test caused, whether it
      // succeeded or not -- safe no-op if nothing was actually written
      // (e.g. the elevation-gated failure case).
      await removePendingDeleteFor(lockedPath);
    }
  });

  // Deliberately independent of elevation: with the flag off, this must
  // prove schedulePendingDelete is never even ATTEMPTED, not just that the
  // manifest ends up looking a certain way. Without this, in a typical
  // non-elevated dev/CI shell, flipping the default to `true` would produce
  // the exact same observable manifest shape (schedulePendingDelete throws
  // access-denied, which the flag-on catch branch also routes into
  // failedFiles) -- so asserting on failedFiles/scheduledForReboot alone
  // gives zero regression protection for the default outside an elevated
  // runner. Mocking schedulePendingDelete directly closes that gap and
  // needs no registry cleanup, since nothing real is ever touched.
  it('does NOT schedule a locked file for reboot when the setting is off (default)', async () => {
    const lockedPath = join(scratchDir, 'locked.txt');
    await writeFile(lockedPath, 'locked content');

    fsPromises.rename.mockImplementation(async () => {
      throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    });
    const schedulePendingDeleteSpy = vi.spyOn(pendingReboot, 'schedulePendingDelete');

    const manifest = await quarantineAndDelete({ programName: 'Test', files: [lockedPath], registryKeys: [] });

    expect(schedulePendingDeleteSpy).not.toHaveBeenCalled();
    expect(manifest.failedFiles).toHaveLength(1);
    expect(manifest.scheduledForReboot).toEqual([]);

    schedulePendingDeleteSpy.mockRestore();
  });
});

describe('restoreQuarantine', () => {
  it('moves a quarantined file back to its original path', async () => {
    const filePath = join(scratchDir, 'restore-me.txt');
    await writeFile(filePath, 'restore content', 'utf8');
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });

    await restoreQuarantine(manifest.batchDir);

    expect(existsSync(filePath)).toBe(true);
    expect(await readFile(filePath, 'utf8')).toBe('restore content');
  });

  it('removes the now-empty batch directory so a restored batch stops appearing as quarantined', async () => {
    const filePath = join(scratchDir, 'gone-after-restore.txt');
    await writeFile(filePath, 'x', 'utf8');
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });
    expect(existsSync(manifest.batchDir)).toBe(true); // sanity: it's really there first

    await restoreQuarantine(manifest.batchDir);

    expect(existsSync(manifest.batchDir)).toBe(false);
  });

  it('re-imports a quarantined registry key', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: [PS_KEY] });
    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();

    await restoreQuarantine(manifest.batchDir);

    const { stdout } = await execFileAsync('reg', ['query', TEST_KEY, '/v', 'Marker']);
    expect(stdout).toMatch(/test-value/);
  });
});

describe('deletePermanently', () => {
  it('really, permanently removes the whole batch directory from disk', async () => {
    const filePath = join(scratchDir, 'gone-forever.txt');
    await writeFile(filePath, '12345'); // 5 bytes
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });
    expect(existsSync(manifest.batchDir)).toBe(true); // sanity: it's really there first

    const result = await deletePermanently(manifest.batchDir);

    expect(result).toEqual({ deleted: true, freedBytes: 5 });
    expect(existsSync(manifest.batchDir)).toBe(false); // the batch dir itself is gone, not just emptied
  });

  it('handles an already-missing batch directory without throwing', async () => {
    const result = await deletePermanently(join(scratchDir, 'never-existed'));
    expect(result.deleted).toBe(false);
  });
});

describe('emptyQuarantine', () => {
  it('permanently removes every batch under quarantineRoot() and sums their sizes', async () => {
    const a = join(scratchDir, 'a.txt');
    const b = join(scratchDir, 'b.txt');
    await writeFile(a, '12345'); // 5 bytes
    await writeFile(b, '1234567890'); // 10 bytes
    const batch1 = await quarantineAndDelete({ programName: 'App1', files: [a], registryKeys: [] });
    const batch2 = await quarantineAndDelete({ programName: 'App2', files: [b], registryKeys: [] });

    const result = await emptyQuarantine();

    expect(result).toEqual({ deletedCount: 2, freedBytes: 15 });
    expect(existsSync(batch1.batchDir)).toBe(false);
    expect(existsSync(batch2.batchDir)).toBe(false);
  });

  it('returns zeros rather than throwing when quarantine is already empty', async () => {
    const result = await emptyQuarantine();
    expect(result).toEqual({ deletedCount: 0, freedBytes: 0 });
  });
});