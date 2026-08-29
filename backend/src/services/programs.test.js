import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let listInstalledPrograms, normalizeProgram;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ listInstalledPrograms, normalizeProgram } = await import('./programs.js'));
});

describe('normalizeProgram', () => {
  it('maps raw registry fields to the app shape, converting KB to bytes', () => {
    const result = normalizeProgram({
      id: '{GUID}', name: 'Google Chrome', publisher: 'Google LLC', version: '129.0',
      installDate: '20230115', estimatedSizeKb: 620000, uninstallString: 'MsiExec.exe /X{GUID}',
      installLocation: 'C:\\Program Files\\Google\\Chrome'
    });
    expect(result).toEqual({
      id: '{GUID}', name: 'Google Chrome', publisher: 'Google LLC', version: '129.0',
      installDate: '2023-01-15', sizeBytes: 620000 * 1024,
      uninstallString: 'MsiExec.exe /X{GUID}', installLocation: 'C:\\Program Files\\Google\\Chrome'
    });
  });

  it('defaults a missing publisher to "Unknown Publisher"', () => {
    expect(normalizeProgram({ id: 'x', name: 'Thing' }).publisher).toBe('Unknown Publisher');
  });

  it('returns null installDate for a missing or malformed value', () => {
    expect(normalizeProgram({ id: 'x', name: 'Thing', installDate: null }).installDate).toBeNull();
    expect(normalizeProgram({ id: 'x', name: 'Thing', installDate: 'not-a-date' }).installDate).toBeNull();
  });

  it('returns null sizeBytes when estimatedSizeKb is missing', () => {
    expect(normalizeProgram({ id: 'x', name: 'Thing' }).sizeBytes).toBeNull();
  });
});

describe('listInstalledPrograms', () => {
  it('returns an empty array when the registry query finds nothing', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    expect(await listInstalledPrograms()).toEqual([]);
  });

  it('normalizes a single-object result (PowerShell collapses a 1-item array) into a 1-item array', async () => {
    runPowerShellJsonMock.mockResolvedValue({ id: 'x', name: 'Solo App' });
    const result = await listInstalledPrograms();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Solo App');
  });

  it('normalizes a multi-item array result', async () => {
    runPowerShellJsonMock.mockResolvedValue([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    const result = await listInstalledPrograms();
    expect(result.map(p => p.name)).toEqual(['A', 'B']);
  });
});
