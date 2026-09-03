import { describe, it, expect } from 'vitest';
import { extensionBreakdown, NO_EXTENSION } from './extensionBreakdown.js';

const tree = {
  name: 'C:', type: 'directory', size: 300,
  children: [
    { name: 'a.mp4', type: 'file', size: 100 },
    {
      name: 'games', type: 'directory', size: 200,
      children: [
        { name: 'b.mp4', type: 'file', size: 120 },
        { name: 'c.pak', type: 'file', size: 60 },
        { name: 'LICENSE', type: 'file', size: 20 }
      ]
    }
  ]
};

describe('extensionBreakdown', () => {
  it('groups files by extension across the whole tree', () => {
    const { rows } = extensionBreakdown(tree);
    expect(rows[0]).toMatchObject({ extension: '.mp4', sizeBytes: 220, fileCount: 2 });
    expect(rows[1]).toMatchObject({ extension: '.pak', sizeBytes: 60, fileCount: 1 });
  });

  it('never counts a directory', () => {
    // Directories carry the sum of their children, so counting them too
    // would report every byte at least twice.
    const { totalBytes, totalFiles } = extensionBreakdown(tree);
    expect(totalBytes).toBe(300);
    expect(totalFiles).toBe(4);
  });

  it('files an extensionless name separately', () => {
    const { rows } = extensionBreakdown(tree);
    const none = rows.find((r) => r.extension === NO_EXTENSION);
    expect(none).toMatchObject({ sizeBytes: 20, fileCount: 1 });
  });

  it('reports each row as a share of the scanned total', () => {
    const { rows } = extensionBreakdown(tree);
    expect(rows[0].percent).toBeCloseTo(73.33, 1);
    expect(rows.reduce((sum, r) => sum + r.percent, 0)).toBeCloseTo(100, 5);
  });

  it('ignores the unscanned remainder block', () => {
    // A synthetic cell standing for space the scan never reached. It is
    // not a file and must not become an extension row.
    const { rows, totalBytes } = extensionBreakdown({
      name: 'C:', type: 'directory',
      children: [
        { name: 'a.mp4', type: 'file', size: 100 },
        { name: 'Unscanned', type: 'file', size: 900, scanned: false }
      ]
    });
    expect(rows).toHaveLength(1);
    expect(totalBytes).toBe(100);
  });

  it('does not treat a version suffix as an extension', () => {
    // "app-1.0.9255" is a Squirrel folder, not a .9255 file.
    const { rows } = extensionBreakdown({
      name: 'C:', type: 'directory',
      children: [{ name: 'app-1.0.9255', type: 'file', size: 10 }]
    });
    expect(rows[0].extension).toBe(NO_EXTENSION);
  });

  it('copes with an empty or missing tree', () => {
    expect(extensionBreakdown(null)).toEqual({
      rows: [], totalBytes: 0, totalFiles: 0, treeBytes: 0, uncategorizedBytes: 0
    });
    expect(extensionBreakdown({ name: 'C:', type: 'directory', children: [] }).rows).toEqual([]);
  });

  it('survives a tree deep enough to blow a recursive walk', () => {
    let node = { name: 'deep.txt', type: 'file', size: 1 };
    for (let i = 0; i < 50000; i += 1) {
      node = { name: `d${i}`, type: 'directory', children: [node] };
    }
    expect(extensionBreakdown(node).totalFiles).toBe(1);
  });
});

describe('what the rows do not account for', () => {
  // The scan is depth-limited: a folder past the limit reports its size
  // but its files are not in the tree to be categorised. On this machine
  // that is 33.40 GB categorised out of a 35.14 GB tree, and a panel that
  // showed only the first number would be quietly claiming the second.
  it('reports the gap between the tree and the categorised files', () => {
    const result = extensionBreakdown({
      name: 'C:', type: 'directory', size: 1000,
      children: [
        { name: 'a.mp4', type: 'file', size: 100 },
        { name: 'deep', type: 'directory', size: 900 } // children beyond the scan depth
      ]
    });
    expect(result.totalBytes).toBe(100);
    expect(result.treeBytes).toBe(1000);
    expect(result.uncategorizedBytes).toBe(900);
  });

  it('reports no gap when every byte is accounted for', () => {
    const result = extensionBreakdown({
      name: 'C:', type: 'directory', size: 100,
      children: [{ name: 'a.mp4', type: 'file', size: 100 }]
    });
    expect(result.uncategorizedBytes).toBe(0);
  });
});

describe('the unscanned remainder is not a skipped folder', () => {
  // Caught on screen: the panel reported "794 GB in folders the scan did
  // not open" on a drive where the scan had reached 4% of 827 GB. The
  // number was real and the label was wrong -- almost all of it was never
  // scanned at all, which the coverage banner already says.
  it('excludes the remainder block from the tree total', () => {
    const result = extensionBreakdown({
      name: 'C:', type: 'directory', size: 1000,
      children: [
        { name: 'a.mp4', type: 'file', size: 60 },
        { name: 'deep', type: 'directory', size: 40 },       // past the scan depth
        // A DIRECTORY, which is how withUnscannedRemainder builds it.
        { name: 'Unscanned', type: 'directory', size: 900, scanned: false }
      ]
    });
    expect(result.totalBytes).toBe(60);
    expect(result.treeBytes).toBe(100);
    expect(result.uncategorizedBytes).toBe(40);
  });
});
