import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let listInstalledPrograms, normalizeProgram, dedupeIds, toPowerShellRegistryPath;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ listInstalledPrograms, normalizeProgram, dedupeIds, toPowerShellRegistryPath } = await import('./programs.js'));
});

describe('toPowerShellRegistryPath', () => {
  // Format confirmed live against this machine's registry, not assumed.
  it('converts a real HKLM PSPath into the HKLM:\\ form the quarantine service expects', () => {
    expect(toPowerShellRegistryPath(
      'Microsoft.PowerShell.Core\\Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MCHOSE'
    )).toBe('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MCHOSE');
  });

  it('converts an HKCU PSPath', () => {
    expect(toPowerShellRegistryPath(
      'Microsoft.PowerShell.Core\\Registry::HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\App'
    )).toBe('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\App');
  });

  it('returns null for a missing or unrecognized hive rather than a half-converted path', () => {
    // A path we can't convert with confidence must not be handed to
    // `reg delete` -- half a registry path is more dangerous than none.
    expect(toPowerShellRegistryPath(null)).toBeNull();
    expect(toPowerShellRegistryPath('Registry::HKEY_CLASSES_ROOT\\Thing')).toBeNull();
  });
});

describe('normalizeProgram', () => {
  it('maps raw registry fields to the app shape, converting KB to bytes', () => {
    const result = normalizeProgram({
      id: '{GUID}', name: 'Google Chrome', publisher: 'Google LLC', version: '129.0',
      installDate: '20230115', estimatedSizeKb: 620000, uninstallString: 'MsiExec.exe /X{GUID}',
      installLocation: 'C:\\Program Files\\Google\\Chrome',
      psPath: 'Microsoft.PowerShell.Core\\Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}',
      displayIcon: 'C:\\Program Files\\Google\\Chrome\\chrome.exe,0'
    });
    expect(result).toEqual({
      id: '{GUID}', name: 'Google Chrome', publisher: 'Google LLC', version: '129.0',
      installDate: '2023-01-15', sizeBytes: 620000 * 1024,
      uninstallString: 'MsiExec.exe /X{GUID}', installLocation: 'C:\\Program Files\\Google\\Chrome',
      registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}',
      displayIcon: 'C:\\Program Files\\Google\\Chrome\\chrome.exe,0',
      architecture: '64-bit',
      website: null
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

  it('attaches a health verdict to every program', async () => {
    // The uninstaller path here is deliberately one that cannot exist, so
    // this asserts the real assessProgramHealth ran rather than a stub.
    runPowerShellJsonMock.mockResolvedValue([
      { id: 'a', name: 'Dead Entry', uninstallString: '"Z:\\nope\\uninstall.exe" /S' }
    ]);
    const [program] = await listInstalledPrograms();
    expect(program.health.orphaned).toBe(true);
    expect(program.health.uninstallerMissing).toBe(true);
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

describe('architecture', () => {
  // Revo shows a 32/64-bit column. Windows records it structurally rather
  // than as a value: a 32-bit program on 64-bit Windows is registered
  // under WOW6432Node, and everything else in HKLM is native.
  it('reads 32-bit from the WOW6432Node hive', () => {
    expect(normalizeProgram({
      id: 'x', name: 'Old App',
      psPath: 'Microsoft.PowerShell.Core\\Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{G}'
    }).architecture).toBe('32-bit');
  });

  it('reads 64-bit from the native hive', () => {
    expect(normalizeProgram({
      id: 'x', name: 'New App',
      psPath: 'Microsoft.PowerShell.Core\\Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{G}'
    }).architecture).toBe('64-bit');
  });

  it('is null when the hive does not say', () => {
    // A per-user HKCU entry carries no architecture information, and
    // guessing would put a wrong badge on the row.
    expect(normalizeProgram({
      id: 'x', name: 'User App',
      psPath: 'Microsoft.PowerShell.Core\\Registry::HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{G}'
    }).architecture).toBeNull();
    expect(normalizeProgram({ id: 'x', name: 'No Path' }).architecture).toBeNull();
  });
});

describe('website', () => {
  it('prefers the about URL', () => {
    expect(normalizeProgram({
      id: 'x', name: 'App', urlInfoAbout: 'https://example.com', helpLink: 'https://help.example.com'
    }).website).toBe('https://example.com');
  });

  it('falls back to the help link', () => {
    expect(normalizeProgram({ id: 'x', name: 'App', helpLink: 'https://help.example.com' }).website)
      .toBe('https://help.example.com');
  });

  it('ignores a non-http value', () => {
    // These fields are third-party-controlled and do turn up holding
    // things that are not URLs at all.
    expect(normalizeProgram({ id: 'x', name: 'App', urlInfoAbout: 'not a url' }).website).toBeNull();
    expect(normalizeProgram({ id: 'x', name: 'App' }).website).toBeNull();
  });
});
