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

describe('nextSortState', () => {
  it('sorts a newly clicked column in its natural direction', () => {
    // Text reads best A-Z; a size or a date is nearly always wanted
    // biggest/newest first, which is what someone clicking it expects.
    expect(nextSortState({ column: 'name', direction: 'asc' }, 'sizeBytes'))
      .toEqual({ column: 'sizeBytes', direction: 'desc' });
    expect(nextSortState({ column: 'sizeBytes', direction: 'desc' }, 'name'))
      .toEqual({ column: 'name', direction: 'asc' });
  });

  it('reverses when the same column is clicked again', () => {
    expect(nextSortState({ column: 'name', direction: 'asc' }, 'name'))
      .toEqual({ column: 'name', direction: 'desc' });
    expect(nextSortState({ column: 'name', direction: 'desc' }, 'name'))
      .toEqual({ column: 'name', direction: 'asc' });
  });
});
