import { describe, it, expect } from 'vitest';
import { largestFiles } from './largestFiles.js';

const tree = {
  name: 'C:', type: 'directory', size: 1000, fullPath: 'C:\\',
  children: [
    { name: 'small.txt', type: 'file', size: 10, fullPath: 'C:\\small.txt' },
    {
      name: 'games', type: 'directory', size: 990, fullPath: 'C:\\games',
      children: [
        { name: 'pak0.ucas', type: 'file', size: 800, fullPath: 'C:\\games\\pak0.ucas' },
        { name: 'pak1.ucas', type: 'file', size: 190, fullPath: 'C:\\games\\pak1.ucas' }
      ]
    }
  ]
};

describe('largestFiles', () => {
  it('returns files from anywhere in the tree, largest first', () => {
    const files = largestFiles(tree);
    expect(files.map((f) => f.name)).toEqual(['pak0.ucas', 'pak1.ucas', 'small.txt']);
    expect(files[0].size).toBe(800);
  });

  it('carries the full path, which is the point of the list', () => {
    expect(largestFiles(tree)[0].fullPath).toBe('C:\\games\\pak0.ucas');
  });

  it('never returns a directory', () => {
    // A directory carries the sum of its children, so it would top the
    // list every time and be undeletable besides.
    expect(largestFiles(tree).some((f) => f.name === 'games')).toBe(false);
  });

  it('never returns the unscanned remainder', () => {
    // It is a directory carrying hundreds of gigabytes -- it would lead
    // this list on every truncated scan, and it is not a file.
    const files = largestFiles({
      name: 'C:', type: 'directory',
      children: [
        { name: 'a.bin', type: 'file', size: 5 },
        { name: 'Not scanned', type: 'directory', size: 900, scanned: false }
      ]
    });
    expect(files.map((f) => f.name)).toEqual(['a.bin']);
  });

  it('skips empty files', () => {
    const files = largestFiles({
      name: 'C:', type: 'directory',
      children: [{ name: 'zero.txt', type: 'file', size: 0 }]
    });
    expect(files).toEqual([]);
  });

  it('honours the limit', () => {
    expect(largestFiles(tree, { limit: 2 }).map((f) => f.name)).toEqual(['pak0.ucas', 'pak1.ucas']);
  });

  it('survives a tree deep enough to blow a recursive walk', () => {
    let node = { name: 'deep.bin', type: 'file', size: 1 };
    for (let i = 0; i < 50000; i += 1) {
      node = { name: `d${i}`, type: 'directory', children: [node] };
    }
    expect(largestFiles(node)).toHaveLength(1);
  });

  it('copes with no tree', () => {
    expect(largestFiles(null)).toEqual([]);
  });
});
