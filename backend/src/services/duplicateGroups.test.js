import { describe, it, expect } from 'vitest';
import { candidatesBySize, groupByDigest, selectForRemoval, KEEP } from './duplicateGroups.js';

const file = (path, size, mtimeMs) => ({ path, size, mtimeMs });

describe('candidatesBySize', () => {
  it('drops every file with a size nothing else shares', () => {
    // The whole reason a duplicate scan is affordable. Hashing is the
    // expensive part and a file whose size is unique cannot possibly have
    // a twin, so it is never opened at all.
    const files = [file('a', 100), file('b', 100), file('c', 999)];
    expect(candidatesBySize(files).flat().map((f) => f.path).sort()).toEqual(['a', 'b']);
  });

  it('groups by size, not into one list', () => {
    const groups = candidatesBySize([
      file('a', 100), file('b', 100), file('c', 200), file('d', 200)
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.length === 2)).toBe(true);
  });

  it('ignores empty files entirely', () => {
    // Every zero-byte file on a machine is byte-identical to every other
    // one, which is true and useless -- it would be the largest "duplicate
    // group" on screen and deleting from it frees nothing.
    expect(candidatesBySize([file('a', 0), file('b', 0), file('c', 0)])).toEqual([]);
  });

  it('copes with nothing', () => {
    expect(candidatesBySize([])).toEqual([]);
    expect(candidatesBySize(null)).toEqual([]);
  });
});

describe('groupByDigest', () => {
  it('keeps only the digests more than one file has', () => {
    const hashed = [
      { ...file('a', 10), digest: 'x' },
      { ...file('b', 10), digest: 'x' },
      { ...file('c', 10), digest: 'y' }
    ];
    const groups = groupByDigest(hashed);
    expect(groups).toHaveLength(1);
    expect(groups[0].files.map((f) => f.path)).toEqual(['a', 'b']);
  });

  it('reports what a group actually wastes', () => {
    // Three copies of a 10 MB file waste 20 MB, not 30. One of them is
    // the file; the rest are the waste. Reporting 30 would promise space
    // that deleting cannot return.
    const hashed = ['a', 'b', 'c'].map((p) => ({ ...file(p, 10 * 1024 * 1024), digest: 'x' }));
    const [group] = groupByDigest(hashed);
    expect(group.count).toBe(3);
    expect(group.wastedBytes).toBe(20 * 1024 * 1024);
  });

  it('sorts the biggest waste first', () => {
    const hashed = [
      { ...file('s1', 100), digest: 'small' }, { ...file('s2', 100), digest: 'small' },
      { ...file('b1', 5000), digest: 'big' }, { ...file('b2', 5000), digest: 'big' }
    ];
    expect(groupByDigest(hashed).map((g) => g.digest)).toEqual(['big', 'small']);
  });

  it('ignores a file that could not be hashed', () => {
    // A locked or unreadable file has no digest. Treating null as a value
    // would group every unreadable file on the machine together and offer
    // them for deletion as "identical".
    const hashed = [
      { ...file('a', 10), digest: null },
      { ...file('b', 10), digest: null },
      { ...file('c', 10), digest: undefined }
    ];
    expect(groupByDigest(hashed)).toEqual([]);
  });
});

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
