import { describe, it, expect, vi, beforeEach } from 'vitest';

const scanForLeftoversMock = vi.fn();
const quarantineAndDeleteMock = vi.fn();
vi.mock('./leftoverScan.js', () => ({ scanForLeftovers: (...a) => scanForLeftoversMock(...a) }));
vi.mock('./quarantine.js', () => ({ quarantineAndDelete: (...a) => quarantineAndDeleteMock(...a) }));

let scanForcedUninstall, executeForcedUninstall;
beforeEach(async () => {
  scanForLeftoversMock.mockReset();
  quarantineAndDeleteMock.mockReset();
  ({ scanForcedUninstall, executeForcedUninstall } = await import('./forcedUninstall.js'));
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

describe('executeForcedUninstall', () => {
  it('quarantines the selected files and keys rather than deleting them outright', async () => {
    quarantineAndDeleteMock.mockResolvedValue({
      batchDir: 'C:\\q\\1', totalSizeBytes: 500, files: [], registryKeys: ['HKCU:\\SOFTWARE\\A']
    });
    const result = await executeForcedUninstall({
      name: 'Dead App', files: ['C:\\Program Files\\Dead'], registryKeys: ['HKCU:\\SOFTWARE\\A']
    });
    expect(quarantineAndDeleteMock).toHaveBeenCalledWith({
      programName: 'Dead App',
      files: ['C:\\Program Files\\Dead'],
      registryKeys: ['HKCU:\\SOFTWARE\\A']
    });
    expect(result.freedBytes).toBe(500);
    expect(result.quarantineBatch).toBe('C:\\q\\1');
  });

  // quarantineAndDelete swallows a failed `reg delete` (by design -- one bad
  // key must not abort the batch), so a key that needed admin comes back
  // simply absent from the manifest. Without this diff the UI would report
  // a clean removal while the entry is still sitting in Add/Remove Programs.
  it('reports registry keys that were requested but never actually removed', async () => {
    quarantineAndDeleteMock.mockResolvedValue({
      batchDir: 'C:\\q\\1', totalSizeBytes: 0, files: [],
      registryKeys: ['HKCU:\\SOFTWARE\\Removed']
    });
    const result = await executeForcedUninstall({
      name: 'Dead App', files: [],
      registryKeys: ['HKCU:\\SOFTWARE\\Removed', 'HKLM:\\SOFTWARE\\NeedsAdmin']
    });
    expect(result.failedRegistryKeys).toEqual(['HKLM:\\SOFTWARE\\NeedsAdmin']);
  });

  it('reports an empty failure list when everything was removed', async () => {
    quarantineAndDeleteMock.mockResolvedValue({
      batchDir: 'C:\\q\\1', totalSizeBytes: 0, files: [], registryKeys: ['HKCU:\\SOFTWARE\\A']
    });
    const result = await executeForcedUninstall({ name: 'X', files: [], registryKeys: ['HKCU:\\SOFTWARE\\A'] });
    expect(result.failedRegistryKeys).toEqual([]);
  });

  it('refuses a request that selects nothing at all', async () => {
    await expect(executeForcedUninstall({ name: 'X', files: [], registryKeys: [] }))
      .rejects.toThrow(/nothing/i);
    expect(quarantineAndDeleteMock).not.toHaveBeenCalled();
  });

  it('requires a name for the quarantine batch label', async () => {
    await expect(executeForcedUninstall({ name: '', files: ['C:\\x'], registryKeys: [] }))
      .rejects.toThrow(/name/i);
  });
});
