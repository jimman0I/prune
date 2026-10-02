import { describe, it, expect } from 'vitest';
import { createExclusionMatcher, isExcludedEntry } from './diskExclusions.js';

describe('createExclusionMatcher', () => {
  it('is null when nothing is excluded, so callers can skip the work', () => {
    expect(createExclusionMatcher(null)).toBeNull();
    expect(createExclusionMatcher({})).toBeNull();
    expect(createExclusionMatcher({ excludeFolders: [], excludeExtensions: [] })).toBeNull();
  });

  it('matches a folder and everything under it, case-insensitively', () => {
    const match = createExclusionMatcher({ excludeFolders: ['C:\\Games'] });
    expect(match('C:\\Games')).toBe(true);
    expect(match('c:\\games\\Steam\\x.pak')).toBe(true);
  });

  it('does not match a folder that merely starts with the same letters', () => {
    const match = createExclusionMatcher({ excludeFolders: ['C:\\Games'] });
    expect(match('C:\\GamesBackup')).toBe(false);
    expect(match('C:\\GamesBackup\\a.bin')).toBe(false);
  });

  it('matches files of an excluded type by their last extension', () => {
    const match = createExclusionMatcher({ excludeExtensions: ['.iso'] });
    expect(match('D:\\x\\win.ISO')).toBe(true);
    expect(match('D:\\x\\win.iso.tmp')).toBe(false);
  });

  it('is the same answer the one-shot form gives', () => {
    const ex = { excludeFolders: ['C:\\Keep'], excludeExtensions: ['.vhdx'] };
    for (const p of ['C:\\Keep\\a', 'C:\\Other\\b.vhdx', 'C:\\Other\\c.txt']) {
      expect(isExcludedEntry(p, ex)).toBe(createExclusionMatcher(ex)(p));
    }
    expect(isExcludedEntry('C:\\x', null)).toBe(false);
  });
});
