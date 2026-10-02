import { describe, it, expect } from 'vitest';
import { driveLetterOf, rootOfDrive, driveUsage, drivesFromScan } from './driveRoot.js';

describe('driveLetterOf', () => {
  it('reads the letter from a drive root or a path under it, in either case', () => {
    expect(driveLetterOf('C:\\')).toBe('C');
    expect(driveLetterOf('d:')).toBe('D');
    expect(driveLetterOf('E:/Games/x')).toBe('E');
    expect(driveLetterOf('C:\\Users\\me')).toBe('C');
  });

  it('is null for anything that is not a drive path', () => {
    expect(driveLetterOf('\\\\server\\share')).toBeNull();
    expect(driveLetterOf('')).toBeNull();
    expect(driveLetterOf(undefined)).toBeNull();
    expect(driveLetterOf('relative\\path')).toBeNull();
  });
});

describe('rootOfDrive', () => {
  it('is the letter with a colon and a backslash', () => {
    expect(rootOfDrive('c')).toBe('C:\\');
    expect(rootOfDrive('D')).toBe('D:\\');
  });
});

describe('driveUsage', () => {
  it('derives the used bytes and percentage from total and free', () => {
    expect(driveUsage({ totalBytes: 1000, freeBytes: 250 })).toEqual({ usedBytes: 750, percent: 75 });
  });

  it('is null rather than invented when free space is unknown', () => {
    expect(driveUsage({ totalBytes: 1000, freeBytes: null })).toBeNull();
    expect(driveUsage({ totalBytes: 0, freeBytes: 0 })).toBeNull();
    expect(driveUsage(null)).toBeNull();
  });
});

describe('drivesFromScan', () => {
  const tree = (name) => ({ name, size: 1, type: 'directory', children: [] });

  it('reads the per-drive list of a multi-drive scan, and reports failures separately', () => {
    const result = {
      drives: [
        { driveLetter: 'C', tree: tree('C:'), stats: { recordsRead: 9 } },
        { driveLetter: 'E', error: 'Not an NTFS volume' }
      ]
    };
    const out = drivesFromScan(result, ['C', 'E']);
    expect(out.scanned).toEqual([{ letter: 'C', tree: tree('C:'), stats: { recordsRead: 9 } }]);
    expect(out.failures).toEqual([{ letter: 'E', error: 'Not an NTFS volume' }]);
  });

  it('still reads the single-drive shape an older backend returns', () => {
    const out = drivesFromScan({ tree: tree('D:'), stats: { recordsRead: 2 }, driveLetter: 'D' }, ['D']);
    expect(out.scanned).toEqual([{ letter: 'D', tree: tree('D:'), stats: { recordsRead: 2 } }]);
    expect(out.failures).toEqual([]);
  });

  it('treats a requested drive that the reply never mentions as a failure, not as scanned', () => {
    const out = drivesFromScan({ drives: [{ driveLetter: 'C', tree: tree('C:') }] }, ['C', 'D']);
    expect(out.scanned.map((d) => d.letter)).toEqual(['C']);
    expect(out.failures.map((f) => f.letter)).toEqual(['D']);
  });

  it('gives a drive with no stats an empty stats object', () => {
    const out = drivesFromScan({ drives: [{ driveLetter: 'C', tree: tree('C:') }] }, ['C']);
    expect(out.scanned[0].stats).toEqual({});
  });
});
