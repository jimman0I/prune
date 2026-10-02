import { describe, it, expect } from 'vitest';
import { compactTree, expandArchive } from './compactTree.js';

const tree = {
  name: 'C:', type: 'directory', size: 1000, allocated: 1100, modified: 1788000000000, fullPath: 'C:\\',
  children: [
    {
      name: 'Games', type: 'directory', size: 800, allocated: 850, modified: 1788000001000, fullPath: 'C:\\Games',
      children: [
        { name: 'a.pak', type: 'file', size: 500, allocated: 512, modified: 1788000002000, fullPath: 'C:\\Games\\a.pak' },
        { name: 'b.pak', type: 'file', size: 100, fullPath: 'C:\\Games\\b.pak' },
        { name: 'sub', type: 'directory', size: 200, fullPath: 'C:\\Games\\sub', children: [
          { name: 'c.pak', type: 'file', size: 200, fullPath: 'C:\\Games\\sub\\c.pak' }
        ] }
      ]
    },
    { name: 'note.txt', type: 'file', size: 200, fullPath: 'C:\\note.txt' },
    { name: 'Capped', type: 'directory', size: 50, fullPath: 'C:\\Capped' },
    { name: 'Not scanned', type: 'directory', size: 999999, scanned: false, unscannedRemainder: true }
  ]
};

describe('compactTree', () => {
  const archive = compactTree(tree, { topFiles: 2 });

  it('keeps folders only, with sizes, allocation and dates under short keys', () => {
    expect(archive.v).toBe(1);
    expect(archive.root.n).toBe('C:');
    expect(archive.root.s).toBe(1000);
    expect(archive.root.a).toBe(1100);
    expect(archive.root.m).toBe(1788000000000);
    const games = archive.root.c.find((n) => n.n === 'Games');
    expect(games).toMatchObject({ s: 800, a: 850 });
    expect(games.c.map((n) => n.n)).toEqual(['sub']);
  });

  it('counts the files and folders below each folder', () => {
    expect(archive.root.f).toBe(4); // a, b, c, note
    expect(archive.root.d).toBe(3); // Games, sub, Capped
    const games = archive.root.c.find((n) => n.n === 'Games');
    expect(games.f).toBe(3);
    expect(games.d).toBe(1);
  });

  it('records the files directly in a folder and their bytes, for the part the list leaves out', () => {
    const games = archive.root.c.find((n) => n.n === 'Games');
    expect(games.fc).toBe(2);
    expect(games.fb).toBe(600);
    expect(archive.root.fc).toBe(1);
    expect(archive.root.fb).toBe(200);
  });

  it('keeps the biggest files, with their full paths', () => {
    expect(archive.top.map((f) => f.p)).toEqual(['C:\\Games\\a.pak', 'C:\\Games\\sub\\c.pak']);
    expect(archive.top[0]).toEqual({ p: 'C:\\Games\\a.pak', s: 500, a: 512, m: 1788000002000 });
  });

  it('leaves out the counts of a folder past the depth cap rather than claiming zero', () => {
    const capped = archive.root.c.find((n) => n.n === 'Capped');
    expect(capped.s).toBe(50);
    expect('f' in capped).toBe(false);
  });

  it('leaves out the block standing for space the scan never reached', () => {
    expect(archive.root.c.some((n) => /not scanned/i.test(n.n))).toBe(false);
  });

  it('is far smaller than the tree it came from', () => {
    const many = { name: 'D:', type: 'directory', size: 0, fullPath: 'D:\\', children: [{ name: 'x', type: 'directory', size: 0, fullPath: 'D:\\x', children:
      Array.from({ length: 5000 }, (_, i) => ({ name: `f${i}.bin`, type: 'file', size: i + 1, fullPath: `D:\\x\\f${i}.bin` })) }] };
    const out = compactTree(many, { topFiles: 10 });
    expect(out.top).toHaveLength(10);
    expect(JSON.stringify(out).length).toBeLessThan(JSON.stringify(many).length / 20);
  });

  it('passes the archive through the backend\'s own validator', async () => {
    // Same module the server uses, so the two cannot drift apart.
    const { normalizeArchive } = await import('../../../backend/src/lib/scanArchive.js');
    expect(normalizeArchive(archive).ok).toBe(true);
  });
});

describe('expandArchive', () => {
  const archive = compactTree(tree, { topFiles: 2 });
  const expanded = expandArchive(archive, { rootPath: 'C:\\', aggregateLabel: (n) => `${n} smaller items` });
  const find = (node, name) => node.children.find((c) => c.name === name);

  it('rebuilds a tree the Disk Map can browse, with full paths', () => {
    expect(expanded.name).toBe('C:');
    expect(expanded.fullPath).toBe('C:\\');
    expect(find(expanded, 'Games').fullPath).toBe('C:\\Games');
    expect(find(find(expanded, 'Games'), 'sub').fullPath).toBe('C:\\Games\\sub');
  });

  it('puts the saved big files back where they were', () => {
    const a = find(find(expanded, 'Games'), 'a.pak');
    expect(a).toMatchObject({ type: 'file', size: 500, allocated: 512, fullPath: 'C:\\Games\\a.pak' });
  });

  it('stands in for the files it did not keep with one labelled block, so folder sizes still add up', () => {
    const games = find(expanded, 'Games');
    const block = games.children.find((c) => c.aggregated);
    // Games holds a.pak (kept) and b.pak (not kept): b's 100 bytes, 1 file.
    expect(block).toMatchObject({ size: 100, type: 'file', aggregated: true, name: '1 smaller items' });
    const sum = games.children.reduce((s, c) => s + c.size, 0);
    expect(sum).toBe(games.size);
  });

  it('carries the counts so the table does not report zero files for a folder it only summarised', () => {
    expect(find(expanded, 'Games').counts).toEqual({ files: 3, folders: 1 });
  });

  it('does not invent a children list for a folder past the depth cap', () => {
    expect(find(expanded, 'Capped').children).toBeUndefined();
  });

  it('marks nothing as scanned-false: it is the saved picture, not a partial one', () => {
    expect(find(expanded, 'Games').scanned).not.toBe(false);
  });
});
