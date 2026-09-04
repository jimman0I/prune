import { describe, it, expect } from 'vitest';
import { isRecentlyInstalled, parseInstallDate, RECENT_DAYS } from './recentPrograms.js';

// Fixed clock: 3 September 2026, local noon.
const now = new Date(2026, 8, 3, 12, 0, 0).getTime();

describe('isRecentlyInstalled', () => {
  it('is true for a program installed this week and false for an older one', () => {
    expect(isRecentlyInstalled({ installDate: '2026-09-02' }, { now })).toBe(true);
    expect(isRecentlyInstalled({ installDate: '2026-07-20' }, { now })).toBe(false);
  });

  it('matches the split Revo shows on this machine', () => {
    // Revo's "New Programs" here spans 27/08 to 02/09 while Wuthering
    // Waves at 17/08 sits in "Other".
    const flagged = [
      { id: 'brave', installDate: '2026-09-02' },
      { id: 'spotify', installDate: '2026-08-27' },
      { id: 'wuthering', installDate: '2026-08-17' },
      { id: 'steam', installDate: '2025-07-20' }
    ].filter((p) => isRecentlyInstalled(p, { now }));
    expect(flagged.map((p) => p.id)).toEqual(['brave', 'spotify']);
  });

  it('never calls a program with no usable date recent', () => {
    // An absent date means no date could be established at all. Guessing
    // it is new would flag arbitrary rows.
    expect(isRecentlyInstalled({ installDate: null }, { now })).toBe(false);
    expect(isRecentlyInstalled({}, { now })).toBe(false);
    expect(isRecentlyInstalled({ installDate: 'nonsense' }, { now })).toBe(false);
    expect(isRecentlyInstalled(null, { now })).toBe(false);
  });

  it('treats the date as local, not UTC', () => {
    // new Date('2026-08-27') is UTC midnight, which reads as the 26th in
    // any timezone behind UTC -- enough to drop a program out of the
    // window a day early.
    const boundary = new Date(2026, 7, 27, 0, 0, 0).getTime();
    expect(
      isRecentlyInstalled(
        { installDate: '2026-08-27' },
        { now: boundary + RECENT_DAYS * 24 * 60 * 60 * 1000 - 1 }
      )
    ).toBe(true);
  });

  it('compares whole days, so an install stays new all day', () => {
    // An install date carries no time of day. Comparing it against an
    // instant would make "seven days ago" mean "seven days ago, but only
    // if it was installed after lunch".
    const early = new Date(2026, 8, 3, 0, 30, 0).getTime();
    const late = new Date(2026, 8, 3, 23, 30, 0).getTime();
    const program = { installDate: '2026-08-27' };
    expect(isRecentlyInstalled(program, { now: early })).toBe(true);
    expect(isRecentlyInstalled(program, { now: late })).toBe(true);
  });

  it('honours a caller-supplied window', () => {
    expect(isRecentlyInstalled({ installDate: '2026-08-20' }, { now, days: 30 })).toBe(true);
  });
});

describe('parseInstallDate', () => {
  it('reads the backend YYYY-MM-DD as local midnight', () => {
    expect(parseInstallDate('2026-09-02')).toBe(new Date(2026, 8, 2).getTime());
  });

  it('returns null for anything it cannot read', () => {
    expect(parseInstallDate(null)).toBeNull();
    expect(parseInstallDate('')).toBeNull();
    expect(parseInstallDate('2 September 2026')).toBeNull();
    expect(parseInstallDate(1756771200000)).toBeNull();
  });
});
