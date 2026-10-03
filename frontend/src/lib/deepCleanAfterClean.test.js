import { describe, it, expect } from 'vitest';
import { settleScanAfterClean } from './deepCleanAfterClean.js';

/** After a clean, Deep Clean no longer walks the disk again. The rows on
 * screen are updated from what the clean reported instead, and only to
 * numbers that report can justify. */

const tree = () => [
  {
    category: 'Windows',
    items: [
      { id: 'temp', name: 'Temp', actions: [{ type: 'delete', paths: ['%TEMP%'] }], sizeBytes: 5000, fileCount: 12, present: true, accessible: true, filesListed: true, files: [{ path: 'a', sizeBytes: 1 }], fromCache: true },
      { id: 'legacy', name: 'Legacy shape', paths: ['%X%'], sizeBytes: 800, fileCount: 2, present: true, accessible: true },
      { id: 'untouched', name: 'Not selected', actions: [{ type: 'delete', paths: ['%Y%'] }], sizeBytes: 77, fileCount: 1, present: true, accessible: true, fromCache: true }
    ]
  },
  {
    category: 'Chrome',
    items: [
      { id: 'history', name: 'History', actions: [{ type: 'chrome.history', path: 'x' }], sizeBytes: 3000, fileCount: null, present: true, accessible: true },
      { id: 'cache', name: 'Cache', actions: [{ type: 'deepscan', root: 'x' }], sizeBytes: 9000, fileCount: 50, present: true, accessible: true, incomplete: 'cap', filesListed: true, files: [] },
      { id: 'dns', name: 'Flush DNS', command: 'ipconfig /flushdns', sizeBytes: null, fileCount: null, present: true, accessible: true }
    ]
  },
  {
    category: 'Windows Defender',
    items: [{ id: 'prefetch', name: 'Prefetch', actions: [{ type: 'delete', paths: ['C:\\Windows\\Prefetch'] }], sizeBytes: 100, fileCount: 1, present: true, accessible: false }]
  }
];

const row = (t, id) => t.flatMap((g) => g.items).find((i) => i.id === id);

describe('settleScanAfterClean', () => {
  it('shows a rule that was removed completely as 0 B and drops its file list', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'temp', freedBytes: 5000, movedBytes: 0, skipped: [] }]);
    expect(row(settled, 'temp')).toMatchObject({ sizeBytes: 0, fileCount: 0 });
    expect(row(settled, 'temp').files).toBeUndefined();
    expect(row(settled, 'temp').filesListed).toBeUndefined();
    expect(row(settled, 'temp').fromCache).toBeUndefined();
    expect(row(settled, 'temp').rescanNeeded).toBeUndefined();
  });

  it('counts what was moved (Quarantine, Recycle Bin) as removed from the folder too', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'temp', freedBytes: 0, movedBytes: 5000, skipped: [] }]);
    expect(row(settled, 'temp').sizeBytes).toBe(0);
  });

  it('reads the pre-actions rule shape as a plain delete', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'legacy', freedBytes: 800, skipped: [] }]);
    expect(row(settled, 'legacy').sizeBytes).toBe(0);
  });

  it('keeps what is left, as size minus what came off, when files were locked', () => {
    const settled = settleScanAfterClean(tree(), [
      { id: 'temp', freedBytes: 3500, movedBytes: 0, skipped: [{ path: 'p', reason: 'locked or inaccessible' }, { path: 'q', reason: 'locked or inaccessible' }] }
    ]);
    expect(row(settled, 'temp').sizeBytes).toBe(1500);
    // The count of what is left is not known, so none is claimed.
    expect(row(settled, 'temp').fileCount).toBeNull();
  });

  it('keeps what is left when locked files were only scheduled for the next restart', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'temp', freedBytes: 4000, skipped: [], scheduledForRestart: 3 }]);
    expect(row(settled, 'temp').sizeBytes).toBe(1000);
  });

  it('never goes below zero when the clean removed more than the old scan saw', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'temp', freedBytes: 9999, skipped: [{ path: 'p', reason: 'locked or inaccessible' }] }]);
    expect(row(settled, 'temp').sizeBytes).toBe(0);
  });

  it('marks a rule it cannot subtract from as cleaned, to be measured again, instead of guessing', () => {
    // A history database is edited, not deleted: how much is left is unknown.
    const settled = settleScanAfterClean(tree(), [{ id: 'history', freedBytes: 1200, skipped: [], vacuumed: true }]);
    expect(row(settled, 'history')).toMatchObject({ sizeBytes: null, fileCount: null, rescanNeeded: true });
  });

  it('does the same for a search that stopped short, whose size was only a floor', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'cache', freedBytes: 9000, skipped: [] }]);
    expect(row(settled, 'cache')).toMatchObject({ sizeBytes: null, rescanNeeded: true });
    expect(row(settled, 'cache').incomplete).toBeUndefined();
  });

  it('leaves a non-removing rule alone when it removed nothing', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'history', freedBytes: 0, movedBytes: 0, skipped: [], vacuumed: true }]);
    expect(row(settled, 'history')).toMatchObject({ sizeBytes: 3000 });
    expect(row(settled, 'history').rescanNeeded).toBeUndefined();
  });

  it('leaves rows alone that the clean did not report on', () => {
    const settled = settleScanAfterClean(tree(), [{ id: 'temp', freedBytes: 5000, skipped: [] }]);
    expect(row(settled, 'untouched')).toEqual(row(tree(), 'untouched'));
    expect(row(settled, 'untouched').fromCache).toBe(true);
  });

  it('leaves a rule alone that errored, and one that never had a size', () => {
    const settled = settleScanAfterClean(tree(), [
      { id: 'temp', error: 'Unknown rule id' },
      { id: 'dns', freedBytes: 0, skipped: [], ranCommand: true }
    ]);
    expect(row(settled, 'temp')).toEqual(row(tree(), 'temp'));
    expect(row(settled, 'dns')).toEqual(row(tree(), 'dns'));
  });

  it('ignores a result for a rule that is not in the tree', () => {
    expect(settleScanAfterClean(tree(), [{ id: 'nope', freedBytes: 1, skipped: [] }])).toEqual(tree());
  });

  it('does not mutate the tree it was given', () => {
    const before = tree();
    settleScanAfterClean(before, [{ id: 'temp', freedBytes: 5000, skipped: [] }]);
    expect(before).toEqual(tree());
  });

  it('returns the same tree for nothing to settle', () => {
    const t = tree();
    expect(settleScanAfterClean(t, [])).toBe(t);
    expect(settleScanAfterClean(t, undefined)).toBe(t);
  });

  describe('an administrator clean of rules the scan could not read', () => {
    it('marks them cleaned and readable, with no size claimed, when something came off', () => {
      const settled = settleScanAfterClean(tree(), [{ id: 'prefetch', freedBytes: 4000, skipped: [] }]);
      expect(row(settled, 'prefetch')).toMatchObject({ sizeBytes: null, rescanNeeded: true, accessible: true });
    });

    it('keeps them protected when nothing came off and everything was skipped', () => {
      const settled = settleScanAfterClean(tree(), [{ id: 'prefetch', freedBytes: 0, movedBytes: 0, skipped: [{ path: 'p', reason: 'locked or inaccessible' }] }]);
      expect(row(settled, 'prefetch')).toEqual(row(tree(), 'prefetch'));
    });
  });
});
