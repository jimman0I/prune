import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSearchPattern } from './leftoverPattern.js';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let scanRegistryLeftovers, normalizeRegistryItems, isProtectedKey, buildRegistryScript;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ scanRegistryLeftovers, normalizeRegistryItems, isProtectedKey, buildRegistryScript } =
    await import('./registryLeftovers.js'));
});

describe('isProtectedKey', () => {
  // A key this scan may offer for deletion has to belong to one program.
  // These belong to Windows, or to every program at once.
  it.each([
    ['HKEY_LOCAL_MACHINE\\SOFTWARE'],
    ['HKEY_CURRENT_USER\\Software'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Classes'],
    ['HKEY_CURRENT_USER\\Software\\Classes'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft'],
    ['HKEY_CURRENT_USER\\Software\\Microsoft'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'],
    ['HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'],
    // The same key by its other spelling: PowerShell's provider syntax.
    ['HKLM:\\Software\\Microsoft'],
    // And with a trailing separator, which is still the same key.
    ['HKLM:\\Software\\Microsoft\\']
  ])('protects %s', (path) => {
    expect(isProtectedKey(path)).toBe(true);
  });

  it.each([
    ['HKEY_CURRENT_USER\\Software\\Spotify'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Edge'],
    ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}']
  ])('allows %s', (path) => {
    expect(isProtectedKey(path)).toBe(false);
  });

  it('protects anything too shallow to belong to one program', () => {
    expect(isProtectedKey('HKEY_LOCAL_MACHINE')).toBe(true);
    expect(isProtectedKey('')).toBe(true);
    expect(isProtectedKey(null)).toBe(true);
  });
});

describe('normalizeRegistryItems', () => {
  it('keeps one entry per key and drops case-differing duplicates', () => {
    // The same key is reachable from more than one pass: a vendor key that
    // matches by name is also a child of a root the depth-2 pass walks.
    const items = normalizeRegistryItems([
      { path: 'HKEY_CURRENT_USER\\Software\\Spotify' },
      { path: 'HKEY_CURRENT_USER\\SOFTWARE\\spotify' }
    ]);
    expect(items).toEqual([{ path: 'HKEY_CURRENT_USER\\Software\\Spotify' }]);
  });

  it('keeps a value entry separate from its own key', () => {
    // Deleting a Run VALUE is not deleting the Run KEY, and the Run key is
    // shared by every program that starts with Windows.
    const items = normalizeRegistryItems([
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Spotify' },
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'SpotifyWebHelper' }
    ]);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.valueName)).toEqual(['Spotify', 'SpotifyWebHelper']);
  });

  it('drops a protected key but keeps a value living under it', () => {
    const items = normalizeRegistryItems([
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' },
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Spotify' },
      { path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft' }
    ]);
    expect(items).toEqual([
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Spotify' }
    ]);
  });

  it('carries the uninstall-entry marker through', () => {
    const items = normalizeRegistryItems([
      {
        path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify',
        isUninstallEntry: true
      }
    ]);
    expect(items[0].isUninstallEntry).toBe(true);
  });

  it('drops the fields that say nothing', () => {
    // PowerShell emits every property of the object it was given, so a
    // plain key arrives carrying valueName:null and isUninstallEntry:false.
    const items = normalizeRegistryItems([
      { path: 'HKEY_CURRENT_USER\\Software\\Spotify', valueName: null, isUninstallEntry: false }
    ]);
    expect(items).toEqual([{ path: 'HKEY_CURRENT_USER\\Software\\Spotify' }]);
  });

  it('drops entries with no path at all', () => {
    expect(normalizeRegistryItems([{ path: '' }, {}, null, { path: null, valueName: 'x' }])).toEqual([]);
  });

  it('copes with no input', () => {
    expect(normalizeRegistryItems(null)).toEqual([]);
  });
});

describe('scanRegistryLeftovers', () => {
  it('never runs PowerShell for an empty search pattern', async () => {
    // An empty pattern matches every key under HKLM\Software -- it would
    // offer the entire machine as removable leftovers.
    expect(await scanRegistryLeftovers('', '')).toEqual({ ok: true, items: [] });
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });

  it('wraps a lone result object into a list', async () => {
    // ConvertTo-Json emits a bare object, not an array, for one match.
    runPowerShellJsonMock.mockResolvedValueOnce({ path: 'HKEY_CURRENT_USER\\Software\\OldApp' });
    const result = await scanRegistryLeftovers('OldApp', 'Old Inc');
    expect(result).toEqual({ ok: true, items: [{ path: 'HKEY_CURRENT_USER\\Software\\OldApp' }] });
  });

  it('treats no matches as an empty success, not a failure', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    expect(await scanRegistryLeftovers('OldApp', 'Old Inc')).toEqual({ ok: true, items: [] });
  });

  it('searches on the publisher as well as the name', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    await scanRegistryLeftovers('OldApp', 'Old Inc');
    // The pattern itself is leftoverPattern.js's business and tested
    // there -- what matters here is that both terms reach the script.
    const script = runPowerShellJsonMock.mock.calls[0][0];
    expect(script).toContain(buildSearchPattern('OldApp', 'Old Inc'));
    expect(script).toContain('OldApp');
    expect(script).toContain('Old Inc');
  });

  it('escapes regex metacharacters in the program name', async () => {
    // "Rainbow Six (R) Siege" contains parentheses, which are a capture
    // group to -match, not literal text.
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    await scanRegistryLeftovers('Rainbow Six (R) Siege', null);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain('Rainbow Six \\(R\\) Siege');
  });
});

