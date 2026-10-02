import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** "Delete locked files at next restart", for Deep Clean.
 *
 * A file another program has open used to be skipped. With the setting on it
 * is handed to Windows to delete at the next boot (services/pendingReboot.js,
 * which writes HKLM and needs administrator). The registry write is mocked
 * here -- this suite must never schedule a real deletion -- and "locked" is
 * simulated by making open() fail the way Windows does, since a temp file
 * cannot be locked from inside the test process. */

const schedulePendingDelete = vi.fn(async () => {});
vi.mock('../../services/pendingReboot.js', () => ({
  schedulePendingDelete: (...a) => schedulePendingDelete(...a)
}));

const { execute } = await import('./delete.js');

let dir;
let lockedNames;
let lockCode;
let realOpen;

beforeEach(async () => {
  vi.clearAllMocks();
  dir = await mkdtemp(join(tmpdir(), 'prune-locked-'));
  lockedNames = new Set();
  lockCode = 'EBUSY';
  realOpen = fs.promises.open.bind(fs.promises);
  vi.spyOn(fs.promises, 'open').mockImplementation(async (path, ...rest) => {
    if (lockedNames.has(String(path).split(/[\\/]/).pop())) {
      throw Object.assign(new Error(`${lockCode}: resource busy or locked`), { code: lockCode });
    }
    return realOpen(path, ...rest);
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const run = (guards) => execute({ expandedPaths: [dir] }, 'Temp', { removal: 'delete', ...guards });

async function files(...names) {
  for (const name of names) await writeFile(join(dir, name), name);
}

describe('with the setting off (the default)', () => {
  it('skips a locked file, as it always did, and schedules nothing', async () => {
    await files('free.tmp', 'busy.tmp');
    lockedNames.add('busy.tmp');
    const result = await run({});
    expect(schedulePendingDelete).not.toHaveBeenCalled();
    expect(result.scheduledForRestart ?? []).toEqual([]);
    expect(result.skipped).toEqual([{ path: join(dir, 'busy.tmp'), reason: 'locked or inaccessible' }]);
    expect(existsSync(join(dir, 'free.tmp'))).toBe(false);
  });
});

describe('with the setting on', () => {
  it('schedules a locked file for deletion at restart instead of skipping it', async () => {
    await files('free.tmp', 'busy.tmp');
    lockedNames.add('busy.tmp');
    const result = await run({ deleteLockedOnRestart: true });

    expect(schedulePendingDelete).toHaveBeenCalledTimes(1);
    expect(schedulePendingDelete).toHaveBeenCalledWith(join(dir, 'busy.tmp'));
    expect(result.scheduledForRestart).toEqual([join(dir, 'busy.tmp')]);
    expect(result.skipped).toEqual([]);
    // Only the file that really went counts as freed; the scheduled one is
    // still on the disk until Windows restarts.
    expect(result.freedBytes).toBe('free.tmp'.length);
    expect(existsSync(join(dir, 'busy.tmp'))).toBe(true);
  });

  it.each(['EBUSY', 'EPERM'])('treats %s as locked', async (code) => {
    lockCode = code;
    await files('busy.tmp');
    lockedNames.add('busy.tmp');
    const result = await run({ deleteLockedOnRestart: true });
    expect(result.scheduledForRestart).toHaveLength(1);
  });

  it('does not schedule a file that is merely unreadable for another reason', async () => {
    lockCode = 'EIO';
    await files('odd.tmp');
    lockedNames.add('odd.tmp');
    const result = await run({ deleteLockedOnRestart: true });
    expect(schedulePendingDelete).not.toHaveBeenCalled();
    expect(result.skipped).toHaveLength(1);
  });

  it('never schedules a file a guard holds back -- an excluded folder or a recent file', async () => {
    await mkdir(join(dir, 'keep'));
    await writeFile(join(dir, 'keep', 'busy.tmp'), 'x');
    await writeFile(join(dir, 'recent.tmp'), 'y');
    lockedNames.add('busy.tmp');
    lockedNames.add('recent.tmp');
    const result = await run({ deleteLockedOnRestart: true, excludeFolders: [join(dir, 'keep')], skipRecentHours: 24 });
    expect(schedulePendingDelete).not.toHaveBeenCalled();
    expect(result.scheduledForRestart ?? []).toEqual([]);
    expect(result.skipped).toHaveLength(2);
  });

  it('reports honestly when scheduling needs administrator, and stops trying', async () => {
    schedulePendingDelete.mockRejectedValue(new Error('Command failed: reg import ... Access is denied.'));
    await files('a.tmp', 'b.tmp', 'free.tmp');
    lockedNames.add('a.tmp');
    lockedNames.add('b.tmp');
    const result = await run({ deleteLockedOnRestart: true });

    expect(schedulePendingDelete).toHaveBeenCalledTimes(1); // the second would fail the same way
    expect(result.scheduledForRestart ?? []).toEqual([]);
    expect(result.skipped).toHaveLength(2);
    for (const entry of result.skipped) {
      expect(entry.reason).toMatch(/locked/);
      expect(entry.reason).toMatch(/restart/);
      expect(entry.reason).toMatch(/administrator/);
    }
    expect(result.freedBytes).toBe('free.tmp'.length);
  });

  it('stays quiet about files that are not locked', async () => {
    await files('a.tmp');
    const result = await run({ deleteLockedOnRestart: true });
    expect(schedulePendingDelete).not.toHaveBeenCalled();
    expect(result.scheduledForRestart ?? []).toEqual([]);
  });
});
