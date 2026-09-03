import { describe, it, expect } from 'vitest';
import { splitRecentPrograms, RECENT_DAYS } from './recentPrograms.js';

// Fixed clock: 3 September 2026, local noon.
const now = new Date(2026, 8, 3, 12, 0, 0).getTime();

describe('splitRecentPrograms', () => {
  it('puts a program installed this week first', () => {
    const { recent, rest } = splitRecentPrograms(
      [{ id: 'a', installDate: '2026-09-02' }, { id: 'b', installDate: '2026-07-20' }],
      { now }
    );
    expect(recent.map((p) => p.id)).toEqual(['a']);
    expect(rest.map((p) => p.id)).toEqual(['b']);
  });

  it('matches the split Revo shows on this machine', () => {
    // Revo's "New Programs" here spans 27/08 to 02/09 while Wuthering
    // Waves at 17/08 sits in "Other".
    const programs = [
      { id: 'brave', installDate: '2026-09-02' },
      { id: 'spotify', installDate: '2026-08-27' },
      { id: 'wuthering', installDate: '2026-08-17' },
      { id: 'steam', installDate: '2025-07-20' }
    ];
    const { recent, rest } = splitRecentPrograms(programs, { now });
    expect(recent.map((p) => p.id)).toEqual(['brave', 'spotify']);
    expect(rest.map((p) => p.id)).toEqual(['wuthering', 'steam']);
  });

  it('keeps the order it was given inside each group', () => {
    // The list arrives sorted by whichever column the user picked, and
    // grouping must not quietly reorder it.
    const programs = [
      { id: 'big', installDate: '2026-09-01' },
      { id: 'old', installDate: '2020-01-01' },
      { id: 'small', installDate: '2026-09-02' }
    ];
    const { recent } = splitRecentPrograms(programs, { now });
    expect(recent.map((p) => p.id)).toEqual(['big', 'small']);
  });

  it('never calls a program with no date recent', () => {
    // An absent date means no date could be established at all. Guessing
    // it is new would put arbitrary rows at the top of the list.
    const { recent, rest } = splitRecentPrograms(
      [{ id: 'a', installDate: null }, { id: 'b' }, { id: 'c', installDate: 'nonsense' }],
      { now }
    );
    expect(recent).toHaveLength(0);
    expect(rest).toHaveLength(3);
  });

  it('treats the date as local, not UTC', () => {
    // new Date('2026-08-27') is UTC midnight, which reads as the 26th in
    // any timezone behind UTC -- enough to drop a program out of the
    // window a day early.
    const boundary = new Date(2026, 7, 27, 0, 0, 0).getTime();
    const { recent } = splitRecentPrograms(
      [{ id: 'edge', installDate: '2026-08-27' }],
      { now: boundary + RECENT_DAYS * 24 * 60 * 60 * 1000 - 1 }
    );
    expect(recent).toHaveLength(1);
  });

  it('copes with no list', () => {
    expect(splitRecentPrograms(null, { now })).toEqual({ recent: [], rest: [] });
  });
});
