import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Where an uninstall's leftover FILES go: Quarantine, the Recycle Bin, or
 * nowhere at all.
 *
 * Revo offers the same three. The third is the only removal in Prune that
 * cannot be undone from inside Prune or from Windows, so most of this file
 * is about what it refuses to touch. Registry keys are not part of the
 * choice: whichever destination is picked, a key is exported to a .reg
 * file before it is deleted, because a registry key has no Recycle Bin.
 *
 * Quarantine and the Recycle Bin are mocked. Permanent deletion is real,
 * inside a temp directory this file creates and removes.
 */

const quarantineAndDelete = vi.fn(async ({ programName, files, registryKeys }) => ({
  programName, batchDir: 'Q:\\batch', files: files.map((p) => ({ originalPath: p, sizeBytes: 1 })),
  registryKeys, failedRegistryKeys: [], totalSizeBytes: files.length
}));
vi.mock('./quarantine.js', async (importOriginal) => ({
  quarantineRoot: (await importOriginal()).quarantineRoot,
  quarantineAndDelete: (...a) => quarantineAndDelete(...a)
}));

const sendToRecycleBin = vi.fn();
vi.mock('./recycleBin.js', () => ({ sendToRecycleBin: (...a) => sendToRecycleBin(...a) }));

const { removeLeftovers, permanentDeletionRefusal } = await import('./leftoverRemoval.js');

let dir;
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-leftovers-'));
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** A leftover folder with two files in it, 3 + 5 bytes. */
function makeLeftoverFolder(name = 'Vendor') {
  const folder = join(dir, name);
  mkdirSync(join(folder, 'cache'), { recursive: true });
  writeFileSync(join(folder, 'settings.ini'), 'abc');
  writeFileSync(join(folder, 'cache', 'blob.bin'), '12345');
  return folder;
}

describe('to Quarantine', () => {
  it('is exactly the quarantine call it always was', async () => {
    const result = await removeLeftovers({
      programName: 'Thing', files: ['C:\\a'], registryKeys: ['HKCU\\Software\\Thing'], destination: 'quarantine'
    });
    expect(quarantineAndDelete).toHaveBeenCalledWith({
      programName: 'Thing', files: ['C:\\a'], registryKeys: ['HKCU\\Software\\Thing']
    });
    expect(result.destination).toBe('quarantine');
    expect(result.batchDir).toBe('Q:\\batch');
    expect(sendToRecycleBin).not.toHaveBeenCalled();
  });
});

describe('to the Recycle Bin', () => {
  it('recycles the files and counts only what actually went', async () => {
    const folder = makeLeftoverFolder();
    const locked = join(dir, 'locked.dat');
    writeFileSync(locked, '1234567');
    sendToRecycleBin.mockResolvedValue({ recycled: [folder], failed: [locked] });

    const result = await removeLeftovers({ programName: 'Thing', files: [folder, locked], registryKeys: [], destination: 'recycle' });

    expect(sendToRecycleBin).toHaveBeenCalledWith([folder, locked]);
    expect(result.destination).toBe('recycle');
    expect(result.files.map((f) => f.originalPath)).toEqual([folder]);
    // The folder's contents, measured before it went: 3 + 5 bytes.
    expect(result.totalSizeBytes).toBe(8);
    expect(result.failedFiles).toEqual([{ path: locked, reason: expect.any(String) }]);
  });

  it('reports a path the Recycle Bin neither took nor refused, instead of dropping it', async () => {
    /* Found in a live check against the real Recycle Bin: the recycler
     * only handled files, so a leftover FOLDER came back in neither list
     * and simply vanished from the report while staying on the disk. The
     * recycler is fixed; this makes sure a path it says nothing about is
     * never counted as gone. */
    const folder = makeLeftoverFolder();
    sendToRecycleBin.mockResolvedValue({ recycled: [], failed: [] });
    const result = await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'recycle' });

    expect(result.files).toEqual([]);
    expect(result.totalSizeBytes).toBe(0);
    expect(result.failedFiles).toEqual([{ path: folder, reason: expect.stringMatching(/not moved to the Recycle Bin/) }]);
  });

  it('skips files that are already gone rather than failing on them', async () => {
    sendToRecycleBin.mockResolvedValue({ recycled: [], failed: [] });
    const result = await removeLeftovers({ programName: 'Thing', files: [join(dir, 'nope')], registryKeys: [], destination: 'recycle' });
    expect(sendToRecycleBin).not.toHaveBeenCalled();
    expect(result.files).toEqual([]);
  });

  it('still exports each registry key before deleting it', async () => {
    sendToRecycleBin.mockResolvedValue({ recycled: [], failed: [] });
    const result = await removeLeftovers({
      programName: 'Thing', files: [], registryKeys: ['HKCU\\Software\\Thing'], destination: 'recycle'
    });
    expect(quarantineAndDelete).toHaveBeenCalledWith({ programName: 'Thing', files: [], registryKeys: ['HKCU\\Software\\Thing'] });
    expect(result.registryKeys).toEqual(['HKCU\\Software\\Thing']);
    expect(result.batchDir).toBe('Q:\\batch');
  });

  it('makes no quarantine batch at all when there are no registry keys', async () => {
    const folder = makeLeftoverFolder();
    sendToRecycleBin.mockResolvedValue({ recycled: [folder], failed: [] });
    const result = await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'recycle' });
    expect(quarantineAndDelete).not.toHaveBeenCalled();
    expect(result.batchDir).toBeNull();
  });
});

