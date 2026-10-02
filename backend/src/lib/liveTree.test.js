import { describe, it, expect } from 'vitest';
import { createLiveTree, relativeSegments } from './liveTree.js';

describe('relativeSegments', () => {
  it('splits what is under the root into folder names and a file name', () => {
    expect(relativeSegments('C:\\', 'C:\\Users\\me\\a.txt')).toEqual(['Users', 'me', 'a.txt']);
    expect(relativeSegments('C:\\Users', 'C:\\Users\\me\\a.txt')).toEqual(['me', 'a.txt']);
    expect(relativeSegments('C:\\Users\\', 'C:\\Users\\a.txt')).toEqual(['a.txt']);
  });

  it('ignores case, as Windows does', () => {
    expect(relativeSegments('c:\\users', 'C:\\Users\\Me\\a.txt')).toEqual(['Me', 'a.txt']);
  });

  it('is null for a path that is not under the root', () => {
    expect(relativeSegments('C:\\Users', 'D:\\x.txt')).toBeNull();
    expect(relativeSegments('C:\\Users', 'C:\\UsersOther\\x.txt')).toBeNull();
  });

  it('is empty for the root itself (a scan of a single file)', () => {
    expect(relativeSegments('C:\\a.txt', 'C:\\a.txt')).toEqual([]);
  });
});

describe('createLiveTree', () => {
  const feed = (live) => {
    live.add(['Users', 'me', 'deep', 'x.bin'], 100, 4096);
    live.add(['Users', 'me', 'y.bin'], 50, 4096);
    live.add(['Users', 'z.bin'], 10, 0);
    live.add(['Windows', 'w.dll'], 300, 4096);
    live.add(['top.txt'], 5, 0);
  };

  it('sums what has been read so far into each folder, however deep the file is', () => {
    const live = createLiveTree('C:', { depth: 2 });
    feed(live);
    const tree = live.snapshot();
    expect(tree.name).toBe('C:');
    expect(tree.size).toBe(465);
    expect(tree.allocated).toBe(4096 * 3);
    const users = tree.children.find((c) => c.name === 'Users');
    expect(users.size).toBe(160);
    expect(users.children.find((c) => c.name === 'me').size).toBe(150);
  });

  it('shows folders down to the depth asked and stops there, still counting what is below', () => {
    const tree = createLiveTree('C:', { depth: 2 });
    feed(tree);
    const me = tree.snapshot().children.find((c) => c.name === 'Users').children.find((c) => c.name === 'me');
    expect(me.size).toBe(150);
    expect(me.type).toBe('directory');
    expect(me.children).toBeUndefined();
  });

  it('lists files that sit in a folder it shows', () => {
    const live = createLiveTree('C:', { depth: 2 });
    feed(live);
    const tree = live.snapshot();
    expect(tree.children.find((c) => c.name === 'top.txt')).toMatchObject({ type: 'file', size: 5 });
    expect(tree.children.find((c) => c.name === 'Users').children.find((c) => c.name === 'z.bin')).toMatchObject({ type: 'file', size: 10 });
  });

  it('orders children largest first', () => {
    const live = createLiveTree('C:', { depth: 2 });
    feed(live);
    expect(live.snapshot().children.map((c) => c.name)).toEqual(['Windows', 'Users', 'top.txt']);
  });

  it('marks itself as a partial, unfinished picture', () => {
    const tree = createLiveTree('C:').snapshot();
    expect(tree).toMatchObject({ partial: true, truncated: true, type: 'directory', size: 0 });
  });

  it('keeps only the biggest children and folds the rest into one counted block, so totals still add up', () => {
    const live = createLiveTree('C:', { depth: 1, maxChildren: 3 });
    for (let i = 1; i <= 10; i++) live.add([`f${i}.bin`], i, 0);
    const tree = live.snapshot();
    expect(tree.children).toHaveLength(4);
    const block = tree.children.at(-1);
    expect(block).toMatchObject({ aggregated: true, count: 7, size: 1 + 2 + 3 + 4 + 5 + 6 + 7 });
    expect(tree.children.reduce((s, c) => s + c.size, 0)).toBe(tree.size);
  });

  it('ignores a path with nothing in it and a file of no size', () => {
    const live = createLiveTree('C:');
    live.add([], 5, 0);
    live.add(['empty.txt'], 0, 0);
    expect(live.snapshot().size).toBe(0);
    expect(live.snapshot().children).toEqual([]);
  });

  it('can be snapshotted repeatedly as it grows, without the earlier ones changing', () => {
    const live = createLiveTree('C:');
    live.add(['a.bin'], 10, 0);
    const first = live.snapshot();
    live.add(['b.bin'], 20, 0);
    expect(first.size).toBe(10);
    expect(live.snapshot().size).toBe(30);
  });
});
