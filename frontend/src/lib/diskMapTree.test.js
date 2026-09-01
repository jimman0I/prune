import { describe, it, expect } from 'vitest';
import { attachFullPaths, topLevelCells } from './diskMapTree.js';

describe('attachFullPaths', () => {
  it('attaches the root path to the root node itself', () => {
    const tree = { name: 'sub', size: 5, type: 'directory', children: [] };
    const result = attachFullPaths(tree, 'C:\\Users\\Jim\\sub');
    expect(result.fullPath).toBe('C:\\Users\\Jim\\sub');
  });

  it('joins child paths onto the root path with a backslash', () => {
    const tree = {
      name: 'sub', size: 15, type: 'directory',
      children: [
        { name: 'a.txt', size: 5, type: 'file' },
        { name: 'nested', size: 10, type: 'directory', children: [{ name: 'b.txt', size: 10, type: 'file' }] }
      ]
    };
    const result = attachFullPaths(tree, 'C:\\sub');
    expect(result.children[0].fullPath).toBe('C:\\sub\\a.txt');
    expect(result.children[1].fullPath).toBe('C:\\sub\\nested');
    expect(result.children[1].children[0].fullPath).toBe('C:\\sub\\nested\\b.txt');
  });

  it('does not add a doubled backslash when the root path already ends in one', () => {
    const tree = { name: 'x.txt', size: 1, type: 'file' };
    // A drive root like "C:\" -- joining "x.txt" onto it must not produce "C:\\x.txt".
    const result = attachFullPaths({ name: 'C:\\', size: 1, type: 'directory', children: [tree] }, 'C:\\');
    expect(result.children[0].fullPath).toBe('C:\\x.txt');
  });

  it('leaves every other field on each node untouched', () => {
    const tree = { name: 'a.txt', size: 5, type: 'file' };
    const result = attachFullPaths(tree, 'C:\\a.txt');
    expect(result).toEqual({ name: 'a.txt', size: 5, type: 'file', fullPath: 'C:\\a.txt' });
  });

  it('returns null unchanged (a failed/empty scan)', () => {
    expect(attachFullPaths(null, 'C:\\')).toBeNull();
  });
});

describe('topLevelCells', () => {
  // Real bug, found live: recharts' Treemap given the WHOLE recursive tree
  // renders every descendant as its own nested rect -- a directory's rect
  // ends up fully covered by its children's rects (same region, painted on
  // top), so it can never be clicked. The fix: only ever hand recharts the
  // CURRENT directory's own direct children, each one flattened (no
  // `children` key of its own) so it renders as a single solid, fully
  // clickable rect -- one treemap level at a time, exactly how drill-down
  // is supposed to work.
  it('returns the direct children with their own children stripped', () => {
    const tree = {
      name: 'src', size: 30, type: 'directory', fullPath: 'C:\\src',
      children: [
        { name: 'a.txt', size: 5, type: 'file', fullPath: 'C:\\src\\a.txt' },
        {
          name: 'sub', size: 25, type: 'directory', fullPath: 'C:\\src\\sub',
          children: [{ name: 'b.txt', size: 25, type: 'file', fullPath: 'C:\\src\\sub\\b.txt' }]
        }
      ]
    };
    const cells = topLevelCells(tree);
    expect(cells).toEqual([
      { name: 'a.txt', size: 5, type: 'file', fullPath: 'C:\\src\\a.txt' },
      { name: 'sub', size: 25, type: 'directory', fullPath: 'C:\\src\\sub' }
    ]);
  });

  it('returns an empty array for a leaf file (no children at all)', () => {
    expect(topLevelCells({ name: 'a.txt', size: 5, type: 'file', fullPath: 'C:\\a.txt' })).toEqual([]);
  });

  it('returns an empty array for a directory with no children (unreadable, or genuinely empty)', () => {
    expect(topLevelCells({ name: 'opaque', size: 0, type: 'directory', fullPath: 'C:\\opaque', children: [] })).toEqual([]);
  });

  it('returns an empty array for null (a failed/empty scan)', () => {
    expect(topLevelCells(null)).toEqual([]);
  });
});