describe('permanently', () => {
  it('deletes a leftover folder and everything in it', async () => {
    const folder = makeLeftoverFolder();
    const result = await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'permanent' });

    expect(existsSync(folder)).toBe(false);
    expect(result.destination).toBe('permanent');
    expect(result.files).toEqual([{ originalPath: folder, sizeBytes: 8 }]);
    expect(result.totalSizeBytes).toBe(8);
    expect(sendToRecycleBin).not.toHaveBeenCalled();
  });

  it('refuses a protected path, says why, and deletes the rest', async () => {
    const folder = makeLeftoverFolder();
    const windows = process.env.SystemRoot || 'C:\\Windows';
    const result = await removeLeftovers({ programName: 'Thing', files: [windows, folder], registryKeys: [], destination: 'permanent' });

    expect(result.failedFiles).toEqual([{ path: windows, reason: expect.stringMatching(/Windows/) }]);
    expect(existsSync(windows)).toBe(true);
    expect(existsSync(folder)).toBe(false);
  });

  it('skips a path that is already gone', async () => {
    const result = await removeLeftovers({ programName: 'Thing', files: [join(dir, 'nope')], registryKeys: [], destination: 'permanent' });
    expect(result.files).toEqual([]);
    expect(result.failedFiles).toEqual([]);
  });

  it('still exports each registry key before deleting it', async () => {
    await removeLeftovers({ programName: 'Thing', files: [], registryKeys: ['HKCU\\Software\\Thing'], destination: 'permanent' });
    expect(quarantineAndDelete).toHaveBeenCalledWith({ programName: 'Thing', files: [], registryKeys: ['HKCU\\Software\\Thing'] });
  });
});

describe('permanentDeletionRefusal', () => {
  /* The Disk Map's guard refuses everything under Program Files, which is
   * right for a right-click on a picture of the disk and wrong here: the
   * folder an uninstaller leaves in Program Files is the most common
   * leftover there is. So this guard allows a program's own folder and
   * refuses the places that hold everyone's -- and it is written out as
   * a table, because the cost of a wrong answer is not recoverable. */
  const where = {
    systemRoot: 'C:\\Windows',
    programFiles: 'C:\\Program Files',
    programFilesX86: 'C:\\Program Files (x86)',
    programData: 'C:\\ProgramData',
    usersRoot: 'C:\\Users',
    quarantineRoot: 'C:\\Users\\jim\\AppData\\Local\\Prune\\quarantine'
  };
  const refused = (path) => permanentDeletionRefusal(path, where);

  it.each([
    ['C:\\'],
    ['C:\\Windows'],
    ['C:\\Windows\\System32\\drivers'],
    ['C:\\Program Files'],
    ['C:\\Program Files (x86)'],
    ['C:\\Program Files\\Common Files'],
    ['C:\\Program Files (x86)\\Common Files'],
    ['C:\\ProgramData'],
    ['C:\\ProgramData\\Microsoft'],
    ['C:\\Users'],
    ['C:\\Users\\jim'],
    ['C:\\Users\\Public'],
    ['C:\\Users\\jim\\AppData'],
    ['C:\\Users\\jim\\AppData\\Roaming'],
    ['C:\\Users\\jim\\AppData\\Local'],
    ['C:\\Users\\jim\\AppData\\LocalLow'],
    ['C:\\Users\\jim\\Documents'],
    ['C:\\Users\\jim\\Desktop'],
    ['C:\\Users\\jim\\Downloads'],
    ['C:\\Users\\jim\\AppData\\Local\\Prune\\quarantine'],
    ['C:\\Users\\jim\\AppData\\Local\\Prune'],
    ['C:\\Users\\jim\\AppData\\Roaming\\Vendor\\..\\..\\..'],
    ['Vendor'],
    [''],
  ])('refuses %s', (path) => {
    expect(refused(path)).toEqual(expect.any(String));
  });

  it.each([
    ['C:\\Program Files\\Vendor'],
    ['C:\\Program Files (x86)\\Vendor\\App'],
    ['C:\\Program Files\\Common Files\\Vendor'],
    ['C:\\ProgramData\\Vendor'],
    ['C:\\Users\\jim\\AppData\\Roaming\\Vendor'],
    ['C:\\Users\\jim\\AppData\\Local\\Vendor\\Cache'],
    ['C:\\Users\\jim\\.vendor'],
    ['D:\\Games\\SomeGame'],
  ])('allows %s', (path) => {
    expect(refused(path)).toBeNull();
  });

  it('is case-insensitive, as Windows paths are', () => {
    expect(refused('c:\\program files')).toEqual(expect.any(String));
    expect(refused('C:/USERS/jim/appdata/ROAMING')).toEqual(expect.any(String));
  });
});
