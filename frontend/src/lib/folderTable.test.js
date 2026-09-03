import { describe, it, expect } from 'vitest';
import { folderTableRows } from './folderTable.js';

const tree = {
  name: 'C:', type: 'directory', size: 1000, fullPath: 'C:\\',
  children: [
    {
      name: 'Games', type: 'directory', size: 800, fullPath: 'C:\\Games', modified: 1788000000000,
      children: [
        { name: 'a.pak', type: 'file', size: 500 },
        {
          name: 'sub', type: 'directory', size: 300,
          children: [{ name: 'b.pak', type: 'file', size: 300 }]
        }
      ]
    },
    { name: 'note.txt', type: 'file', size: 200, fullPath: 'C:\\note.txt' }
  ]
};

describe('folderTableRows', () => {
  it('returns one row per direct child', () => {
    expect(folderTableRows(tree).map((r) => r.name)).toEqual(['Games', 'note.txt']);
  });

  it('counts everything beneath a folder, at any depth', () => {
    const games = folderTableRows(tree)[0];
    expect(games.files).toBe(2);
    expect(games.folders).toBe(1);
    expect(games.items).toBe(3);
  });

  it('reports a percentage of the parent, not of the drive', () => {
    // The question this column answers is "how much of what I am looking
    // at is this".
    const [games, note] = folderTableRows(tree);
    expect(games.percentOfParent).toBeCloseTo(80, 5);
    expect(note.percentOfParent).toBeCloseTo(20, 5);
  });

  it('carries the modified time and full path through', () => {
    const games = folderTableRows(tree)[0];
    expect(games.modified).toBe(1788000000000);
    expect(games.fullPath).toBe('C:\\Games');
  });

  it('treats a file as one item and no folder', () => {
    const note = folderTableRows(tree)[1];
    expect(note).toMatchObject({ items: 1, files: 1, folders: 0 });
  });

  // Zero is a measurement; null is the absence of one. A table reporting
  // "0 files" for somewhere nobody looked states something it does not
  // know -- the same distinction the cleaner rules draw between "nothing
  // to clean" and "we couldn't look".
  it('reports no counts at all for a folder the scan never opened', () => {
    const rows = folderTableRows({
      name: 'C:', type: 'directory', size: 900,
      children: [{ name: 'Users', type: 'directory', size: 900, scanned: false }]
    });
    expect(rows[0]).toMatchObject({ items: null, files: null, folders: null, scanned: false });
  });

  it('reports no counts for a directory past the scan depth', () => {
    // It has a real size but its contents were never enumerated, so there
    // is no children array to count.
    const rows = folderTableRows({
      name: 'C:', type: 'directory', size: 500,
      children: [{ name: 'Deep', type: 'directory', size: 500 }]
    });
    expect(rows[0].items).toBeNull();
    expect(rows[0].size).toBe(500);
  });

  it('does not count the unscanned remainder inside a folder', () => {
    const rows = folderTableRows({
      name: 'C:', type: 'directory', size: 1000,
      children: [{
        name: 'Mixed', type: 'directory', size: 1000,
        children: [
          { name: 'seen.txt', type: 'file', size: 100 },
          { name: 'Not scanned', type: 'directory', size: 900, scanned: false }
        ]
      }]
    });
    expect(rows[0]).toMatchObject({ files: 1, folders: 0, items: 1 });
  });

  it('survives a tree deep enough to blow a recursive walk', () => {
    let node = { name: 'deep.txt', type: 'file', size: 1 };
    for (let i = 0; i < 50000; i += 1) {
      node = { name: `d${i}`, type: 'directory', size: 1, children: [node] };
    }
    const rows = folderTableRows({ name: 'root', type: 'directory', size: 1, children: [node] });
    expect(rows[0].files).toBe(1);
    expect(rows[0].folders).toBe(49999);
  });

  it('copes with nothing to show', () => {
    expect(folderTableRows(null)).toEqual([]);
    expect(folderTableRows({ name: 'x', type: 'directory' })).toEqual([]);
    expect(folderTableRows({ name: 'x', type: 'directory', children: [] })).toEqual([]);
  });
});

describe('directories Windows would not let us open', () => {
  // The scanner returns an empty children array for these, exactly as it
  // does for a directory that really is empty. Without the flag the table
  // reported "0 items" for somewhere it could not look at all --
  // "Documents and Settings" is the everyday case.
  it('reports no counts rather than zero', () => {
    const rows = folderTableRows({
      name: 'C:', type: 'directory', size: 0,
      children: [{ name: 'Documents and Settings', type: 'directory', size: 0, readable: false, children: [] }]
    });
    expect(rows[0]).toMatchObject({ items: null, files: null, folders: null });
  });

  it('still reports zero for a folder that really is empty', () => {
    const rows = folderTableRows({
      name: 'C:', type: 'directory', size: 0,
      children: [{ name: 'Empty', type: 'directory', size: 0, children: [] }]
    });
    expect(rows[0]).toMatchObject({ items: 0, files: 0, folders: 0 });
  });

  it('counts an unreadable subfolder as a folder without claiming its contents', () => {
    const rows = folderTableRows({
      name: 'C:', type: 'directory', size: 100,
      children: [{
        name: 'Parent', type: 'directory', size: 100,
        children: [
          { name: 'a.txt', type: 'file', size: 100 },
          { name: 'Locked', type: 'directory', size: 0, readable: false, children: [] }
        ]
      }]
    });
    expect(rows[0]).toMatchObject({ files: 1, folders: 1, items: 2 });
  });
});
