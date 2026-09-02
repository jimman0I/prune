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
});
