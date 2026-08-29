import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let scanForLeftovers;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ scanForLeftovers } = await import('./leftoverScan.js'));
});

describe('scanForLeftovers', () => {
  it('returns files, registryKeys, and scheduledTasks from three independent scans', async () => {
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: 'C:\\ProgramData\\OldApp', sizeBytes: 4096 }])
      .mockResolvedValueOnce([{ path: 'HKCU:\\Software\\OldApp' }])
      .mockResolvedValueOnce([{ name: 'OldAppUpdater', path: '\\OldApp\\' }]);

    const result = await scanForLeftovers({ name: 'OldApp', publisher: 'Old Inc' });

    expect(result.files).toEqual({ ok: true, items: [{ path: 'C:\\ProgramData\\OldApp', sizeBytes: 4096 }] });
    expect(result.registryKeys).toEqual({ ok: true, items: [{ path: 'HKCU:\\Software\\OldApp' }] });
    expect(result.scheduledTasks).toEqual({ ok: true, items: [{ name: 'OldAppUpdater', path: '\\OldApp\\' }] });
  });

  it('degrades one failing sub-scan to ok:false without failing the others', async () => {
    runPowerShellJsonMock
      .mockRejectedValueOnce(new Error('access denied'))
      .mockResolvedValueOnce([{ path: 'HKCU:\\Software\\OldApp' }])
      .mockResolvedValueOnce(null);

    const result = await scanForLeftovers({ name: 'OldApp', publisher: 'Old Inc' });

    expect(result.files).toEqual({ ok: false, items: [] });
    expect(result.registryKeys.ok).toBe(true);
    expect(result.scheduledTasks).toEqual({ ok: true, items: [] });
  });

  // Real bug this test exists to catch: an empty search pattern (name and
  // publisher both blank) matches EVERY string under PowerShell's -match
  // operator, which would silently return the whole registry/filesystem
  // as "leftovers." Each sub-scan must short-circuit to empty instead.
  it('returns empty results for a program with no name or publisher, calling PowerShell for none of the three scans', async () => {
    const result = await scanForLeftovers({ name: '', publisher: '' });
    expect(result).toEqual({
      files: { ok: true, items: [] },
      registryKeys: { ok: true, items: [] },
      scheduledTasks: { ok: true, items: [] }
    });
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });
});