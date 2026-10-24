import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let scanForLeftovers;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  runPowerShellJsonMock.mockResolvedValue(null);
  ({ scanForLeftovers } = await import('./leftoverScan.js'));
});

const traceFindings = {
  files: [{ path: 'D:\\Apps\\Traced', sizeBytes: 500 }, { path: 'C:\\ProgramData\\TracedData', sizeBytes: 20 }],
  registry: [{ path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'WeirdName' }],
  tasks: [{ name: 'Mystery', path: '\\Odd\\' }],
  services: [{ name: 'OddSvc', displayName: 'OddSvc', pathName: 'D:\\Apps\\Traced\\svc.exe' }]
};

describe('what the install monitor recorded', () => {
  it('comes back as certain, whatever the names say', async () => {
    const result = await scanForLeftovers({ name: 'Acme', traceFindings });
    expect(result.files.items.map((i) => [i.path, i.confidence])).toEqual([
      ['D:\\Apps\\Traced', 'certain'], ['C:\\ProgramData\\TracedData', 'certain']
    ]);
    expect(result.registryKeys.items).toEqual([{ ...traceFindings.registry[0], confidence: 'certain' }]);
    expect(result.scheduledTasks.items).toEqual([{ name: 'Mystery', path: '\\Odd\\', confidence: 'certain' }]);
    expect(result.services.items[0]).toMatchObject({ name: 'OddSvc', confidence: 'certain' });
  });

  it('is used by every mode, Safe included, because it is the installer\'s own record', async () => {
    const result = await scanForLeftovers({ name: 'Acme', mode: 'safe', traceFindings });
    expect(result.files.items).toHaveLength(2);
    expect(result.registryKeys.items).toHaveLength(1);
    expect(result.scheduledTasks.items).toHaveLength(1);
  });

  it('is not listed twice when the name search found the same thing', async () => {
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: 'D:\\Apps\\Traced', sizeBytes: 500 }])
      .mockResolvedValueOnce([{ path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'WeirdName', how: 'name', text: 'WeirdName x' }])
      .mockResolvedValueOnce([{ name: 'Mystery', path: '\\Odd\\', how: 'name' }]);
    const result = await scanForLeftovers({ name: 'Traced', traceFindings });
    expect(result.files.items.filter((i) => i.path === 'D:\\Apps\\Traced')).toHaveLength(1);
    expect(result.registryKeys.items).toHaveLength(1);
    expect(result.registryKeys.items[0].confidence).toBe('certain');
    expect(result.scheduledTasks.items).toHaveLength(1);
    expect(result.scheduledTasks.items[0].confidence).toBe('certain');
  });

  it('still goes through the protections: nothing of Windows, nothing that holds another program', async () => {
    const result = await scanForLeftovers({
      name: 'Acme', mode: 'safe',
      traceFindings: {
        files: [
          { path: 'C:\\Windows\\System32\\drivers\\mine', sizeBytes: 1 },
          { path: 'C:\\ProgramData\\Microsoft\\Crypto', sizeBytes: 1 },
          { path: 'D:\\Vendor', sizeBytes: 1 },
          { path: 'D:\\Own', sizeBytes: 1 }
        ],
        registry: [], tasks: [{ name: 'Defrag', path: '\\Microsoft\\Windows\\Defrag\\' }], services: []
      },
      installedPrograms: [{ id: 'o', name: 'Other', installLocation: 'D:\\Vendor\\Other' }]
    });
    expect(result.files.items.map((i) => i.path)).toEqual(['D:\\Own']);
    expect(result.files.protected).toBe(3);
    expect(result.scheduledTasks.items).toEqual([]);
  });

  it('changes nothing for a program that was not monitored', async () => {
    const result = await scanForLeftovers({ name: 'Acme', mode: 'safe', anchors: {} });
    expect(result.files.items).toEqual([]);
    expect(result.services).toBeUndefined();
  });
});

describe('what an IMPORTED trace lists', () => {
  const imported = { ...traceFindings, imported: true };

  it('is listed but never certain on the trace\'s say-so: names that do not match are possible', async () => {
    const result = await scanForLeftovers({ name: 'Acme', traceFindings: imported });
    expect(result.files.items.map((i) => [i.path, i.confidence])).toEqual([
      ['D:\\Apps\\Traced', 'possible'], ['C:\\ProgramData\\TracedData', 'possible']
    ]);
    expect(result.registryKeys.items).toEqual([{ ...traceFindings.registry[0], confidence: 'possible' }]);
    expect(result.scheduledTasks.items).toEqual([{ name: 'Mystery', path: '\\Odd\\', confidence: 'possible' }]);
    expect(result.services.items[0]).toMatchObject({ name: 'OddSvc', confidence: 'possible' });
  });

  it('is at most likely, when the product\'s name vouches for it, and is never ticked on the trace alone', async () => {
    const { preselectKeys } = await import('../../../frontend/src/lib/leftoverTiers.js');
    const result = await scanForLeftovers({ name: 'Traced', mode: 'safe', traceFindings: imported });
    const tiers = result.files.items.map((i) => i.confidence);
    expect(tiers).toContain('likely');
    expect(tiers).not.toContain('certain');
    for (const group of ['files', 'registryKeys', 'scheduledTasks']) {
      for (const item of result[group].items) expect(item.confidence, `${group} ${item.path}`).not.toBe('certain');
    }
    // The review ticks certain and likely: here only the name match is ticked.
    const ticked = [...preselectKeys(result)];
    expect(ticked.every((key) => {
      const [group, index] = key.split(':');
      return result[group].items[Number(index)].confidence === 'likely';
    })).toBe(true);
    expect(ticked.some((key) => key.startsWith('registryKeys') || key.startsWith('scheduledTasks'))).toBe(false);
  });

  it('does not upgrade what the name search found itself', async () => {
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: 'D:\\Apps\\Traced', sizeBytes: 500 }])
      .mockResolvedValueOnce([{ path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'WeirdName', how: 'name', text: 'WeirdName x' }])
      .mockResolvedValueOnce([{ name: 'Mystery', path: '\\Odd\\', how: 'name' }]);
    const result = await scanForLeftovers({ name: 'Traced', traceFindings: imported });
    expect(result.registryKeys.items).toHaveLength(1);
    expect(result.registryKeys.items[0].confidence).not.toBe('certain');
    expect(result.scheduledTasks.items).toHaveLength(1);
    expect(result.scheduledTasks.items[0].confidence).not.toBe('certain');
  });

  it('a trace recorded on this PC is still certain (no imported flag, or imported: false)', async () => {
    const result = await scanForLeftovers({ name: 'Acme', traceFindings: { ...traceFindings, imported: false } });
    expect(result.files.items.every((i) => i.confidence === 'certain')).toBe(true);
    expect(result.registryKeys.items[0].confidence).toBe('certain');
  });
});
