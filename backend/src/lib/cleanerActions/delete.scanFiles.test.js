import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, resolveActionFiles } from './delete.js';

/** Preview now carries the files it found -- the biggest 200 and the true
 * totals -- built while walking, so a rule matching millions of files never
 * holds them in memory just to be shown. */

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-scanfiles-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

const put = (name, bytes) => writeFile(join(dir, name), 'x'.repeat(bytes));

describe('scan() with a file list', () => {
  it('lists each file with its size, biggest first, beside the totals', async () => {
    await put('small.tmp', 1);
    await put('big.tmp', 300);
    await mkdir(join(dir, 'sub'));
    await writeFile(join(dir, 'sub', 'medium.tmp'), 'x'.repeat(40));

    const result = scan({ expandedPaths: [dir] }, {});

    expect(result.fileCount).toBe(3);
    expect(result.sizeBytes).toBe(341);
    expect(result.files).toEqual([
      { path: join(dir, 'big.tmp'), sizeBytes: 300 },
      { path: join(dir, 'sub', 'medium.tmp'), sizeBytes: 40 },
      { path: join(dir, 'small.tmp'), sizeBytes: 1 }
    ]);
  });

  it('caps the list at 200 but counts every file', async () => {
    for (let i = 0; i < 230; i += 1) await put(`f${String(i).padStart(3, '0')}.tmp`, i + 1);
    const result = scan({ expandedPaths: [dir] }, {});
    expect(result.fileCount).toBe(230);
    expect(result.sizeBytes).toBe((230 * 231) / 2);
    expect(result.files).toHaveLength(200);
    expect(result.files[0].sizeBytes).toBe(230);
    expect(result.files.at(-1).sizeBytes).toBe(31); // the 30 smallest were left off
  });

  it('lists only what Clean would take: held-back files are counted as held, not listed', async () => {
    await mkdir(join(dir, 'keep'));
    await writeFile(join(dir, 'keep', 'secret.dat'), 'x'.repeat(500));
    await put('junk.tmp', 10);
    const result = scan({ expandedPaths: [dir] }, { excludeFolders: [join(dir, 'keep')] });
    expect(result.fileCount).toBe(1);
    expect(result.heldCount).toBe(1);
    expect(result.files.map((f) => f.path)).toEqual([join(dir, 'junk.tmp')]);
  });

  it('agrees with what the clean will resolve, file for file', async () => {
    for (let i = 0; i < 25; i += 1) await put(`g${i}.tmp`, i + 1);
    const guards = { excludeExtensions: ['.keep'] };
    await put('x.keep', 99);
    const previewed = scan({ expandedPaths: [dir] }, guards);
    const resolved = resolveActionFiles([dir], guards);
    expect(previewed.fileCount).toBe(resolved.files.length);
    expect(previewed.sizeBytes).toBe(resolved.files.reduce((s, f) => s + f.sizeBytes, 0));
    expect(previewed.heldCount).toBe(resolved.held.length);
    expect(new Set(previewed.files.map((f) => f.path))).toEqual(new Set(resolved.files.map((f) => f.path)));
  });

  it('counts a file once when ** reaches it twice', async () => {
    await mkdir(join(dir, 'a', 'b'), { recursive: true });
    await writeFile(join(dir, 'a', 'b', 'x.tmp'), 'xxxx');
    const result = scan({ expandedPaths: [join(dir, '**', '*.tmp')] }, {});
    expect(result.fileCount).toBe(1);
    expect(result.files).toHaveLength(1);
  });

  it('a path that does not exist is an empty list, not an error', () => {
    const result = scan({ expandedPaths: [join(dir, 'nope')] }, {});
    expect(result).toMatchObject({ fileCount: 0, sizeBytes: 0, files: [], accessible: true });
  });
});
