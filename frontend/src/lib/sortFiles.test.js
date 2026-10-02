import { describe, it, expect } from 'vitest';
import { sortFiles } from './sortFiles.js';

const files = [
  { name: 'b.bin', size: 20, modified: 300 },
  { name: 'a.bin', size: 30, modified: null },
  { name: 'C.bin', size: 10, modified: 100 }
];

describe('sortFiles', () => {
  it('sorts by size, largest first by default', () => {
    expect(sortFiles(files, 'size', 'desc').map((f) => f.name)).toEqual(['a.bin', 'b.bin', 'C.bin']);
    expect(sortFiles(files, 'size', 'asc').map((f) => f.name)).toEqual(['C.bin', 'b.bin', 'a.bin']);
  });

  it('sorts by modified date, newest first when descending', () => {
    expect(sortFiles(files, 'modified', 'desc').map((f) => f.name)).toEqual(['b.bin', 'C.bin', 'a.bin']);
  });

  // A file with no date is unknown, not the oldest: it sinks both ways.
  it('sinks files with no date to the bottom in either direction', () => {
    expect(sortFiles(files, 'modified', 'asc').map((f) => f.name)).toEqual(['C.bin', 'b.bin', 'a.bin']);
  });

  it('sorts names case-insensitively and numerically', () => {
    const named = [{ name: 'file10' }, { name: 'File2' }, { name: 'apple' }];
    expect(sortFiles(named, 'name', 'asc').map((f) => f.name)).toEqual(['apple', 'File2', 'file10']);
  });

  it('does not mutate its input and tolerates nothing', () => {
    const copy = [...files];
    sortFiles(files, 'size', 'asc');
    expect(files).toEqual(copy);
    expect(sortFiles(undefined, 'size', 'asc')).toEqual([]);
  });

  it('falls back to name for ties so the order is stable', () => {
    const ties = [{ name: 'z', size: 1 }, { name: 'a', size: 1 }];
    expect(sortFiles(ties, 'size', 'desc').map((f) => f.name)).toEqual(['a', 'z']);
  });
});
