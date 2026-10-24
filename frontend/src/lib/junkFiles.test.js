import { describe, it, expect } from 'vitest';
import {
  groupJunkFiles, preselectedPaths, selectionSummary, groupTickState, skippedParts,
  driveRoot, addFolder, patternDescriptionKey
} from './junkFiles.js';

const PATTERNS = [
  { pattern: '*.tmp', enabled: true, preselected: true },
  { pattern: '~*.*', enabled: true, preselected: false },
  { pattern: '*.old', enabled: true, preselected: false }
];
const file = (path, sizeBytes, pattern) => ({ path, sizeBytes, mtimeMs: 1, pattern });

describe('groupJunkFiles', () => {
  it('groups in the pattern list order, biggest file first, with totals, leaving empty groups out', () => {
    const groups = groupJunkFiles([
      file('C:\\a.old', 5, '*.old'),
      file('C:\\small.tmp', 1, '*.tmp'),
      file('C:\\big.tmp', 9, '*.tmp')
    ], PATTERNS);
    expect(groups.map((g) => g.pattern)).toEqual(['*.tmp', '*.old']);
    expect(groups[0].files.map((f) => f.path)).toEqual(['C:\\big.tmp', 'C:\\small.tmp']);
    expect(groups[0]).toMatchObject({ totalBytes: 10, preselected: true });
    expect(groups[1]).toMatchObject({ totalBytes: 5, preselected: false });
  });

  it('keeps a file whose pattern it was not told about, in a group of its own', () => {
    const groups = groupJunkFiles([file('C:\\x.zz', 1, '*.zz')], PATTERNS);
    expect(groups).toEqual([{ pattern: '*.zz', preselected: false, files: [file('C:\\x.zz', 1, '*.zz')], totalBytes: 1 }]);
  });
});

describe('preselectedPaths', () => {
  it('ticks only files found by a pattern marked preselected', () => {
    expect(preselectedPaths([
      file('C:\\a.tmp', 1, '*.tmp'), file('C:\\~$b.docx', 1, '~*.*'), file('C:\\c.old', 1, '*.old')
    ], PATTERNS)).toEqual(['C:\\a.tmp']);
  });
});

describe('selectionSummary and groupTickState', () => {
  const files = [file('C:\\a.tmp', 3, '*.tmp'), file('C:\\b.tmp', 4, '*.tmp')];
  it('counts only ticked files that are still listed', () => {
    expect(selectionSummary(files, new Set(['C:\\a.tmp', 'C:\\gone.tmp']))).toEqual({ count: 1, bytes: 3 });
  });
  it('says none, some or all of a group is ticked', () => {
    const [group] = groupJunkFiles(files, PATTERNS);
    expect(groupTickState(group, new Set())).toBe('none');
    expect(groupTickState(group, new Set(['C:\\a.tmp']))).toBe('some');
    expect(groupTickState(group, new Set(['C:\\a.tmp', 'C:\\b.tmp']))).toBe('all');
  });
});

describe('skippedParts', () => {
  it('names only what happened, in a fixed order, leaving folder counts out', () => {
    expect(skippedParts({ executable: 2, recent: 5, protected: 0, excluded: 1, protectedFolders: 9 })).toEqual([
      { kind: 'recent', count: 5 }, { kind: 'excluded', count: 1 }, { kind: 'executable', count: 2 }
    ]);
    expect(skippedParts(undefined)).toEqual([]);
  });
});

describe('roots', () => {
  it('writes a drive letter as its root', () => {
    expect(driveRoot('c')).toBe('C:\\');
    expect(driveRoot('D:')).toBe('D:\\');
  });

  it('adds a folder tidied, once, ignoring case and quotes', () => {
    let folders = addFolder([], '  "D:/Downloads/"  ');
    expect(folders).toEqual(['D:\\Downloads']);
    folders = addFolder(folders, 'd:\\downloads');
    expect(folders).toEqual(['D:\\Downloads']);
    expect(addFolder(folders, '   ')).toBe(folders);
  });
});

describe('patternDescriptionKey', () => {
  it('names the built-in patterns, in any case, and nothing else', () => {
    expect(patternDescriptionKey('*.TMP')).toBe('tmp');
    expect(patternDescriptionKey('Thumbs.db')).toBe('thumbs');
    expect(patternDescriptionKey('~*.*')).toBe('tilde');
    expect(patternDescriptionKey('*.mine')).toBeNull();
  });
});
