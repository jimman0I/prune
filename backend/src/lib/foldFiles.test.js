import { describe, it, expect } from 'vitest';
import { foldTreeFiles, extensionKey, FoldPlanner, keptCount } from './foldFiles.js';

const file = (name, size, extra = {}) => ({ name, size, type: 'file', ...extra });

function walkTree(fileCount) {
  const children = [];
  for (let i = 1; i <= fileCount; i++) children.push(file(`f${i}.${i % 2 ? 'TXT' : 'dat'}`, i, { allocated: 4096 }));
  return {
    name: 'D:\\data', size: (fileCount * (fileCount + 1)) / 2 + 5, type: 'directory',
    children: [
      ...children,
      { name: 'sub', size: 5, type: 'directory', children: [file('only.bin', 5)] }
    ]
  };
}

describe('extensionKey', () => {
  it('matches the front end: lowercased, with a letter in it, empty when there is none', () => {
    expect(extensionKey('Archive.TAR.GZ')).toBe('.gz');
    expect(extensionKey('readme')).toBe('');
    expect(extensionKey('version 1.0.9255')).toBe('');
    expect(extensionKey('.gitignore')).toBe('.gitignore');
    expect(extensionKey('a.b_c-d')).toBe('.b_c-d');
    expect(extensionKey(undefined)).toBe('');
  });
});

describe('foldTreeFiles (the folder walk\'s tree)', () => {
  it('folds a folder\'s smaller files into a block on the folder and keeps every directory', () => {
    const tree = foldTreeFiles(walkTree(300), { keep: 20 });
    expect(tree.children.filter((c) => c.type === 'file')).toHaveLength(20);
    expect(tree.children.some((c) => c.name === 'sub')).toBe(true);
    expect(tree.folded.count).toBe(280);
    expect(tree.folded.size).toBe((280 * 281) / 2);
    expect(tree.folded.allocated).toBe(280 * 4096);
    expect(tree.foldedExts['.txt'][1] + tree.foldedExts['.dat'][1]).toBe(280);
    // The tree's own size is untouched: it was the sum of everything.
    expect(tree.size).toBe((300 * 301) / 2 + 5);
  });

  it('leaves a tree with nothing to fold exactly as it was', () => {
    const before = JSON.stringify(walkTree(10));
    expect(JSON.stringify(foldTreeFiles(walkTree(10)))).toBe(before);
  });

  it('never folds markers that are not files: excluded entries, unread folders, "not scanned" blocks', () => {
    const tree = {
      name: 'D:', size: 0, type: 'directory',
      children: [
        { name: 'skipped', size: 0, type: 'directory', excluded: true, children: [] },
        { name: 'blocked', size: 0, type: 'directory', readable: false, children: [] },
        { name: 'x.vhdx', size: 0, type: 'file', excluded: true },
        ...Array.from({ length: 12 }, (_, i) => file(`f${i}.txt`, i + 1))
      ]
    };
    foldTreeFiles(tree, { keep: 2 });
    expect(tree.children.filter((c) => c.excluded || c.readable === false)).toHaveLength(3);
    expect(tree.folded.count).toBe(10);
  });
});

describe('FoldPlanner', () => {
  it('keeps everything the per-folder cap allows when the drive fits the budget', () => {
    const planner = new FoldPlanner({ keep: 200 });
    planner.addFolder([10, 20, 30]);
    expect(planner.floorFor(1_000_000)).toBe(-1);
  });

  it('finds the smallest floor that fits, and the estimate at it fits the budget', () => {
    const planner = new FoldPlanner({ keep: 200 });
    for (let d = 0; d < 50; d++) planner.addFolder(Array.from({ length: 100 }, (_, i) => (i + 1) * 1000));
    const budget = 50 * 165 + 900 * 115 + 50 * 180;
    const floor = planner.floorFor(budget);
    expect(floor).toBeGreaterThan(0);
    expect(planner.estimate(floor)).toBeLessThanOrEqual(budget);
    // One notch lower would not have fit.
    expect(planner.estimate(Math.max(floor - Math.ceil(floor * 0.3), -1))).toBeGreaterThan(budget);
  });

  it('keptCount agrees with the rule: cap, floor, and no fold of fewer than three', () => {
    expect(keptCount(5, [50, 40, 30, 20, 10], -1, 3)).toBe(5); // folding 2 would not pay
    expect(keptCount(6, [60, 50, 40, 30, 20, 10], -1, 3)).toBe(3);
    expect(keptCount(6, [60, 50, 40, 30, 20, 10], 35, 10)).toBe(3);
  });
});
