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

describe('Store apps in a batch', () => {
  /* Excluded outright until Prune could remove a Store app itself -- the
   * old reason read "removed through Windows, not an uninstaller", which
   * stopped being true in 2.3.0. They are eligible now, on one condition
   * that matters more here than anywhere: a batch runs unattended, so only
   * an app Windows has EXPLICITLY said may be removed is let in. */
  const store = (over = {}) => ({
    id: 'store:calc', name: 'Calculator', source: 'store', nonRemovable: false,
    packageFullName: 'Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe',
    ...over
  });

  it('can be batch uninstalled when Windows allows its removal', () => {
    expect(canBatchUninstall(store())).toBe(true);
    expect(batchIneligibleReason(store())).toBeNull();
  });

  it('is not rejected for lacking an uninstall command, which it never has', () => {
    // The registry rule below would otherwise catch every Store app.
    expect(store().uninstallString).toBeUndefined();
    expect(canBatchUninstall(store())).toBe(true);
  });

  it('cannot when Windows marks it as part of the system', () => {
    // On the dev machine: the Security interface and the app installer.
    expect(canBatchUninstall(store({ nonRemovable: true }))).toBe(false);
    expect(batchIneligibleReason(store({ nonRemovable: true })))
      .toMatch(/Windows marks this app as part of the system/);
  });

  it('cannot when nobody knows whether Windows allows it', () => {
    /* The same lopsided default as the backend's NonRemovable reading, and
     * for the same reason. Wrong one way leaves an app to be removed on
     * its own; wrong the other removes a system component with nobody
     * watching. */
    expect(canBatchUninstall(store({ nonRemovable: undefined }))).toBe(false);
    expect(canBatchUninstall(store({ nonRemovable: null }))).toBe(false);
  });

  it('cannot without a package name to remove', () => {
    expect(canBatchUninstall(store({ packageFullName: '' }))).toBe(false);
    expect(canBatchUninstall(store({ packageFullName: undefined }))).toBe(false);
  });
});
