import { describe, it, expect } from 'vitest';
import { selectForRemoval, KEEP } from './duplicateSelection.js';

const file = (path, size, mtimeMs) => ({ path, size, mtimeMs });

describe('selectForRemoval', () => {
  const group = {
    digest: 'x',
    files: [
      file('older', 10, 1000),
      file('newest', 10, 9000),
      file('middle', 10, 5000)
    ]
  };

  it('keeps the oldest and selects the rest', () => {
    // Named for what is KEPT, not for what is selected. "Auto-select
    // oldest" is ambiguous about which end survives, and the surviving
    // copy is the consequential half of the choice.
    const selected = selectForRemoval([group], KEEP.OLDEST);
    expect(selected).toEqual(['newest', 'middle'].sort());
  });

  it('keeps the newest and selects the rest', () => {
    expect(selectForRemoval([group], KEEP.NEWEST)).toEqual(['older', 'middle'].sort());
  });

  it('never selects every copy in a group', () => {
    // The one invariant that matters. Whatever the strategy, exactly one
    // copy of each group has to survive -- a bug that selected all of them
    // would delete the file, not the duplicate.
    for (const strategy of Object.values(KEEP)) {
      const selected = selectForRemoval([group], strategy);
      expect(selected.length).toBe(group.files.length - 1);
    }
  });

  it('is stable when timestamps tie', () => {
    // Two copies written in the same millisecond still have to resolve to
    // one keeper, deterministically, or the selection changes on rescan.
    const tied = { digest: 'y', files: [file('b', 10, 500), file('a', 10, 500)] };
    expect(selectForRemoval([tied], KEEP.OLDEST)).toEqual(selectForRemoval([tied], KEEP.OLDEST));
    expect(selectForRemoval([tied], KEEP.OLDEST)).toHaveLength(1);
  });

  it('leaves a lone file alone', () => {
    expect(selectForRemoval([{ digest: 'z', files: [file('only', 10, 1)] }], KEEP.OLDEST)).toEqual([]);
  });

  it('copes with nothing', () => {
    expect(selectForRemoval([], KEEP.OLDEST)).toEqual([]);
    expect(selectForRemoval(null, KEEP.OLDEST)).toEqual([]);
  });
});
