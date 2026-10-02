import { describe, it, expect } from 'vitest';
import { biggestSelected, fileName } from './biggestFiles.js';

const tree = [
  { category: 'A', items: [
    { id: 'a1', files: [{ path: 'C:\\x\\huge.bin', sizeBytes: 900 }, { path: 'C:\\x\\small.bin', sizeBytes: 5 }] },
    { id: 'a2', files: [{ path: 'C:\\y\\mid.dat', sizeBytes: 300 }] }
  ] },
  { category: 'B', items: [
    { id: 'b1', files: [{ path: 'D:\\z\\big.log', sizeBytes: 600 }] },
    { id: 'b2' }
  ] }
];

describe('biggestSelected', () => {
  it('takes the largest files across the ticked rules only', () => {
    expect(biggestSelected(tree, new Set(['a1', 'a2', 'b1']), 3).map((f) => f.sizeBytes)).toEqual([900, 600, 300]);
    expect(biggestSelected(tree, new Set(['a2']), 3).map((f) => f.path)).toEqual(['C:\\y\\mid.dat']);
  });

  it('is empty when nothing ticked listed any files', () => {
    expect(biggestSelected(tree, new Set(['b2']), 3)).toEqual([]);
    expect(biggestSelected(tree, new Set(), 3)).toEqual([]);
    expect(biggestSelected(null, new Set(['a1']), 3)).toEqual([]);
  });

  it('stops at n', () => {
    expect(biggestSelected(tree, new Set(['a1', 'a2', 'b1']), 2)).toHaveLength(2);
  });
});

describe('fileName', () => {
  it('is the last part of a Windows or POSIX path', () => {
    expect(fileName('C:\\x\\huge.bin')).toBe('huge.bin');
    expect(fileName('/a/b/c.txt')).toBe('c.txt');
    expect(fileName('plain')).toBe('plain');
  });
});
