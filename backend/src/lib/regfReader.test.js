import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { openHive, readUninstallEntries } from './regfReader.js';
import { buildHive, uninstallTree } from '../testSupport/regfBuilder.js';


describe('regfReader', () => {
  it('reads keys, string, number and list values, and the Add/Remove entries', () => {
    const hive = buildHive(uninstallTree({
      Discord: { $values: { DisplayName: 'Discord', Publisher: 'Discord Inc.', EstimatedSize: 109438, InstallLocation: 'C:\\Users\\nikos\\AppData\\Local\\Discord' } },
      '{GUID-1}': { $values: { DisplayName: 'Tool', Tags: ['a', 'b'] } }
    }));
    const { dirty, entries } = readUninstallEntries(hive);
    expect(dirty).toBe(false);
    expect(entries).toEqual([
      { keyName: 'Discord', DisplayName: 'Discord', Publisher: 'Discord Inc.', EstimatedSize: '109438', InstallLocation: 'C:\\Users\\nikos\\AppData\\Local\\Discord' },
      { keyName: '{GUID-1}', DisplayName: 'Tool', Tags: 'a b' }
    ]);
  });

  it('walks every kind of subkey list', () => {
    const apps = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((n) => [n, { $values: { DisplayName: `App ${n}` } }]));
    for (const subkeyList of ['lh', 'lf', 'li', 'ri']) {
      const names = readUninstallEntries(buildHive(uninstallTree(apps), { subkeyList })).entries.map((e) => e.DisplayName);
      expect(names, subkeyList).toEqual(['App A', 'App B', 'App C', 'App D', 'App E']);
    }
  });

  it('reads big data split across segments, and UTF-16 names', () => {
    const long = 'x'.repeat(20000);
    const hive = buildHive(uninstallTree({ 'Ελληνικά': { $values: { DisplayName: 'Πρόγραμμα', Notes: long } } }));
    const [entry] = readUninstallEntries(hive).entries;
    expect(entry.keyName).toBe('Ελληνικά');
    expect(entry.DisplayName).toBe('Πρόγραμμα');
    expect(entry.Notes).toHaveLength(20000);
  });

  it('says when a hive was not flushed, and reads no Uninstall key as none', () => {
    const hive = buildHive({ Software: {} }, { dirty: true });
    expect(readUninstallEntries(hive)).toEqual({ dirty: true, entries: [] });
  });

  it('refuses what is not a hive', () => {
    expect(() => openHive(Buffer.from('not a hive'))).toThrow(/Not a registry hive/);
  });

  // The Default profile's hive is readable by every account on every Windows.
  it.skipIf(!existsSync('C:\\Users\\Default\\NTUSER.DAT'))('reads a real NTUSER.DAT', () => {
    const root = openHive(readFileSync('C:\\Users\\Default\\NTUSER.DAT')).root();
    expect(root.subkeys().map((k) => k.name)).toEqual(expect.arrayContaining(['Control Panel', 'Software']));
    expect(root.subkey('Software\\Microsoft\\Windows\\CurrentVersion')).not.toBeNull();
    expect(Object.keys(root.subkey('Control Panel\\Desktop').values()).length).toBeGreaterThan(5);
  });
});
