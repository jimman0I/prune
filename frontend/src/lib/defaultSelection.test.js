import { describe, it, expect } from 'vitest';
import { defaultSelection, selectableIds } from './defaultSelection.js';

const categories = [
  {
    category: 'Applications',
    items: [
      { id: 'discord', recommended: true, present: true, accessible: true, sizeBytes: 400 },
      { id: 'spotify', recommended: true, present: true, accessible: true, sizeBytes: 5000 },
      { id: 'teams', recommended: true, present: false, accessible: true, sizeBytes: 0 }
    ]
  },
  {
    category: 'Developer',
    items: [
      { id: 'npm', recommended: false, present: true, accessible: true, sizeBytes: 9000 }
    ]
  },
  {
    category: 'System',
    items: [
      { id: 'prefetch', recommended: false, present: true, accessible: false, sizeBytes: 0 },
      { id: 'dumps', recommended: true, present: true, accessible: false, sizeBytes: 0 },
      { id: 'dns', recommended: false, present: true, accessible: true, sizeBytes: null }
    ]
  }
];

describe('defaultSelection', () => {
  // The problem this solves: a scan found 54.46 GB across 40 rules and
  // selected none of them, so the footer read "Total space to free: 0 B"
  // and Clean was disabled. After a 19-second wait that reads as broken.
  it('selects the recommended rules that are actually present', () => {
    expect(defaultSelection(categories)).toEqual(new Set(['discord', 'spotify']));
  });

  it('skips software that is not installed', () => {
    expect(defaultSelection(categories).has('teams')).toBe(false);
  });

  it('skips rules that are not recommended', () => {
    expect(defaultSelection(categories).has('npm')).toBe(false);
    expect(defaultSelection(categories).has('prefetch')).toBe(false);
  });

  // Selecting something we could not even measure would put a rule in the
  // batch whose size is unknown and whose files we may not be able to
  // touch -- the "needs admin" case.
  it('skips rules it could not read', () => {
    expect(defaultSelection(categories).has('dumps')).toBe(false);
  });

  it('returns an empty set for an empty or missing scan', () => {
    expect(defaultSelection([])).toEqual(new Set());
    expect(defaultSelection(null)).toEqual(new Set());
  });
});

describe('selectableIds', () => {
  it('offers everything present and readable, recommended or not', () => {
    // "Select all" is a deliberate user action, so it is allowed to reach
    // past the recommended defaults -- but still not to unreadable or
    // uninstalled entries, which would be selecting nothing.
    expect(selectableIds(categories)).toEqual(new Set(['discord', 'spotify', 'npm', 'dns']));
  });

  it('returns an empty set when there is nothing scanned', () => {
    expect(selectableIds(null)).toEqual(new Set());
  });
});
