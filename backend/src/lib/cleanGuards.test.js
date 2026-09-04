import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EXCLUDED,
  normalizePath,
  toExcludePattern,
  isExcluded,
  isTooRecent,
  partitionCleanableFiles
} from './cleanGuards.js';

describe('normalizePath', () => {
  it('lowercases, forward-slashes and wraps in separators', () => {
    expect(normalizePath('C:\\Windows\\Temp')).toBe('/c:/windows/temp/');
  });

  it('does not care about trailing or doubled separators', () => {
    expect(normalizePath('C:\\Games\\')).toBe(normalizePath('C:\\Games'));
  });

  it('is empty for nothing usable', () => {
    expect(normalizePath('')).toBe('');
    expect(normalizePath('   ')).toBe('');
    expect(normalizePath(null)).toBe('');
  });
});

describe('isExcluded', () => {
  it.each(DEFAULT_EXCLUDED.map((p) => [p]))('refuses anything under %s by default', (pattern) => {
    const folder = pattern.replace(/^\//, '').replace(/\/$/, '');
    expect(isExcluded(`C:\\${folder.replace(/\//g, '\\')}\\something.tmp`)).toBe(true);
  });

  it('protects a System Volume Information file no rule should reach', () => {
    expect(isExcluded('C:\\System Volume Information\\{guid}{guid}')).toBe(true);
  });

  it('protects an antivirus quarantine, which holds live samples', () => {
    expect(isExcluded('C:\\Program Files\\Norton\\Quarantine\\sample.vir')).toBe(true);
  });

  it('leaves an ordinary cache file alone', () => {
    expect(isExcluded('C:\\Users\\jim\\AppData\\Local\\Temp\\thing.tmp')).toBe(false);
    expect(isExcluded('C:\\Users\\jim\\AppData\\Local\\Brave\\Cache\\data_1')).toBe(false);
  });

  it('honours a folder the user added', () => {
    expect(isExcluded('C:\\Games\\save.dat', ['C:\\Games'])).toBe(true);
  });

  it('does not let a user folder match one that merely starts the same', () => {
    // "C:\Games" must not exclude "C:\GamesBackup", which is a different
    // folder that happens to share a prefix.
    expect(isExcluded('C:\\GamesBackup\\save.dat', ['C:\\Games'])).toBe(false);
  });

  it('matches a user folder however either side spelled the separators', () => {
    expect(isExcluded('C:/Games/sub/save.dat', ['C:\\Games\\'])).toBe(true);
  });

  it('adds the user list to the defaults rather than replacing them', () => {
    // Typing one folder into Settings is adding a rule, not removing
    // sixteen.
    expect(isExcluded('C:\\System Volume Information\\x', ['C:\\Games'])).toBe(true);
  });

  it('ignores a blank entry in the user list', () => {
    expect(isExcluded('C:\\Users\\jim\\AppData\\Local\\Temp\\x', ['', '   ', null])).toBe(false);
  });

  it('says no to a path it cannot read', () => {
    expect(isExcluded('')).toBe(false);
    expect(isExcluded(null)).toBe(false);
  });
});

describe('isTooRecent', () => {
  const now = Date.UTC(2026, 8, 4, 12, 0, 0);
  const hoursAgo = (h) => now - h * 60 * 60 * 1000;

  it('holds back a file written an hour ago', () => {
    // The temp folder is the one place where a file being written right
    // now looks exactly like one abandoned two years ago.
    expect(isTooRecent(hoursAgo(1), 24, now)).toBe(true);
  });

  it('releases a file older than the window', () => {
    expect(isTooRecent(hoursAgo(25), 24, now)).toBe(false);
  });

  it('treats 0 hours as the guard being off', () => {
    // Which is what a user who wants everything gone expects that number
    // to mean.
    expect(isTooRecent(hoursAgo(0.01), 0, now)).toBe(false);
  });

  it('does not hold back a file whose age is unknown', () => {
    expect(isTooRecent(null, 24, now)).toBe(false);
    expect(isTooRecent(0, 24, now)).toBe(false);
    expect(isTooRecent(undefined, 24, now)).toBe(false);
  });

  it('ignores a nonsense window', () => {
    expect(isTooRecent(hoursAgo(1), NaN, now)).toBe(false);
    expect(isTooRecent(hoursAgo(1), -5, now)).toBe(false);
  });
});

describe('partitionCleanableFiles', () => {
  const now = Date.UTC(2026, 8, 4, 12, 0, 0);
  const old = now - 100 * 60 * 60 * 1000;

  it('lets ordinary junk through', () => {
    const { cleanable, held } = partitionCleanableFiles(
      [{ path: 'C:\\Temp\\a.tmp', mtimeMs: old }],
      { skipRecentHours: 24, now }
    );
    expect(cleanable).toHaveLength(1);
    expect(held).toEqual([]);
  });

  it('gives a reason for everything it holds back', () => {
    // "Cleaned 4 files" when the user could see six is the small
    // dishonesty that makes people stop trusting a number.
    const { cleanable, held } = partitionCleanableFiles(
      [
        { path: 'C:\\Temp\\old.tmp', mtimeMs: old },
        { path: 'C:\\Temp\\fresh.tmp', mtimeMs: now - 60_000 },
        { path: 'C:\\Games\\save.dat', mtimeMs: old }
      ],
      { excludeFolders: ['C:\\Games'], skipRecentHours: 24, now }
    );

    expect(cleanable.map((f) => f.path)).toEqual(['C:\\Temp\\old.tmp']);
    expect(held).toEqual([
      { path: 'C:\\Temp\\fresh.tmp', reason: 'modified in the last 24 hours' },
      { path: 'C:\\Games\\save.dat', reason: 'in an excluded folder' }
    ]);
  });

  it('reports an exclusion ahead of an age, because it is the stronger reason', () => {
    // A file can be both. The exclusion is a standing instruction and the
    // age is a timing accident, so the exclusion is what to tell the user.
    const { held } = partitionCleanableFiles(
      [{ path: 'C:\\Games\\fresh.dat', mtimeMs: now - 60_000 }],
      { excludeFolders: ['C:\\Games'], skipRecentHours: 24, now }
    );
    expect(held[0].reason).toBe('in an excluded folder');
  });

  it('holds nothing back when both guards are off', () => {
    const { cleanable, held } = partitionCleanableFiles(
      [{ path: 'C:\\Temp\\fresh.tmp', mtimeMs: now - 60_000 }],
      { excludeFolders: [], skipRecentHours: 0, now }
    );
    expect(cleanable).toHaveLength(1);
    expect(held).toEqual([]);
  });

  it('still protects the defaults when the caller passes no options at all', () => {
    const { cleanable, held } = partitionCleanableFiles([
      { path: 'C:\\System Volume Information\\x', mtimeMs: old }
    ]);
    expect(cleanable).toEqual([]);
    expect(held).toHaveLength(1);
  });

  it('copes with no list', () => {
    expect(partitionCleanableFiles(null)).toEqual({ cleanable: [], held: [] });
  });
});

describe('toExcludePattern', () => {
  it('is null for nothing usable, so a blank entry cannot match everything', () => {
    expect(toExcludePattern('')).toBeNull();
    expect(toExcludePattern(null)).toBeNull();
  });
});
