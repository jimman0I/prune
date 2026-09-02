import { describe, it, expect, vi, beforeEach } from 'vitest';

const scanForLeftoversMock = vi.fn();
vi.mock('./leftoverScan.js', () => ({ scanForLeftovers: (...a) => scanForLeftoversMock(...a) }));

let scanForcedUninstall;
beforeEach(async () => {
  scanForLeftoversMock.mockReset();
  ({ scanForcedUninstall } = await import('./forcedUninstall.js'));
});

const emptyScan = {
  files: { ok: true, items: [] },
  registryKeys: { ok: true, items: [] },
  scheduledTasks: { ok: true, items: [] }
};

describe('scanForcedUninstall', () => {
  it('rejects an empty name instead of scanning for everything', async () => {
    // A blank pattern would match every folder under Program Files.
    await expect(scanForcedUninstall({ name: '   ' })).rejects.toThrow(/name/i);
    expect(scanForLeftoversMock).not.toHaveBeenCalled();
  });

  it('passes the name and publisher through to the existing leftover scanner', async () => {
    scanForLeftoversMock.mockResolvedValue(emptyScan);
    await scanForcedUninstall({ name: 'Dead App', publisher: 'Nobody' });
    expect(scanForLeftoversMock).toHaveBeenCalledWith({ name: 'Dead App', publisher: 'Nobody' });
  });

  it('includes the program\'s own Add/Remove entry as a removable registry item', async () => {
    scanForLeftoversMock.mockResolvedValue(emptyScan);
    const result = await scanForcedUninstall({
      name: 'Dead App',
      registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{X}'
    });
    const paths = result.registryKeys.items.map((i) => i.path);
    expect(paths).toContain('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{X}');
    const entry = result.registryKeys.items.find((i) => i.isUninstallEntry);
    expect(entry).toBeDefined();
  });

  it('does not duplicate the uninstall entry when the leftover scan already found it', async () => {
    const key = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{X}';
    scanForLeftoversMock.mockResolvedValue({
      ...emptyScan,
      registryKeys: { ok: true, items: [{ path: key }] }
    });
    const result = await scanForcedUninstall({ name: 'Dead App', registryKey: key });
    expect(result.registryKeys.items.filter((i) => i.path === key)).toHaveLength(1);
  });

  it('works with no registryKey at all (a program with no Add/Remove entry left)', async () => {
    scanForLeftoversMock.mockResolvedValue(emptyScan);
    const result = await scanForcedUninstall({ name: 'Ghost' });
    expect(result.registryKeys.items).toEqual([]);
  });
});
