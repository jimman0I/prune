import { describe, it, expect } from 'vitest';
import { buildTree, ROOT_RECORD } from './buildTree.js';

/** [recordNumber, name, parentRecord, sizeBytes, isDirectory] */
function entries(rows) {
  const map = new Map();
  for (const [record, name, parentRecord, sizeBytes, isDirectory] of rows) {
    map.set(record, { name, parentRecord, sizeBytes, isDirectory });
  }
  return map;
}

describe('buildTree', () => {
  it('nests files under their directories and sums sizes upward', () => {
    const tree = buildTree(entries([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true],
      [10, 'Games', ROOT_RECORD, 0, true],
      [11, 'save.dat', 10, 500, false],
      [12, 'art', 10, 0, true],
      [13, 'texture.png', 12, 1500, false]
    ]), { name: 'C:' });

    expect(tree.name).toBe('C:');
    expect(tree.size).toBe(2000);
    const games = tree.children.find((c) => c.name === 'Games');
    expect(games.size).toBe(2000);
    expect(games.children.find((c) => c.name === 'art').size).toBe(1500);
  });

  it('sorts children largest first, the way a treemap wants them', () => {
    const tree = buildTree(entries([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true],
      [10, 'small.bin', ROOT_RECORD, 1, false],
      [11, 'huge.bin', ROOT_RECORD, 900, false],
      [12, 'mid.bin', ROOT_RECORD, 50, false]
    ]), { name: 'C:' });
    expect(tree.children.map((c) => c.name)).toEqual(['huge.bin', 'mid.bin', 'small.bin']);
  });

  it('marks files and directories distinctly', () => {
    const tree = buildTree(entries([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true],
      [10, 'folder', ROOT_RECORD, 0, true],
      [11, 'file.txt', ROOT_RECORD, 5, false]
    ]), { name: 'C:' });
    expect(tree.children.find((c) => c.name === 'folder').type).toBe('directory');
    expect(tree.children.find((c) => c.name === 'file.txt').type).toBe('file');
  });

  // The root's own record names itself "." and is its own parent. Left
  // alone it becomes an infinitely nested child of itself.
  it('does not nest the root inside itself', () => {
    const tree = buildTree(entries([[ROOT_RECORD, '.', ROOT_RECORD, 0, true]]), { name: 'C:' });
    expect(tree.children).toEqual([]);
  });

  // A record whose parent is missing is normal on a live volume: the MFT
  // is read over several seconds while files are being created and
  // deleted. Dropping such an entry silently loses its bytes from the
  // total, so the drive appears emptier than it is.
  it('keeps an orphan\'s bytes in the total instead of losing them', () => {
    const tree = buildTree(entries([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true],
      [10, 'normal.bin', ROOT_RECORD, 100, false],
      [11, 'orphan.bin', 9999, 250, false]
    ]), { name: 'C:' });
    expect(tree.size).toBe(350);
    const unknown = tree.children.find((c) => /unknown|orphan/i.test(c.name));
    expect(unknown).toBeDefined();
    expect(unknown.size).toBe(250);
  });

  // Real MFTs can contain a parent cycle after corruption. A naive
  // recursive walk hangs forever; the scan must terminate.
  it('terminates on a parent cycle rather than recursing forever', () => {
    // a's parent is b and b's parent is a, so neither reaches the root.
    // A naive walk either hangs or blows the stack; the test passing at
    // all is the real assertion, and vitest's timeout enforces it.
    const tree = buildTree(entries([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true],
      [10, 'a', 11, 0, true],
      [11, 'b', 10, 0, true],
      [12, 'in-a.bin', 10, 7, false],
      [13, 'rooted.bin', ROOT_RECORD, 3, false]
    ]), { name: 'C:' });

    // Serializing proves the structure is finite, not self-referential.
    expect(() => JSON.stringify(tree)).not.toThrow();
    // The cycle's bytes are still accounted for somewhere in the total.
    expect(tree.size).toBe(10);
  }, 5000);

  it('caps the depth of the returned tree while keeping deep sizes in the totals', () => {
    const rows = [[ROOT_RECORD, '.', ROOT_RECORD, 0, true]];
    let parent = ROOT_RECORD;
    for (let i = 0; i < 8; i++) {
      rows.push([100 + i, `level${i}`, parent, 0, true]);
      parent = 100 + i;
    }
    rows.push([200, 'deep.bin', parent, 4096, false]);

    const tree = buildTree(entries(rows), { name: 'C:', maxDepth: 3 });
    expect(tree.size).toBe(4096); // the deep file still counts

    let node = tree, depth = 0;
    while (node.children?.length) { node = node.children[0]; depth++; }
    expect(depth).toBeLessThanOrEqual(3);
    // A capped directory keeps its type so the UI can still offer to open it.
    expect(node.type).toBe('directory');
    expect(node.children).toBeUndefined();
  });

  it('returns an empty tree for an empty MFT rather than throwing', () => {
    const tree = buildTree(new Map(), { name: 'C:' });
    expect(tree).toEqual({ name: 'C:', size: 0, type: 'directory', children: [] });
  });
});

