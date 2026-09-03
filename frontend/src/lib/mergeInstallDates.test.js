import { describe, it, expect } from 'vitest';
import { mergeInstallDates } from './mergeInstallDates.js';

const programs = [
  { id: 'declared', installDate: '2020-01-01' },
  { id: 'blank', installDate: null },
  { id: 'unknown', installDate: null }
];

describe('mergeInstallDates', () => {
  it('fills a blank date and marks it approximate', () => {
    const merged = mergeInstallDates(programs, { blank: '2026-07-20' });
    expect(merged[1].installDate).toBe('2026-07-20');
    expect(merged[1].installDateApproximate).toBe(true);
  });

  it('never overwrites a date the installer declared', () => {
    // The key's write time changes on every update, so it is the weaker
    // source -- good enough to fill a blank, not to replace a real value.
    const merged = mergeInstallDates(programs, { declared: '2026-01-01' });
    expect(merged[0].installDate).toBe('2020-01-01');
    expect(merged[0].installDateApproximate).toBeUndefined();
  });

  it('leaves a program with no answer alone', () => {
    const merged = mergeInstallDates(programs, { blank: '2026-07-20' });
    expect(merged[2].installDate).toBeNull();
  });

  it('returns the same array when there is nothing to merge', () => {
    expect(mergeInstallDates(programs, {})).toBe(programs);
    expect(mergeInstallDates(programs, null)).toBe(programs);
  });

  it('ignores an empty string', () => {
    expect(mergeInstallDates(programs, { blank: '' })[1].installDate).toBeNull();
  });
});
