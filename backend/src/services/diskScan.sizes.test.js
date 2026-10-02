import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, linkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDirectory } from './diskScan.js';

/** The folder walk's sizes: logical and on-disk, and a file with several
 * names counted once. Real files in a temp dir -- nothing outside it is
 * touched. */
describe('scanDirectory sizes', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-diskscan-sizes-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reports what a file occupies on disk beside its length', async () => {
    writeFileSync(join(dir, 'big.bin'), Buffer.alloc(100_000, 1));
    const tree = await scanDirectory(dir);
    const file = tree.children.find((c) => c.name === 'big.bin');
    expect(file.size).toBe(100_000);
    // Whole clusters, so never less than the length and within a cluster or
    // two of it for an ordinary file.
    expect(file.allocated).toBeGreaterThanOrEqual(100_000);
    expect(file.allocated).toBeLessThan(100_000 + 64 * 1024);
    expect(tree.allocated).toBe(file.allocated);
  });

  it('gives a folder the sum of what is below it', async () => {
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'a.bin'), Buffer.alloc(50_000, 1));
    writeFileSync(join(dir, 'b.bin'), Buffer.alloc(70_000, 1));
    const tree = await scanDirectory(dir);
    const sub = tree.children.find((c) => c.name === 'sub');
    expect(sub.allocated).toBe(sub.children[0].allocated);
    expect(tree.allocated).toBe(sub.allocated + tree.children.find((c) => c.name === 'b.bin').allocated);
  });

  // Bytes are charged to the first name met, once. The others stay visible.
  it('counts a hard-linked file once, in size and on disk', async () => {
    mkdirSync(join(dir, 'one'));
    mkdirSync(join(dir, 'two'));
    writeFileSync(join(dir, 'one', 'real.dll'), Buffer.alloc(40_000, 1));
    linkSync(join(dir, 'one', 'real.dll'), join(dir, 'two', 'link.dll'));

    const seen = [];
    const tree = await scanDirectory(dir, 12, undefined, null, (bytes) => seen.push(bytes));

    expect(tree.size).toBe(40_000);
    const files = tree.children.flatMap((d) => d.children);
    expect(files).toHaveLength(2);
    expect(files.filter((f) => f.hardLink)).toHaveLength(1);
    expect(files.find((f) => f.hardLink).size).toBe(0);
    expect(files.find((f) => f.hardLink).allocated).toBeUndefined();
    expect(tree.allocated).toBe(files.find((f) => !f.hardLink).allocated);
    // Both are files that were looked at, only one carried bytes.
    expect(seen.sort((a, b) => a - b)).toEqual([0, 40_000]);
  });

  it('does not treat two different files of the same size as links', async () => {
    writeFileSync(join(dir, 'a.bin'), Buffer.alloc(10_000, 1));
    writeFileSync(join(dir, 'b.bin'), Buffer.alloc(10_000, 1));
    const tree = await scanDirectory(dir);
    expect(tree.size).toBe(20_000);
    expect(tree.children.some((c) => c.hardLink)).toBe(false);
  });

  it('leaves a tiny file without an allocated field instead of reporting zero as a measurement', async () => {
    writeFileSync(join(dir, 'tiny.txt'), 'x');
    const tree = await scanDirectory(dir);
    const tiny = tree.children.find((c) => c.name === 'tiny.txt');
    expect(tiny.size).toBe(1);
    // Resident in its MFT record on NTFS (no clusters); a filesystem that
    // does allocate for it reports that. Either way never a negative or NaN.
    if ('allocated' in tiny) expect(tiny.allocated).toBeGreaterThan(0);
  });
});

describe('scanDirectory onFile detail', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-diskscan-detail-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('says where each file is and what it occupies, for a running picture of the walk', async () => {
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'a.bin'), Buffer.alloc(20_000, 1));
    const seen = [];
    await scanDirectory(dir, 12, undefined, null, (size, info) => seen.push({ size, info }));
    expect(seen).toHaveLength(1);
    expect(seen[0].size).toBe(20_000);
    expect(seen[0].info.path).toBe(join(dir, 'sub', 'a.bin'));
    expect(seen[0].info.allocated).toBeGreaterThanOrEqual(20_000);
  });
});
