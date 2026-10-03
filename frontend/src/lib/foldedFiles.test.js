import { describe, it, expect, vi } from 'vitest';
import { attachFullPaths } from './diskMapTree.js';
import { extensionBreakdown, NO_EXTENSION } from './extensionBreakdown.js';
import { folderTableRows } from './folderTable.js';
import { localizeUnscanned } from './unscannedRemainder.js';
import { compactTree } from './compactTree.js';
import { largestFiles } from './largestFiles.js';
import { isScanTooLarge, SCAN_TOO_LARGE } from './scanTooLarge.js';
import { drivesFromScan } from './driveRoot.js';
import { scanDriveFast } from './api.js';

/** What a fast scan of a big drive sends: the largest files of a folder as
 * nodes, the rest as one `folded` block on the folder, and the drive's own
 * table of every folded file by type. (backend/src/lib/foldFiles.js) */
function scanned() {
  return {
    name: 'C:', size: 1000, type: 'directory',
    foldedExts: { '.dll': [300, 30], '': [20, 4], '.log': [80, 8] },
    children: [
      {
        name: 'Big', size: 900, type: 'directory',
        folded: { count: 40, size: 380, allocated: 400, exts: { '.dll': [280, 28], '.log': [80, 8], '': [20, 4] } },
        children: [
          { name: 'huge.pak', size: 500, type: 'file' },
          { name: 'tiny.bin', size: 20, type: 'file' }
        ]
      },
      {
        name: 'Other', size: 100, type: 'directory',
        folded: { count: 4, size: 22, exts: undefined },
        children: [{ name: 'a.dll', size: 78, type: 'file' }]
      }
    ]
  };
}

describe('a folded block becomes an ordinary "smaller files" row', () => {
  it('is placed among its siblings by size, with a count and no path', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const big = tree.children.find((c) => c.name === 'Big');
    expect(big.folded).toBeUndefined();
    expect(big.children.map((c) => c.size)).toEqual([500, 380, 20]);
    const row = big.children[1];
    expect(row).toMatchObject({ aggregated: true, type: 'file', count: 40, size: 380, allocated: 400 });
    expect(row.fullPath).toBeUndefined();
    expect(row.name).toBe('(40 smaller files)');
    // The files that stayed keep their paths.
    expect(big.children[0].fullPath).toBe('C:\\Big\\huge.pak');
  });

  it('is renamed in the language in view, on the children in view only', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const big = tree.children.find((c) => c.name === 'Big');
    const shown = localizeUnscanned(big, 'Not scanned', (n) => `${n} smaller items`);
    expect(shown.children.find((c) => c.aggregated).name).toBe('40 smaller items');
    // Without a folded label, or with nothing to rename, it is the very same object.
    expect(localizeUnscanned(big, 'x')).toBe(big);
    const plain = { name: 'p', children: [{ name: 'a', type: 'file', size: 1 }] };
    expect(localizeUnscanned(plain, 'x', (n) => `${n}`)).toBe(plain);
  });
});

