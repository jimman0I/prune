import { describe, it, expect } from 'vitest';
import { selectionToRemoval } from './UninstallModal.jsx';

const scanResult = {
  files: { ok: true, items: [{ path: 'C:\\Program Files\\Dead', sizeBytes: 100 }, { path: 'C:\\Users\\me\\AppData\\Dead' }] },
  registryKeys: { ok: true, items: [{ path: 'HKCU:\\SOFTWARE\\Dead' }, { path: 'HKLM:\\SOFTWARE\\Dead' }] },
  scheduledTasks: { ok: true, items: [{ name: 'DeadUpdater', path: '\\' }] }
};

describe('selectionToRemoval', () => {
  it('maps the review\'s group:index keys back to real paths', () => {
    const selected = new Set(['files:0', 'registryKeys:1']);
    expect(selectionToRemoval(scanResult, selected)).toEqual({
      files: ['C:\\Program Files\\Dead'],
      registryKeys: ['HKLM:\\SOFTWARE\\Dead']
    });
  });

  it('returns empty lists when nothing is selected', () => {
    expect(selectionToRemoval(scanResult, new Set())).toEqual({ files: [], registryKeys: [] });
  });

  // The quarantine system moves files and exports registry keys; there is
  // no equivalent reversible operation for a scheduled task. Passing one
  // through would either do nothing or delete something unrecoverably --
  // so they are reported on screen and never included in a removal.
  it('never includes scheduled tasks, even if one is somehow selected', () => {
    const selected = new Set(['files:0', 'scheduledTasks:0']);
    const result = selectionToRemoval(scanResult, selected);
    expect(result).toEqual({ files: ['C:\\Program Files\\Dead'], registryKeys: [] });
  });

  it('tolerates a scan group that failed and has no items', () => {
    const partial = { files: { ok: false, items: [] }, registryKeys: { ok: true, items: [{ path: 'HKCU:\\A' }] } };
    expect(selectionToRemoval(partial, new Set(['registryKeys:0'])))
      .toEqual({ files: [], registryKeys: ['HKCU:\\A'] });
  });

  it('drops an item with no path rather than sending undefined to the remover', () => {
    const odd = { files: { ok: true, items: [{ sizeBytes: 5 }] }, registryKeys: { ok: true, items: [] } };
    expect(selectionToRemoval(odd, new Set(['files:0'])).files).toEqual([]);
  });

  // A startup entry is one VALUE inside HKCU\...\Run, a key every program
  // that starts with Windows shares. Flattening it to its path would ask
  // the remover to delete that whole key.
  it('keeps a registry value addressed as a value, not as its key', () => {
    const withValue = {
      files: { ok: true, items: [] },
      registryKeys: {
        ok: true,
        items: [{ path: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'DeadUpdater' }]
      }
    };
    expect(selectionToRemoval(withValue, new Set(['registryKeys:0'])).registryKeys).toEqual([
      { path: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'DeadUpdater' }
    ]);
  });

  it('sends a plain key as a bare path, the way it always has', () => {
    // The remover accepts both, and there is nothing for the object form
    // to carry here -- an extra wrapper would only make the manifest and
    // every existing quarantine batch disagree about the same key.
    const selected = new Set(['registryKeys:0']);
    expect(selectionToRemoval(scanResult, selected).registryKeys).toEqual(['HKCU:\\SOFTWARE\\Dead']);
  });
});
