import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** "Overwrite files before deleting", at the one place Prune deletes for good.
 * Real files in a temp folder; shredPaths is wrapped, not replaced, so the
 * overwrite really happens and the test can see that it was asked for. */

const shredPaths = vi.fn();
vi.mock('../lib/shredFile.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shredPaths: (...a) => { shredPaths(...a); return actual.shredPaths(...a); } };
});
vi.mock('./quarantine.js', async (importOriginal) => ({
  quarantineRoot: (await importOriginal()).quarantineRoot,
  quarantineAndDelete: vi.fn(async () => ({ batchDir: 'Q:\\b', files: [], registryKeys: [], failedRegistryKeys: [], totalSizeBytes: 0 }))
}));
vi.mock('./recycleBin.js', () => ({ sendToRecycleBin: vi.fn() }));

const { removePermanently, removeLeftovers } = await import('./leftoverRemoval.js');

let dir;
beforeEach(() => { vi.clearAllMocks(); dir = mkdtempSync(join(tmpdir(), 'prune-removeperm-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('removePermanently', () => {
  it('is a plain delete by default -- nothing is overwritten', async () => {
    const file = join(dir, 'a.txt');
    writeFileSync(file, 'abc');
    const result = await removePermanently([{ path: file, sizeBytes: 3 }]);
    expect(result.removed).toEqual([{ originalPath: file, sizeBytes: 3 }]);
    expect(existsSync(file)).toBe(false);
    expect(shredPaths).not.toHaveBeenCalled();
  });

  it('overwrites first when told to, and still reports the file as removed', async () => {
    const file = join(dir, 'a.txt');
    writeFileSync(file, 'abc');
    const result = await removePermanently([{ path: file, sizeBytes: 3 }], { overwritePasses: 1 });
    expect(shredPaths).toHaveBeenCalledWith([file], 1);
    expect(result.removed).toEqual([{ originalPath: file, sizeBytes: 3 }]);
    expect(result.failed).toEqual([]);
    expect(existsSync(file)).toBe(false);
  });

  it('passes three passes through', async () => {
    const file = join(dir, 'a.txt');
    writeFileSync(file, 'abc');
    await removePermanently([{ path: file, sizeBytes: 3 }], { overwritePasses: 3 });
    expect(shredPaths).toHaveBeenCalledWith([file], 3);
  });

  it('shreds a whole folder, file by file', async () => {
    const folder = join(dir, 'Vendor');
    mkdirSync(join(folder, 'cache'), { recursive: true });
    writeFileSync(join(folder, 'one'), '1');
    writeFileSync(join(folder, 'cache', 'two'), '22');
    const result = await removePermanently([{ path: folder, sizeBytes: 3 }], { overwritePasses: 1 });
    expect(existsSync(folder)).toBe(false);
    expect(result.removed).toEqual([{ originalPath: folder, sizeBytes: 3 }]);
  });

  it('reports a path it cannot shred, without stopping the batch', async () => {
    const good = join(dir, 'good.txt');
    writeFileSync(good, 'good');
    const result = await removePermanently(
      [{ path: join(dir, 'missing.txt'), sizeBytes: 1 }, { path: good, sizeBytes: 4 }],
      { overwritePasses: 1 }
    );
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].path).toBe(join(dir, 'missing.txt'));
    expect(result.removed).toEqual([{ originalPath: good, sizeBytes: 4 }]);
    expect(existsSync(good)).toBe(false);
  });
});

describe('removeLeftovers, permanent destination', () => {
  it('overwrites when overwritePasses is given', async () => {
    const folder = join(dir, 'Vendor');
    mkdirSync(folder);
    writeFileSync(join(folder, 'x'), 'secret');
    const result = await removeLeftovers({
      programName: 'Thing', files: [folder], registryKeys: [], destination: 'permanent', overwritePasses: 3
    });
    expect(shredPaths).toHaveBeenCalledWith([folder], 3);
    expect(existsSync(folder)).toBe(false);
    expect(result.files).toHaveLength(1);
  });

  it('does not overwrite without it', async () => {
    const folder = join(dir, 'Vendor');
    mkdirSync(folder);
    await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'permanent' });
    expect(shredPaths).not.toHaveBeenCalled();
  });

  it('never overwrites for the Recycle Bin -- those files are kept', async () => {
    const folder = join(dir, 'Vendor');
    mkdirSync(folder);
    const { sendToRecycleBin } = await import('./recycleBin.js');
    sendToRecycleBin.mockResolvedValue({ recycled: [folder], failed: [] });
    await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'recycle', overwritePasses: 3 });
    expect(shredPaths).not.toHaveBeenCalled();
  });
});
