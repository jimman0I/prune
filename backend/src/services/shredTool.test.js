import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { previewShred, shredRequested, refusalFor, MAX_PATHS } from './shredTool.js';

/** "Shred files and folders" -- BleachBit's tool of that name. The user
 * picks the targets, so the protection against a slip is the point: the
 * guards a Deep Clean rule runs under apply here too. Everything happens
 * inside a temp folder; the protected paths are only ever asked about. */

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-shredtool-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('refusalFor', () => {
  it.each([
    [process.env.SystemRoot || 'C:\\Windows', /Windows/],
    ['C:\\', /whole drive/],
    ['C:\\Users', /every user account/],
    ['relative\\file.txt', /full path/],
    ['C:\\Users\\me\\..\\..\\Windows', /climb/],
    ['', /not a path/]
  ])('refuses %s', (path, reason) => {
    expect(refusalFor(path, {})).toMatch(reason);
  });

  it('refuses what the cleaner guards protect: the default protected folders', () => {
    expect(refusalFor('D:\\Data\\System Volume Information\\x.dat', {})).toMatch(/protected/i);
    expect(refusalFor('D:\\AV\\Quarantine\\sample.bin', {})).toMatch(/protected/i);
  });

  it("refuses the user's own excluded folders and file types", () => {
    const guards = { excludeFolders: ['D:\\Keep'], excludeExtensions: ['.psd'] };
    expect(refusalFor('D:\\Keep\\notes.txt', guards)).toMatch(/excluded folder/);
    expect(refusalFor('D:\\Other\\art.psd', guards)).toMatch(/excluded file type/);
    expect(refusalFor('D:\\KeepNot\\notes.txt', guards)).toBeNull();
  });

  it('allows an ordinary file', () => {
    expect(refusalFor('D:\\Stuff\\old.log', {})).toBeNull();
  });
});

describe('previewShred', () => {
  it('counts the files and bytes a file and a folder would destroy', async () => {
    await mkdir(join(dir, 'tree', 'deep'), { recursive: true });
    await writeFile(join(dir, 'tree', 'a.txt'), 'aaaa');
    await writeFile(join(dir, 'tree', 'deep', 'b.txt'), 'bb');
    await writeFile(join(dir, 'loose.txt'), 'c');

    const preview = await previewShred([join(dir, 'tree'), join(dir, 'loose.txt')], {});

    expect(preview.files).toBe(3);
    expect(preview.bytes).toBe(7);
    expect(preview.refused).toEqual([]);
    expect(preview.truncated).toBe(false);
  });

  it('lists a refused path with its reason and does not count it', async () => {
    await writeFile(join(dir, 'ok.txt'), 'ok');
    const windows = process.env.SystemRoot || 'C:\\Windows';
    const preview = await previewShred([windows, join(dir, 'ok.txt')], {});
    expect(preview.files).toBe(1);
    expect(preview.refused).toEqual([{ path: windows, reason: expect.stringMatching(/Windows/) }]);
  });

  it('leaves out files inside a protected subfolder of a chosen folder', async () => {
    await mkdir(join(dir, 'proj', 'Quarantine'), { recursive: true });
    await writeFile(join(dir, 'proj', 'keep.txt'), 'kk');
    await writeFile(join(dir, 'proj', 'Quarantine', 'sample.bin'), 'sample');
    const preview = await previewShred([join(dir, 'proj')], {});
    expect(preview.files).toBe(1);
    expect(preview.refused.map((r) => r.path)).toEqual([join(dir, 'proj', 'Quarantine')]);
  });

  it('a path that does not exist is reported, not thrown', async () => {
    const preview = await previewShred([join(dir, 'nope.txt')], {});
    expect(preview.files).toBe(0);
    expect(preview.refused).toHaveLength(1);
  });

  it('rejects input that is not a list of strings', async () => {
    await expect(previewShred('C:\\x', {})).rejects.toThrow(/list/);
    await expect(previewShred([], {})).rejects.toThrow(/at least one/);
    await expect(previewShred([1, 2], {})).rejects.toThrow(/text/);
    await expect(previewShred(Array(MAX_PATHS + 1).fill('C:\\a'), {})).rejects.toThrow(/at most/);
  });

  it('stops counting at the cap and says so', async () => {
    for (let i = 0; i < 5; i += 1) await writeFile(join(dir, `f${i}.txt`), 'x');
    const preview = await previewShred([dir], {}, { entryLimit: 3 });
    expect(preview.truncated).toBe(true);
    expect(preview.files).toBeLessThanOrEqual(3);
  });
});

describe('shredRequested', () => {
  it('shreds files and folders and reports the bytes', async () => {
    await mkdir(join(dir, 'tree'));
    await writeFile(join(dir, 'tree', 'a.txt'), 'aaaa');
    await writeFile(join(dir, 'loose.txt'), 'cc');

    const result = await shredRequested([join(dir, 'tree'), join(dir, 'loose.txt')], 1, {});

    expect(result.shreddedFiles).toBe(2);
    expect(result.bytes).toBe(6);
    expect(result.failed).toEqual([]);
    expect(result.held).toEqual([]);
    expect(existsSync(join(dir, 'tree'))).toBe(false);
    expect(existsSync(join(dir, 'loose.txt'))).toBe(false);
  });

  it('never touches a protected path and keeps the folder that holds it', async () => {
    await mkdir(join(dir, 'proj', 'Quarantine'), { recursive: true });
    await writeFile(join(dir, 'proj', 'junk.txt'), 'j');
    await writeFile(join(dir, 'proj', 'Quarantine', 'sample.bin'), 'sample');

    const result = await shredRequested([join(dir, 'proj')], 3, {});

    expect(existsSync(join(dir, 'proj', 'junk.txt'))).toBe(false);
    expect(existsSync(join(dir, 'proj', 'Quarantine', 'sample.bin'))).toBe(true);
    expect(result.held).toEqual([{ path: join(dir, 'proj', 'Quarantine'), reason: expect.stringMatching(/protected/i) }]);
    expect(result.shreddedFiles).toBe(1);
  });

  it("honours the user's exclusions", async () => {
    await mkdir(join(dir, 'keep'));
    await writeFile(join(dir, 'keep', 'important.txt'), 'i');
    await writeFile(join(dir, 'drop.txt'), 'd');
    const result = await shredRequested([join(dir, 'keep'), join(dir, 'drop.txt')], 1, { excludeFolders: [join(dir, 'keep')] });
    expect(existsSync(join(dir, 'keep', 'important.txt'))).toBe(true);
    expect(existsSync(join(dir, 'drop.txt'))).toBe(false);
    expect(result.held).toHaveLength(1);
  });

  it('refuses a whole drive or Windows without opening a single file', async () => {
    const windows = process.env.SystemRoot || 'C:\\Windows';
    const result = await shredRequested([windows, 'C:\\'], 1, {});
    expect(result.shreddedFiles).toBe(0);
    expect(result.held).toHaveLength(2);
  });

  it('passes the passes through, normalised', async () => {
    await writeFile(join(dir, 'a.txt'), 'abc');
    const seen = [];
    await shredRequested([join(dir, 'a.txt')], 7, {}, { onStage: (stage, _p, detail) => { if (stage === 'pass') seen.push(detail); } });
    expect(seen).toEqual([1]);
  });

  it('reports progress', async () => {
    await writeFile(join(dir, 'a.txt'), 'abc');
    const events = [];
    await shredRequested([join(dir, 'a.txt')], 1, {}, { onProgress: (p) => events.push(p) });
    expect(events.at(-1)).toMatchObject({ filesDone: 1, bytesDone: 3 });
  });
});
