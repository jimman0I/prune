import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let listInstalledPrograms, normalizeProgram, dedupeIds;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ listInstalledPrograms, normalizeProgram, dedupeIds } = await import('./programs.js'));
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

  // Real bug, found dogfooding (2026-08-29): 7-Zip's own installer uses the
  // literal registry key name "7-Zip" in both the native 64-bit Uninstall
  // hive and WOW6432Node, so the raw enumeration genuinely returns two
  // different real programs sharing one id — confirmed live.
  it('de-duplicates a real-world id collision (7-Zip in two registry hives) instead of returning it as-is', async () => {
    runPowerShellJsonMock.mockResolvedValue([
      { id: '7-Zip', name: '7-Zip 22.01', publisher: 'Igor Pavlov' },
      { id: '7-Zip', name: '7-Zip 25.01 (x64)', publisher: 'Igor Pavlov' }
    ]);
    const result = await listInstalledPrograms();
    const ids = result.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids).toEqual(['7-Zip', '7-Zip#2']);
  });
});

describe('dedupeIds', () => {
  it('leaves an already-unique list untouched', () => {
    const input = [{ id: 'a' }, { id: 'b' }];
    expect(dedupeIds(input)).toEqual(input);
  });

  it('suffixes only the SECOND and later occurrences of a repeated id, keeping the first unchanged', () => {
    const input = [{ id: 'x', n: 1 }, { id: 'x', n: 2 }, { id: 'x', n: 3 }];
    expect(dedupeIds(input)).toEqual([
      { id: 'x', n: 1 },
      { id: 'x#2', n: 2 },
      { id: 'x#3', n: 3 }
    ]);
  });

  it('handles multiple independent collisions in the same list', () => {
    const input = [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'b' }];
    expect(dedupeIds(input).map(p => p.id)).toEqual(['a', 'b', 'a#2', 'b#2']);
  });

  it('does not mutate the original array or its objects', () => {
    const original = { id: 'x' };
    const input = [original, { id: 'x' }];
    dedupeIds(input);
    expect(original).toEqual({ id: 'x' }); // untouched
  });
});
