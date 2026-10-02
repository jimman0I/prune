import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Delete now + "Overwrite files before deleting". Real files in a temp
 * folder; shredPaths is wrapped so the overwrite really happens. */

const shredPaths = vi.fn();
vi.mock('../shredFile.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shredPaths: (...a) => { shredPaths(...a); return actual.shredPaths(...a); } };
});

const { execute } = await import('./delete.js');

let dir;
beforeEach(async () => { vi.clearAllMocks(); dir = await mkdtemp(join(tmpdir(), 'prune-delete-overwrite-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('Delete now with overwrite', () => {
  it('overwrites each file before removing it', async () => {
    const a = join(dir, 'a.tmp');
    const b = join(dir, 'b.tmp');
    await writeFile(a, 'aaaa');
    await writeFile(b, 'bb');

    const result = await execute({ expandedPaths: [dir] }, 'Temp', { removal: 'delete', overwritePasses: 3 });

    expect(shredPaths).toHaveBeenCalledTimes(2);
    expect(shredPaths.mock.calls.every((c) => c[1] === 3)).toBe(true);
    expect(existsSync(a) || existsSync(b)).toBe(false);
    expect(result.freedBytes).toBe(6);
    expect(result.skipped).toEqual([]);
  });

  it('is a plain delete when the setting is off', async () => {
    await writeFile(join(dir, 'a.tmp'), 'aaaa');
    const result = await execute({ expandedPaths: [dir] }, 'Temp', { removal: 'delete', overwritePasses: 0 });
    expect(shredPaths).not.toHaveBeenCalled();
    expect(result.freedBytes).toBe(4);
  });

  it('never overwrites a file the exclusions hold back, nor one touched recently', async () => {
    const keep = join(dir, 'keep', 'important.dat');
    const fresh = join(dir, 'fresh.tmp');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(dir, 'keep'));
    await writeFile(keep, 'precious');
    await writeFile(fresh, 'brand new');

    const result = await execute(
      { expandedPaths: [dir] },
      'Temp',
      { removal: 'delete', overwritePasses: 1, excludeFolders: [join(dir, 'keep')], skipRecentHours: 24 }
    );

    expect(shredPaths).not.toHaveBeenCalled();
    expect(existsSync(keep)).toBe(true);
    expect(existsSync(fresh)).toBe(true);
    expect(result.freedBytes).toBe(0);
    expect(result.skipped.map((s) => s.path).sort()).toEqual([fresh, keep].sort());
  });
});
