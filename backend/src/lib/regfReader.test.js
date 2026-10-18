import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { openHive, readUninstallEntries, replayLogs } from './regfReader.js';
import { buildHive, uninstallTree, buildLog, markDirty } from '../testSupport/regfBuilder.js';


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
});

describe('journal replay', () => {
  // A hive whose newest change lives only in its journal: the base file
  // still has the old name in one page, the journal holds that page fixed.
  const fresh = buildHive(uninstallTree({ Discord: { $values: { DisplayName: 'Discord' } } }));
  const at = fresh.indexOf(Buffer.from('Discord', 'utf16le'), 4096);
  const pageStart = 4096 + Math.floor((at - 4096) / 512) * 512;
  const stale = Buffer.from(fresh);
  Buffer.from('Xiscord', 'utf16le').copy(stale, at);
  const page = { offset: pageStart - 4096, bytes: fresh.subarray(pageStart, pageStart + 512) };
  const binsSize = fresh.length - 4096;

  it('applies the journal to a dirty hive before reading it', () => {
    const dirty = markDirty(stale, 7);
    expect(readUninstallEntries(dirty).entries[0].DisplayName).toBe('Xiscord');
    const log = buildLog([{ sequence: 7, binsSize, pages: [page] }]);
    const { dirty: stillDirty, entries } = readUninstallEntries(dirty, { logs: [log] });
    expect(entries[0].DisplayName).toBe('Discord');
    expect(stillDirty).toBe(false);
  });

  it('runs on across both journals in sequence, and stops at a gap', () => {
    const dirty = markDirty(stale, 3);
    const noop = { offset: 0, bytes: fresh.subarray(4096, 4096 + 512) };
    // 3 in one journal, 4 (the fix) in the other: both apply.
    const run = replayLogs(dirty, [buildLog([{ sequence: 4, binsSize, pages: [page] }]), buildLog([{ sequence: 3, binsSize, pages: [noop] }])]);
    expect(run.replayed).toBe(2);
    expect(readUninstallEntries(run.buffer).entries[0].DisplayName).toBe('Discord');
    // 3 is missing: nothing after the gap is applied.
    const gap = replayLogs(dirty, [buildLog([{ sequence: 4, binsSize, pages: [page] }])]);
    expect(gap.replayed).toBe(0);
  });

  it('leaves a clean hive and a torn journal alone', () => {
    expect(replayLogs(fresh, [buildLog([{ sequence: 1, binsSize, pages: [page] }])]).buffer).toBe(fresh);
    const torn = buildLog([{ sequence: 7, binsSize, pages: [page] }]).subarray(0, 600);
    expect(replayLogs(markDirty(stale, 7), [torn]).replayed).toBe(0);
  });
});

describe('a real hive', () => {
  // The Default profile's hive is readable by every account on every Windows.
  // Its journals are passed, as the account scan does.
  const DEFAULT = 'C:\\Users\\Default\\NTUSER.DAT';
  it.skipIf(!existsSync(DEFAULT))('reads the Default profile, journals applied', () => {
    const logs = ['.LOG1', '.LOG2'].map((ext) => `${DEFAULT}${ext}`).filter((p) => existsSync(p)).map((p) => readFileSync(p));
    const hive = openHive(readFileSync(DEFAULT), { logs });
    const root = hive.root();
    const names = root.subkeys().map((k) => k.name);
    // What holds on every Windows: a root with keys, and the whole tree
    // readable. Not which keys: the build runner's Windows Server image has
    // no Software or Control Panel in its Default hive at all, journals
    // applied or not, while every desktop Windows has both.
    expect(names.length, names.join(', ')).toBeGreaterThan(3);
    if (names.includes('Software')) expect(root.subkey('Software\\Microsoft')).not.toBeNull();
    let keys = 0;
    let values = 0;
    const walk = (key, depth) => {
      keys += 1;
      values += Object.keys(key.values()).length;
      if (depth < 12) for (const child of key.subkeys()) walk(child, depth + 1);
    };
    walk(root, 0);
    expect(keys).toBeGreaterThan(20);
    expect(values).toBeGreaterThan(20);
  });
});