describe('buildRegistryScript', () => {
  // Built inside each test, not at collection time: the module is
  // imported fresh in beforeEach so the mock is in place.
  const script = () => buildRegistryScript('OldApp');

  // Each of these is a place Revo Uninstaller Pro finds leftovers and the
  // original two-root scan (HKCU:\Software and HKLM:\Software, one level
  // deep, key names only) could not.
  it.each([
    ['the 32-bit software view', 'WOW6432Node'],
    ['per-user file associations', "'HKCU:\\Software\\Classes'"],
    ['machine-wide file associations', "'HKLM:\\Software\\Classes'"],
    ['the Add/Remove Programs entry', 'CurrentVersion\\Uninstall'],
    ['startup entries', "CurrentVersion\\Run'"],
    ['startup entries that only run once', 'CurrentVersion\\RunOnce'],
    ["Windows' executable search path", 'App Paths']
  ])('covers %s', (_label, expected) => {
    expect(script()).toContain(expected);
  });

  it('quotes every root, because one of them has a space in its name', () => {
    // The file scan shipped broken for a week because "Start Menu" was
    // interpolated bare and its space split the array literal in two.
    expect(script()).toContain("'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths'");
  });

  it('matches an uninstall entry on its DisplayName, not just its key name', () => {
    // An MSI's key is a GUID. Its DisplayName is the only part of it that
    // carries the program's name.
    expect(script()).toContain("GetValue('DisplayName')");
  });

  it('reads a startup entry by its command as well as its value name', () => {
    // Roughly half are named for the vendor and half for the executable
    // they launch, so the command line has to be searched too.
    expect(script()).toContain('$data = [string]$key.GetValue($valueName)');
    expect(script()).toContain('$valueName -match $pattern -or $data -match $pattern');
  });

  it('descends a second level for software that nests product under vendor', () => {
    expect(script()).toContain('$vendor.PSPath');
  });

  it('does not walk WOW6432Node or Classes twice', () => {
    // Both are children of HKLM:\Software AND roots in their own right, so
    // the depth-2 pass would otherwise re-enumerate them as vendors.
    expect(script()).toContain("$vendor.PSChildName -match '^(Classes|WOW6432Node)$'");
  });
});
