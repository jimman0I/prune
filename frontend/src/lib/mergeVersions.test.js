import { describe, it, expect } from 'vitest';
import { mergeBinaryVersions } from './mergeVersions.js';

const programs = [
  { id: 'a', name: 'Declared', version: '4.2.1' },
  { id: 'b', name: 'Warframe', version: '' },
  { id: 'c', name: 'Marvel Rivals', version: '' }
];

describe('mergeBinaryVersions', () => {
  it('fills a blank version from the binary', () => {
    const merged = mergeBinaryVersions(programs, { b: '2026.08.19.11.06' });
    expect(merged[1].version).toBe('2026.08.19.11.06');
    expect(merged[1].versionFromBinary).toBe(true);
  });

  it('never overwrites what the registry already reported', () => {
    // That string is the vendor's own statement about their program. A
    // binary in the folder can legitimately disagree, and replacing a
    // figure the user has already read is a change nobody asked for.
    const merged = mergeBinaryVersions(programs, { a: '9.9.9' });
    expect(merged[0].version).toBe('4.2.1');
    expect(merged[0].versionFromBinary).toBeUndefined();
  });

  it('leaves a program with no version found alone', () => {
    const merged = mergeBinaryVersions(programs, { b: '1.2.3' });
    expect(merged[2].version).toBe('');
    expect(merged[2].versionFromBinary).toBeUndefined();
  });

  it('returns the same array when there is nothing to merge', () => {
    expect(mergeBinaryVersions(programs, {})).toBe(programs);
    expect(mergeBinaryVersions(programs, null)).toBe(programs);
  });

  it('ignores an empty string coming back as a version', () => {
    expect(mergeBinaryVersions(programs, { b: '' })[1].version).toBe('');
  });
});
