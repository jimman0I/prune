import { describe, it, expect } from 'vitest';
import { withoutExcluded, registryExclusionPattern, isRegistryPathExcluded } from './leftoverExclusions.js';

const scan = () => ({
  mode: 'moderate',
  files: { ok: true, items: [{ path: 'D:\\Keep\\a.dll' }, { path: 'D:\\Keeper\\b.dll' }, { path: 'C:\\Other\\c.dll' }] },
  registryKeys: {
    ok: true,
    items: [
      { path: 'HKEY_CURRENT_USER\\Software\\Vendor' },
      { path: 'HKEY_CURRENT_USER\\Software\\Vendor\\Child' },
      { path: 'HKEY_CURRENT_USER\\Software\\VendorTwo' },
      { path: 'HKEY_LOCAL_MACHINE\\Software\\Vendor' },
      { path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Vendor' }
    ]
  },
  scheduledTasks: { ok: true, items: [{ name: 'VendorTask' }] }
});

describe('registryExclusionPattern', () => {
  it('reads every spelling of a hive, ignoring case and a trailing slash', () => {
    const want = registryExclusionPattern('HKCU\\Software\\Vendor');
    for (const spelling of ['hkcu:\\software\\vendor', 'HKEY_CURRENT_USER\\Software\\Vendor\\', 'HKCU:\\Software\\Vendor']) {
      expect(registryExclusionPattern(spelling)).toBe(want);
    }
  });

  it('refuses what would exclude the whole registry, or is not a key at all', () => {
    for (const bad of ['HKCU', 'HKCU\\', 'HKEY_LOCAL_MACHINE', 'D:\\Games', 'Software\\Vendor', '', '  ', null, undefined, 5]) {
      expect(registryExclusionPattern(bad)).toBeNull();
    }
  });
});

describe('isRegistryPathExcluded', () => {
  const patterns = [registryExclusionPattern('HKCU\\Software\\Vendor')];

  it('matches the key, its subkeys and values inside it, but never a sibling that shares a prefix', () => {
    expect(isRegistryPathExcluded('HKEY_CURRENT_USER\\Software\\Vendor', patterns)).toBe(true);
    expect(isRegistryPathExcluded('HKEY_CURRENT_USER\\SOFTWARE\\VENDOR\\Child\\Deeper', patterns)).toBe(true);
    expect(isRegistryPathExcluded('HKEY_CURRENT_USER\\Software\\VendorTwo', patterns)).toBe(false);
    expect(isRegistryPathExcluded('HKEY_LOCAL_MACHINE\\Software\\Vendor', patterns)).toBe(false);
  });

  it('matches nothing with no patterns', () => {
    expect(isRegistryPathExcluded('HKEY_CURRENT_USER\\Software\\Vendor', [])).toBe(false);
    expect(isRegistryPathExcluded('HKEY_CURRENT_USER\\Software\\Vendor', undefined)).toBe(false);
  });
});

describe('withoutExcluded', () => {
  it('passes the scan through untouched when nothing is excluded', () => {
    const result = scan();
    expect(withoutExcluded(result, {})).toBe(result);
    expect(withoutExcluded(result, { excludeFolders: [], excludeRegistryKeys: [] })).toBe(result);
    expect(withoutExcluded(result)).toBe(result);
  });

  it('leaves out folders at or under an excluded folder, and counts them', () => {
    const out = withoutExcluded(scan(), { excludeFolders: ['D:\\Keep'] });
    expect(out.files.items.map((i) => i.path)).toEqual(['D:\\Keeper\\b.dll', 'C:\\Other\\c.dll']);
    expect(out.files.excluded).toBe(1);
    expect(out.registryKeys.excluded).toBeUndefined();
  });

  it('leaves out an excluded registry key, its subkeys and its values, and counts them', () => {
    const out = withoutExcluded(scan(), { excludeRegistryKeys: ['HKCU\\Software\\Vendor'] });
    expect(out.registryKeys.items.map((i) => i.path)).toEqual([
      'HKEY_CURRENT_USER\\Software\\VendorTwo',
      'HKEY_LOCAL_MACHINE\\Software\\Vendor',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
    ]);
    expect(out.registryKeys.excluded).toBe(2);
    expect(out.files.items).toHaveLength(3);
  });

  it('excludes a single value by excluding the key that holds it', () => {
    const out = withoutExcluded(scan(), { excludeRegistryKeys: ['HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'] });
    expect(out.registryKeys.items.some((i) => i.valueName === 'Vendor')).toBe(false);
  });

  it('applies both lists at once and leaves tasks alone', () => {
    const out = withoutExcluded(scan(), { excludeFolders: ['C:\\Other'], excludeRegistryKeys: ['HKLM\\Software\\Vendor'] });
    expect(out.files.excluded).toBe(1);
    expect(out.registryKeys.excluded).toBe(1);
    expect(out.scheduledTasks.items).toHaveLength(1);
  });

  it('ignores entries that are not usable exclusions instead of excluding everything', () => {
    const result = scan();
    expect(withoutExcluded(result, { excludeRegistryKeys: ['HKCU', 'D:\\Games', '', null, 7] })).toBe(result);
  });

  it('passes a group that failed to scan straight through', () => {
    const failed = { files: { ok: false, error: 'boom' }, registryKeys: { ok: false, error: 'boom' }, mode: 'safe' };
    expect(withoutExcluded(failed, { excludeFolders: ['D:\\Keep'], excludeRegistryKeys: ['HKCU\\Software\\Vendor'] })).toEqual(failed);
  });
});
