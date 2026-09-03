import { describe, it, expect } from 'vitest';
import { sortFolderRows, nextFolderSort } from './sortFolderRows.js';

const rows = [
  { name: 'Beta', size: 200, items: 5, modified: 2000 },
  { name: 'alpha', size: 900, items: 1, modified: 3000 },
  { name: 'Gamma', size: 500, items: null, modified: null }
];

describe('sortFolderRows', () => {
  it('sorts by size, largest first by default', () => {
    expect(sortFolderRows(rows, 'size').map((r) => r.name)).toEqual(['alpha', 'Gamma', 'Beta']);
  });

  it('reverses on ascending', () => {
    expect(sortFolderRows(rows, 'size', 'asc').map((r) => r.name)).toEqual(['Beta', 'Gamma', 'alpha']);
  });

  // A row with no counts is one the scan never opened. Sorting it as zero
  // would file "we didn't look" among "we looked and found nothing".
  it('sinks unmeasured rows when sorting descending', () => {
    expect(sortFolderRows(rows, 'items').map((r) => r.name)).toEqual(['Beta', 'alpha', 'Gamma']);
  });

  it('sinks them ascending too -- unknown is not smallest', () => {
    expect(sortFolderRows(rows, 'items', 'asc').map((r) => r.name)).toEqual(['alpha', 'Beta', 'Gamma']);
  });

  it('sorts names case-insensitively and naturally', () => {
    // "alpha" belongs first, not last because of its lowercase a.
    expect(sortFolderRows(rows, 'name', 'asc').map((r) => r.name)).toEqual(['alpha', 'Beta', 'Gamma']);
  });

  it('breaks ties by name so the order is stable to read', () => {
    const tied = [
      { name: 'b', size: 100 },
      { name: 'a', size: 100 }
    ];
    expect(sortFolderRows(tied, 'size').map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('does not mutate what it was given', () => {
    const original = [...rows];
    sortFolderRows(rows, 'size');
    expect(rows).toEqual(original);
  });

  it('copes with no rows', () => {
    expect(sortFolderRows(null, 'size')).toEqual([]);
  });
});

describe('nextFolderSort', () => {
  it('starts a numeric column descending', () => {
    // Every numeric column here is one someone opens the table to find
    // the top of.
    expect(nextFolderSort({ column: 'name', direction: 'asc' }, 'size'))
      .toEqual({ column: 'size', direction: 'desc' });
  });

  it('starts the name column ascending', () => {
    expect(nextFolderSort({ column: 'size', direction: 'desc' }, 'name'))
      .toEqual({ column: 'name', direction: 'asc' });
  });

  it('flips the column already active', () => {
    expect(nextFolderSort({ column: 'size', direction: 'desc' }, 'size'))
      .toEqual({ column: 'size', direction: 'asc' });
    expect(nextFolderSort({ column: 'size', direction: 'asc' }, 'size'))
      .toEqual({ column: 'size', direction: 'desc' });
  });
});
