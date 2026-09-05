import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findDuplicates } from './duplicateScan.js';

/** Real files on disk, because the interesting failures are all about
 * what actually gets read: a same-size pair that differs, a file too
 * large to be worth a full read, an abort landing mid-hash. */
let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'prune-dupes-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const write = (name, contents) => {
  const path = join(root, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents, 'utf8');
  return path;
};

describe('findDuplicates', () => {
  it('finds identical files across folders', async () => {
    write('a/report.txt', 'the same contents');
    write('b/copy of report.txt', 'the same contents');
    write('c/different.txt', 'something else entirely');

    const result = await findDuplicates(root);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].count).toBe(2);
    expect(result.groups[0].files.map((f) => f.path.split(/[\\/]/).pop()).sort())
      .toEqual(['copy of report.txt', 'report.txt']);
  }, 30000);

  it('does NOT match files that merely share a size', async () => {
    // The case the whole three-pass design exists for. Same length,
    // different bytes -- a size-only matcher calls these duplicates and
    // would offer to delete one.
    write('a.bin', 'AAAAAAAAAA');
    write('b.bin', 'BBBBBBBBBB');

    const result = await findDuplicates(root);
    expect(result.groups).toEqual([]);
  }, 30000);

  it('separates same-size files that differ only past the sample window', async () => {
    // Identical for the first 64 KB and different after it. The partial
    // hash groups them and the full hash must then split them -- if the
    // second pass were skipped these would be reported as duplicates.
    const head = 'x'.repeat(70 * 1024);
    write('long-a.bin', `${head}ending-one`);
    write('long-b.bin', `${head}ending-two`);

    const result = await findDuplicates(root);
    expect(result.groups).toEqual([]);
  }, 60000);

  it('still matches when the difference is past the window but they are identical', async () => {
    const body = `${'y'.repeat(70 * 1024)}same-tail`;
    write('big-a.bin', body);
    write('big-b.bin', body);

    const result = await findDuplicates(root);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].count).toBe(2);
  }, 60000);

  it('reports waste as what deleting would actually return', async () => {
    write('one.txt', 'aaaa');
    write('two.txt', 'aaaa');
    write('three.txt', 'aaaa');

    const result = await findDuplicates(root);
    // Three copies of a 4-byte file waste 8 bytes, not 12.
    expect(result.wastedBytes).toBe(8);
  }, 30000);

  it('ignores empty files', async () => {
    write('empty-a', '');
    write('empty-b', '');
    const result = await findDuplicates(root);
    expect(result.groups).toEqual([]);
  }, 30000);

  it('honours exclusions', async () => {
    write('keep/report.txt', 'shared');
    write('skipme/report.txt', 'shared');

    const result = await findDuplicates(root, {
      exclusions: { excludeFolders: [join(root, 'skipme')], excludeExtensions: [] }
    });
    // Only one copy is visible, so there is no pair.
    expect(result.groups).toEqual([]);
  }, 30000);

  it('stops on an abort and says the answer is partial', async () => {
    for (let i = 0; i < 40; i++) write(`f${i}.txt`, 'same contents everywhere');
    const controller = new AbortController();
    controller.abort();

    const result = await findDuplicates(root, { signal: controller.signal });
    expect(result.truncated).toBe(true);
  }, 30000);

  it('marks a capped scan as truncated rather than as complete', async () => {
    // "No duplicates" and "we stopped looking" are different answers and
    // the caller has to be able to tell them apart.
    for (let i = 0; i < 10; i++) write(`g${i}.txt`, `contents ${i}`);
    const result = await findDuplicates(root, { maxFiles: 3 });
    expect(result.truncated).toBe(true);
  }, 30000);
});