describe('buildTree allocated size', () => {
  const withAlloc = (rows) => {
    const map = new Map();
    for (const [record, name, parentRecord, sizeBytes, isDirectory, allocatedBytes, extra] of rows) {
      map.set(record, { name, parentRecord, sizeBytes, isDirectory, allocatedBytes, ...extra });
    }
    return map;
  };

  it('sums allocated size upward beside the logical size', () => {
    const tree = buildTree(withAlloc([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true, 0],
      [10, 'Games', ROOT_RECORD, 0, true, 4096],
      [11, 'save.dat', 10, 500, false, 4096],
      [12, 'mod.bin', 10, 9000, false, 12288]
    ]), { name: 'C:' });
    const games = tree.children[0];
    expect(games.size).toBe(9500);
    expect(games.allocated).toBe(4096 + 4096 + 12288);
    expect(tree.allocated).toBe(games.allocated);
  });

  it('keeps a stray\'s allocation in the total as well as its size', () => {
    const tree = buildTree(withAlloc([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true, 0],
      [11, 'orphan.bin', 9999, 250, false, 4096]
    ]), { name: 'C:' });
    expect(tree.size).toBe(250);
    expect(tree.allocated).toBe(4096);
  });

  it('leaves out a file\'s allocation when it has none, and notes extra hard-link names', () => {
    const tree = buildTree(withAlloc([
      [ROOT_RECORD, '.', ROOT_RECORD, 0, true, 0],
      [10, 'tiny.txt', ROOT_RECORD, 12, false, 0],
      [11, 'linked.dll', ROOT_RECORD, 8000, false, 8192, { hardLinks: 3 }]
    ]), { name: 'C:' });
    const tiny = tree.children.find((n) => n.name === 'tiny.txt');
    const linked = tree.children.find((n) => n.name === 'linked.dll');
    expect('allocated' in tiny).toBe(false);
    expect(linked.allocated).toBe(8192);
    expect(linked.links).toBe(3);
  });

  it('gives a tree built without allocation data no allocated field at all', () => {
    const tree = buildTree(entries([[ROOT_RECORD, '.', ROOT_RECORD, 0, true], [10, 'a', ROOT_RECORD, 5, false]]), { name: 'C:' });
    expect(tree.allocated).toBeUndefined();
  });
});


describe('buildTree exclusions', () => {
  const rows = () => entries([
    [ROOT_RECORD, '.', ROOT_RECORD, 0, true],
    [10, 'Games', ROOT_RECORD, 0, true],
    [11, 'pak0.ucas', 10, 800, false],
    [12, 'sub', 10, 0, true],
    [13, 'pak1.ucas', 12, 100, false],
    [14, 'Users', ROOT_RECORD, 0, true],
    [15, 'win.iso', 14, 300, false],
    [16, 'notes.txt', 14, 5, false]
  ]);

  it('marks an excluded folder and counts nothing from it, at any depth', () => {
    const tree = buildTree(rows(), { name: 'C:', exclusions: { excludeFolders: ['C:\\Games'] } });
    const games = tree.children.find((n) => n.name === 'Games');
    expect(games).toEqual({ name: 'Games', size: 0, type: 'directory', excluded: true, children: [] });
    expect(tree.size).toBe(305);
  });

  it("does not let an excluded folder's contents resurface in the orphan sweep", () => {
    const tree = buildTree(rows(), { name: 'C:', exclusions: { excludeFolders: ['C:\\Games'] } });
    expect(tree.children.find((n) => /orphan/i.test(n.name))).toBeUndefined();
    expect(JSON.stringify(tree)).not.toContain('pak1.ucas');
  });

  it('leaves out files of an excluded type but keeps their siblings', () => {
    const tree = buildTree(rows(), { name: 'C:', exclusions: { excludeExtensions: ['.iso'] } });
    const users = tree.children.find((n) => n.name === 'Users');
    expect(users.size).toBe(5);
    expect(users.children.find((n) => n.name === 'win.iso')).toEqual({ name: 'win.iso', size: 0, type: 'file', excluded: true });
    expect(users.children.find((n) => n.name === 'notes.txt').size).toBe(5);
  });

  it('reports what was left out, so the totals stay honest', () => {
    const report = {};
    buildTree(rows(), { name: 'C:', exclusions: { excludeFolders: ['C:\\Games'], excludeExtensions: ['.iso'] }, report });
    expect(report.excludedSizeBytes).toBe(800 + 100 + 300);
    expect(report.excludedItems).toBe(5); // Games, pak0, sub, pak1 and win.iso
  });

  it('behaves exactly as before with no exclusions', () => {
    const plain = buildTree(rows(), { name: 'C:' });
    const none = buildTree(rows(), { name: 'C:', exclusions: { excludeFolders: [], excludeExtensions: [] } });
    expect(none).toEqual(plain);
    expect(plain.size).toBe(1205);
  });
});