describe('the file-type breakdown over a folded scan', () => {
  it('is exact for the whole drive: every folded file is in the root\'s table', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const result = extensionBreakdown(tree);
    const by = Object.fromEntries(result.rows.map((r) => [r.extension, r]));
    // Kept: huge.pak 500, tiny.bin 20, a.dll 78; folded: dll 300/30, none 20/4, log 80/8.
    expect(by['.pak'].sizeBytes).toBe(500);
    expect(by['.dll']).toMatchObject({ sizeBytes: 378, fileCount: 31 });
    expect(by['.bin'].sizeBytes).toBe(20);
    expect(by['.log']).toMatchObject({ sizeBytes: 80, fileCount: 8 });
    expect(by[NO_EXTENSION]).toMatchObject({ sizeBytes: 20, fileCount: 4 });
    expect(result.totalBytes).toBe(998);
    expect(result.totalFiles).toBe(3 + 30 + 4 + 8);
    // The folded block of a folder is not counted a second time.
    expect(result.rows.reduce((s, r) => s + r.sizeBytes, 0)).toBe(result.totalBytes);
  });

  it('is exact inside a folder too, from the types its own block carries', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const big = tree.children.find((c) => c.name === 'Big');
    const by = Object.fromEntries(extensionBreakdown(big).rows.map((r) => [r.extension, r]));
    expect(by['.dll']).toMatchObject({ sizeBytes: 280, fileCount: 28 });
    expect(by['.pak'].sizeBytes).toBe(500);
    expect(extensionBreakdown(big).uncategorizedBytes).toBe(0);
  });

  it('puts a small folder\'s folded bytes under "not categorised" rather than inventing a type', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const other = tree.children.find((c) => c.name === 'Other');
    const result = extensionBreakdown(other);
    expect(result.totalBytes).toBe(78);
    expect(result.uncategorizedBytes).toBe(22);
  });
});

describe('counts and lists over a folded scan', () => {
  it('counts the files a block folded, in a folder and in the rows above it', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const rows = folderTableRows(tree);
    const big = rows.find((r) => r.name === 'Big');
    expect(big).toMatchObject({ files: 42, folders: 0, items: 42 });
    const bigRows = folderTableRows(tree.children.find((c) => c.name === 'Big'));
    expect(bigRows.find((r) => r.aggregated)).toMatchObject({ files: 40, items: 40, size: 380 });
  });

  it('keeps the largest-files list exact: a block is never listed and the big files are all there', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const files = largestFiles(tree, { limit: 10 });
    expect(files.map((f) => f.name)).toEqual(['huge.pak', 'a.dll', 'tiny.bin']);
  });

  it('is saved as the folder\'s own file count and bytes, so a reopened scan still adds up', () => {
    const tree = attachFullPaths(scanned(), 'C:\\');
    const archive = compactTree(tree, { rootName: 'C:' });
    const big = archive.root.c.find((c) => c.n === 'Big');
    expect(big.fc).toBe(42);
    expect(big.fb).toBe(500 + 20 + 380);
    expect(archive.root.f).toBe(42 + 5);
  });
});

describe('a drive too large for one scan', () => {
  it('is recognised from the backend\'s code and from the browser\'s own wording', () => {
    expect(isScanTooLarge(SCAN_TOO_LARGE)).toBe(true);
    expect(isScanTooLarge(Object.assign(new Error('x'), { code: SCAN_TOO_LARGE }))).toBe(true);
    expect(isScanTooLarge(new RangeError('Invalid string length'))).toBe(true);
    expect(isScanTooLarge(new Error('JavaScript heap out of memory'))).toBe(true);
    expect(isScanTooLarge(new Error('Not an NTFS volume'))).toBe(false);
    expect(isScanTooLarge(null)).toBe(false);
  });

  it('keeps the code on a drive that failed, beside the drives that worked', () => {
    const { scanned: ok, failures } = drivesFromScan({
      drives: [{ driveLetter: 'C', tree: { name: 'C:' }, stats: {} }, { driveLetter: 'D', error: 'too big', code: SCAN_TOO_LARGE }]
    });
    expect(ok).toHaveLength(1);
    expect(failures).toEqual([{ letter: 'D', error: 'too big', code: SCAN_TOO_LARGE }]);
  });

  it('turns a reply too big to read into an error carrying the code', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => { throw new RangeError('Invalid string length'); } });
    await expect(scanDriveFast('C')).rejects.toMatchObject({ code: SCAN_TOO_LARGE });
  });

  it('keeps the code the backend put on a failed reply', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'more files than Prune could hold', code: SCAN_TOO_LARGE }) });
    await expect(scanDriveFast('C')).rejects.toMatchObject({ code: SCAN_TOO_LARGE, message: 'more files than Prune could hold' });
  });
});
