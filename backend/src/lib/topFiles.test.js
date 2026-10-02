import { describe, it, expect } from 'vitest';
import { createTopFiles, mergeTopFiles, FILE_LIST_LIMIT } from './topFiles.js';

describe('createTopFiles', () => {
  it('keeps the largest N, biggest first', () => {
    const top = createTopFiles(3);
    for (const [path, size] of [['a', 5], ['b', 50], ['c', 20], ['d', 1], ['e', 30], ['f', 40]]) top.add(path, size);
    expect(top.toArray()).toEqual([
      { path: 'b', sizeBytes: 50 }, { path: 'f', sizeBytes: 40 }, { path: 'e', sizeBytes: 30 }
    ]);
  });

  it('never holds more than the limit, however many it is shown', () => {
    const top = createTopFiles(10);
    for (let i = 0; i < 100_000; i += 1) top.add(`f${i}`, i);
    expect(top.toArray()).toHaveLength(10);
    expect(top.toArray()[0].sizeBytes).toBe(99_999);
  });

  it('fewer files than the limit are all kept', () => {
    const top = createTopFiles(200);
    top.add('only', 7);
    expect(top.toArray()).toEqual([{ path: 'only', sizeBytes: 7 }]);
  });

  it('a limit of 0 keeps nothing', () => {
    const top = createTopFiles(0);
    top.add('a', 5);
    expect(top.toArray()).toEqual([]);
  });

  it('ignores a size that is not a number', () => {
    const top = createTopFiles(3);
    top.add('a', NaN);
    top.add('b', undefined);
    top.add('c', 4);
    expect(top.toArray()).toEqual([{ path: 'c', sizeBytes: 4 }]);
  });

  it('defaults to the documented list size', () => {
    expect(FILE_LIST_LIMIT).toBe(200);
    const top = createTopFiles();
    for (let i = 0; i < 500; i += 1) top.add(`f${i}`, i);
    expect(top.toArray()).toHaveLength(FILE_LIST_LIMIT);
  });
});

describe('mergeTopFiles', () => {
  it('combines lists from several actions, still capped and biggest first', () => {
    const merged = mergeTopFiles([[{ path: 'a', sizeBytes: 10 }, { path: 'b', sizeBytes: 1 }], [{ path: 'c', sizeBytes: 5 }]], 2);
    expect(merged).toEqual([{ path: 'a', sizeBytes: 10 }, { path: 'c', sizeBytes: 5 }]);
  });

  it('tolerates a missing list', () => {
    expect(mergeTopFiles([undefined, [{ path: 'a', sizeBytes: 1 }]])).toEqual([{ path: 'a', sizeBytes: 1 }]);
  });
});
