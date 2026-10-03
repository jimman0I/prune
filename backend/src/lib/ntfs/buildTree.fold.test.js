import { describe, it, expect } from 'vitest';
import { buildTree, ROOT_RECORD } from './buildTree.js';

/** A volume with one folder of `fileCount` files (sizes 1..fileCount, mixed
 * extensions), plus a small second folder. Record numbers start at 100. */
function volumeWithBigFolder(fileCount, { allocated = true } = {}) {
  const map = new Map();
  map.set(ROOT_RECORD, { name: '.', parentRecord: ROOT_RECORD, sizeBytes: 0, isDirectory: true, allocatedBytes: 0 });
  map.set(10, { name: 'Big', parentRecord: ROOT_RECORD, sizeBytes: 0, isDirectory: true, allocatedBytes: 0 });
  map.set(11, { name: 'Small', parentRecord: ROOT_RECORD, sizeBytes: 0, isDirectory: true, allocatedBytes: 0 });
  map.set(12, { name: 'a.txt', parentRecord: 11, sizeBytes: 7, isDirectory: false, allocatedBytes: 4096 });
  for (let i = 1; i <= fileCount; i++) {
    map.set(100 + i, {
      name: `f${i}${i % 2 === 0 ? '.dll' : '.LOG'}`,
      parentRecord: 10,
      sizeBytes: i,
      isDirectory: false,
      allocatedBytes: allocated ? 4096 : undefined
    });
  }
  return map;
}

describe('buildTree: folding a big folder\'s small files', () => {
  it('keeps the largest files and folds the rest into one block, losing no bytes', () => {
    const records = volumeWithBigFolder(50);
    const report = {};
    const tree = buildTree(records, { name: 'C:', keepFiles: 10, report });

    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.size).toBe((50 * 51) / 2);
    expect(big.allocated).toBe(50 * 4096);
    expect(big.children).toHaveLength(10);
    expect(big.children.map((c) => c.size)).toEqual([50, 49, 48, 47, 46, 45, 44, 43, 42, 41]);
    // 40 files folded: sizes 1..40.
    expect(big.folded.count).toBe(40);
    expect(big.folded.size).toBe((40 * 41) / 2);
    expect(big.folded.allocated).toBe(40 * 4096);
    // Kept plus folded is exactly the folder.
    expect(big.children.reduce((s, c) => s + c.size, 0) + big.folded.size).toBe(big.size);
    expect(tree.size).toBe(big.size + 7);
    expect(report.foldedFiles).toBe(40);
  });

  it('says what the folded files were, by type, so a folder\'s type totals stay exact', () => {
    const tree = buildTree(volumeWithBigFolder(50), { name: 'C:', keepFiles: 10 });
    const big = tree.children.find((c) => c.name === 'Big');
    // Folded sizes 1..40: odd sizes are .log (case folded), even are .dll.
    const dll = [...Array(40)].map((_, i) => i + 1).filter((n) => n % 2 === 0);
    const log = [...Array(40)].map((_, i) => i + 1).filter((n) => n % 2 === 1);
    expect(big.folded.exts['.dll']).toEqual([dll.reduce((a, b) => a + b, 0), dll.length]);
    expect(big.folded.exts['.log']).toEqual([log.reduce((a, b) => a + b, 0), log.length]);
    // And the drive keeps one table of every folded file.
    expect(tree.foldedExts['.dll']).toEqual(big.folded.exts['.dll']);
  });

  it('never folds a directory, and leaves a folder with room for its files alone', () => {
    const tree = buildTree(volumeWithBigFolder(50), { name: 'C:', keepFiles: 10 });
    const small = tree.children.find((c) => c.name === 'Small');
    expect(small.children).toHaveLength(1);
    expect(small.folded).toBeUndefined();
  });

  it('does not fold one or two files: the block would cost as much as they do', () => {
    const tree = buildTree(volumeWithBigFolder(11), { name: 'C:', keepFiles: 10 });
    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.children).toHaveLength(11);
    expect(big.folded).toBeUndefined();
  });

  it('keeps the default per-folder cap generous enough that an ordinary folder is untouched', () => {
    const tree = buildTree(volumeWithBigFolder(150), { name: 'C:' });
    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.children).toHaveLength(150);
    expect(big.folded).toBeUndefined();
    expect(tree.foldedExts).toBeUndefined();
  });

  it('raises a size floor when the drive would still be too big, folding the smallest kept files too', () => {
    const records = volumeWithBigFolder(40);
    const report = {};
    // A budget far below what 40 kept files cost.
    const tree = buildTree(records, { name: 'C:', keepFiles: 200, byteBudget: 2500, report });
    const big = tree.children.find((c) => c.name === 'Big');
    expect(report.sizeFloorBytes).toBeGreaterThan(0);
    expect(big.children.length).toBeLessThan(40);
    // Everything kept is bigger than everything folded, and nothing is lost.
    const smallestKept = Math.min(...big.children.map((c) => c.size));
    expect(smallestKept).toBeGreaterThan(report.sizeFloorBytes - 1);
    expect(big.folded.count + big.children.length).toBe(40);
    expect(big.children.reduce((s, c) => s + c.size, 0) + big.folded.size).toBe(big.size);
  });

  it('carries no allocation on the block when the records had none', () => {
    const tree = buildTree(volumeWithBigFolder(30, { allocated: false }), { name: 'C:', keepFiles: 5 });
    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.folded.count).toBe(25);
    expect(big.folded.allocated).toBeUndefined();
  });

  it('writes nothing for files past the depth cap: they are in the totals and nowhere else', () => {
    const tree = buildTree(volumeWithBigFolder(50), { name: 'C:', keepFiles: 10, maxDepth: 1 });
    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.children).toBeUndefined();
    expect(big.folded).toBeUndefined();
    expect(big.size).toBe((50 * 51) / 2);
    expect(tree.foldedExts).toBeUndefined();
  });

  it('keeps an excluded file as its marked placeholder and folds only what counts', () => {
    const records = volumeWithBigFolder(20);
    records.set(500, { name: 'skip.vhdx', parentRecord: 10, sizeBytes: 999, isDirectory: false, allocatedBytes: 4096 });
    const tree = buildTree(records, { name: 'C:', keepFiles: 5, exclusions: { excludeFolders: [], excludeExtensions: ['.vhdx'] } });
    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.size).toBe((20 * 21) / 2);
    expect(big.children.some((c) => c.name === 'skip.vhdx' && c.excluded)).toBe(true);
    expect(big.folded.count).toBe(15);
  });

  it('folds orphaned files too, and counts them in the bucket\'s size', () => {
    const records = volumeWithBigFolder(0);
    for (let i = 1; i <= 30; i++) records.set(900 + i, { name: `lost${i}.bin`, parentRecord: 4242, sizeBytes: i, isDirectory: false });
    const tree = buildTree(records, { name: 'C:', keepFiles: 5 });
    const bucket = tree.children.find((c) => /orphaned/i.test(c.name));
    expect(bucket.size).toBe((30 * 31) / 2);
    expect(bucket.folded.count).toBe(25);
    expect(tree.size).toBe(7 + (30 * 31) / 2);
  });
});
