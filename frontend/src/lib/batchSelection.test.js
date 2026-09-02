import { describe, it, expect } from 'vitest';
import { canBatchUninstall, batchIneligibleReason, batchSummary } from './batchSelection.js';

const ok = { id: 'a', name: 'Good', sizeBytes: 100, uninstallString: 'uninstall.exe /S' };
const orphan = {
  id: 'b', name: 'Dead', sizeBytes: 50, uninstallString: 'uninstall.exe',
  health: { orphaned: true, reason: 'Its uninstaller is missing.' }
};
const noCommand = { id: 'c', name: 'No Command', sizeBytes: 10, uninstallString: null };

describe('canBatchUninstall', () => {
  it('accepts a program with a working uninstaller', () => {
    expect(canBatchUninstall(ok)).toBe(true);
  });

  // A batch runs uninstallers unattended. An orphaned entry has no
  // working uninstaller by definition, so it would fail every time --
  // it needs the forced path, which is a per-program review of what to
  // delete and not something to do unattended across a queue.
  it('refuses a broken entry', () => {
    expect(canBatchUninstall(orphan)).toBe(false);
    expect(batchIneligibleReason(orphan)).toMatch(/force remove/i);
  });

  it('refuses a program with no uninstall command at all', () => {
    expect(canBatchUninstall(noCommand)).toBe(false);
    expect(batchIneligibleReason(noCommand)).toMatch(/no uninstall/i);
  });

  it('gives no reason for a program that is eligible', () => {
    expect(batchIneligibleReason(ok)).toBeNull();
  });
});

describe('batchSummary', () => {
  it('counts and totals the selection', () => {
    const summary = batchSummary([ok, { ...ok, id: 'd', sizeBytes: 400 }]);
    expect(summary.count).toBe(2);
    expect(summary.totalBytes).toBe(500);
  });

  // A missing size is unknown, not zero. Adding it as 0 would understate
  // the total while looking exact, so the summary says so instead.
  it('reports when some sizes are unknown', () => {
    const summary = batchSummary([ok, { ...ok, id: 'e', sizeBytes: null }]);
    expect(summary.totalBytes).toBe(100);
    expect(summary.unknownSizes).toBe(1);
  });

  it('handles an empty selection', () => {
    expect(batchSummary([])).toEqual({ count: 0, totalBytes: 0, unknownSizes: 0 });
  });
});
