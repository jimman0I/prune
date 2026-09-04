import { describe, it, expect } from 'vitest';
import { sortPrograms, nextSortState } from './sortPrograms.js';

const programs = [
  { id: 'a', name: 'Zebra', sizeBytes: 100, installDate: '2024-01-01', publisher: 'Acme', version: '1.0' },
  { id: 'b', name: 'apple', sizeBytes: null, installDate: null, publisher: 'Zed Corp', version: '2.0' },
  { id: 'c', name: 'Mango', sizeBytes: 5000, installDate: '2026-06-15', publisher: 'Beta', version: '1.5' }
];

describe('sortPrograms', () => {
  it('sorts by name case-insensitively', () => {
    expect(sortPrograms(programs, 'name', 'asc').map(p => p.name)).toEqual(['apple', 'Mango', 'Zebra']);
  });

  it('sorts by size, largest first when descending', () => {
    expect(sortPrograms(programs, 'sizeBytes', 'desc').map(p => p.id)).toEqual(['c', 'a', 'b']);
  });

  // An unknown size is not a zero-byte program. Sorting it as 0 buries it
  // among the genuinely tiny ones and hides that we simply don't know.
  it('keeps unknown values at the end in both directions', () => {
    expect(sortPrograms(programs, 'sizeBytes', 'asc').at(-1).id).toBe('b');
    expect(sortPrograms(programs, 'sizeBytes', 'desc').at(-1).id).toBe('b');
    expect(sortPrograms(programs, 'installDate', 'asc').at(-1).id).toBe('b');
  });

  it('sorts by install date newest first when descending', () => {
    expect(sortPrograms(programs, 'installDate', 'desc').map(p => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by publisher', () => {
    expect(sortPrograms(programs, 'publisher', 'asc').map(p => p.publisher)).toEqual(['Acme', 'Beta', 'Zed Corp']);
  });

  it('never mutates the input', () => {
    const before = programs.map(p => p.id);
    sortPrograms(programs, 'name', 'desc');
    expect(programs.map(p => p.id)).toEqual(before);
  });

  it('returns the list unchanged for an unknown column', () => {
    expect(sortPrograms(programs, 'nope', 'asc').map(p => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('sortPrograms by the New column', () => {
  // Fixed clock: 3 September 2026. The window is seven whole days, so
  // 27/08 is still new and 26/08 is not.
  const now = new Date(2026, 8, 3, 12, 0, 0).getTime();
  const list = [
    { id: 'old', name: 'Old', installDate: '2025-01-04' },
    { id: 'newer', name: 'Newer', installDate: '2026-09-02' },
    { id: 'undated', name: 'Undated', installDate: null },
    { id: 'newest', name: 'Newest', installDate: '2026-09-03' }
  ];

  it('brings recent installs to the top, newest first', () => {
    expect(sortPrograms(list, 'recent', 'desc', { now }).map(p => p.id))
      .toEqual(['newest', 'newer', 'old', 'undated']);
  });

  it('reverses to put them last', () => {
    expect(sortPrograms(list, 'recent', 'asc', { now }).map(p => p.id))
      .toEqual(['undated', 'old', 'newer', 'newest']);
  });

  // A program with no install date is not "unknown" for this column the
  // way an unmeasured size is: it is simply not new, which is an answer.
  // It still sinks below the dated ones, because within the not-new group
  // this falls back to the date, and no date sorts last there.
  it('treats a missing date as not-new rather than unknown', () => {
    const sorted = sortPrograms(
      [{ id: 'undated', name: 'U', installDate: null }, { id: 'old', name: 'O', installDate: '2020-01-01' }],
      'recent',
      'desc',
      { now }
    );
    expect(sorted.map(p => p.id)).toEqual(['old', 'undated']);
  });

  it('defaults its clock to now, so the column works without one', () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const sorted = sortPrograms(
      [{ id: 'old', name: 'O', installDate: '2019-05-05' }, { id: 'today', name: 'T', installDate: iso }],
      'recent',
      'desc'
    );
    expect(sorted[0].id).toBe('today');
  });
});

describe('nextSortState', () => {
  it('sorts a newly clicked column in its natural direction', () => {
    // Text reads best A-Z; a size or a date is nearly always wanted
    // biggest/newest first, which is what someone clicking it expects.
    expect(nextSortState({ column: 'name', direction: 'asc' }, 'sizeBytes'))
      .toEqual({ column: 'sizeBytes', direction: 'desc' });
    expect(nextSortState({ column: 'sizeBytes', direction: 'desc' }, 'name'))
      .toEqual({ column: 'name', direction: 'asc' });
    // The New column is a flag; clicking it means "show me the new ones".
    expect(nextSortState({ column: 'name', direction: 'asc' }, 'recent'))
      .toEqual({ column: 'recent', direction: 'desc' });
  });

  it('reverses when the same column is clicked again', () => {
    expect(nextSortState({ column: 'name', direction: 'asc' }, 'name'))
      .toEqual({ column: 'name', direction: 'desc' });
    expect(nextSortState({ column: 'name', direction: 'desc' }, 'name'))
      .toEqual({ column: 'name', direction: 'asc' });
  });
});
