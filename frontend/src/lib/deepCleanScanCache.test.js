import { describe, it, expect } from 'vitest';
import {
  SCAN_CACHE_KEY, SCAN_CACHE_MAX_CHARS,
  scanFingerprint, rulesSignature,
  saveScanCache, loadScanCache, readFreshScanCache, applyScanCache, snapshotRules
} from './deepCleanScanCache.js';

/** Deep Clean remembers its last scan, so that opening the screen is not a
 * twenty-second disk walk every launch. What it remembers has to be small,
 * has to be thrown away the moment it could be wrong, and must never be able
 * to break the screen it is meant to speed up. */

/** A Storage that lives in a plain object, so a test can look at exactly what
 * was written. */
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

const throwingStorage = () => ({
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('quota'); },
  removeItem() { throw new Error('denied'); }
});

const listed = [
  {
    category: 'Windows',
    items: [
      { id: 'temp', name: 'Temporary files', category: 'Windows', paths: ['%TEMP%'], sizeBytes: null, fileCount: null, present: true },
      { id: 'thumbs', name: 'Thumbnail cache', category: 'Windows', paths: ['%LOCALAPPDATA%\\thumbs'], sizeBytes: null, fileCount: null, present: true }
    ]
  },
  {
    category: 'Brave',
    items: [{ id: 'brave-cache', name: 'Cache', category: 'Brave', paths: ['x'], sizeBytes: null, fileCount: null, present: false }]
  }
];

const scanned = [
  {
    category: 'Windows',
    items: [
      {
        ...listed[0].items[0], sizeBytes: 5000, fileCount: 12, heldCount: 1, present: true, accessible: true,
        filesListed: true, files: [{ path: 'C:\\Temp\\a.tmp', sizeBytes: 4000 }]
      },
      { ...listed[0].items[1], sizeBytes: 0, fileCount: 0, present: true, accessible: true }
    ]
  },
  {
    category: 'Brave',
    items: [{ ...listed[1].items[0], sizeBytes: 0, fileCount: 0, present: false, accessible: true }]
  }
];

const settings = {
  excludeFolders: ['D:\\Keep'], excludeExtensions: ['.iso'], skipRecentHours: 24,
  hideUnavailableRules: true, customLocations: [], cookieKeepList: []
};

describe('scanFingerprint', () => {
  const base = () => scanFingerprint({ settings, rules: listed, appVersion: '3.0.0' });

  it('is the same for the same inputs', () => {
    expect(base()).toBe(base());
  });

  it('ignores what a scan fills in, so a measured tree and a listed one agree', () => {
    expect(scanFingerprint({ settings, rules: scanned, appVersion: '3.0.0' })).toBe(base());
  });

  it('ignores the order of the exclusion lists', () => {
    const a = scanFingerprint({ settings: { ...settings, excludeFolders: ['a', 'b'] }, rules: listed, appVersion: '1' });
    const b = scanFingerprint({ settings: { ...settings, excludeFolders: ['b', 'a'] }, rules: listed, appVersion: '1' });
    expect(a).toBe(b);
  });

  it.each([
    ['an excluded folder', { excludeFolders: ['D:\\Keep', 'E:\\More'] }],
    ['an excluded extension', { excludeExtensions: ['.iso', '.vhd'] }],
    ['the recent-files window', { skipRecentHours: 48 }],
    ['hiding unavailable rules', { hideUnavailableRules: false }],
    ['a custom location', { customLocations: [{ path: 'D:\\Scratch' }] }],
    ['the cookie keep list', { cookieKeepList: ['example.com'] }]
  ])('changes with %s', (_, change) => {
    expect(scanFingerprint({ settings: { ...settings, ...change }, rules: listed, appVersion: '3.0.0' })).not.toBe(base());
  });

  it('changes with the app version', () => {
    expect(scanFingerprint({ settings, rules: listed, appVersion: '3.0.1' })).not.toBe(base());
  });

  it('changes when a rule is added, removed, or has its definition edited', () => {
    const extra = [...listed, { category: 'Mine', items: [{ id: 'custom', name: 'Mine', paths: ['D:\\x'] }] }];
    expect(scanFingerprint({ settings, rules: extra, appVersion: '3.0.0' })).not.toBe(base());
    expect(scanFingerprint({ settings, rules: listed.slice(0, 1), appVersion: '3.0.0' })).not.toBe(base());
    const edited = structuredClone(listed);
    edited[0].items[0].paths = ['%TEMP%\\other'];
    expect(scanFingerprint({ settings, rules: edited, appVersion: '3.0.0' })).not.toBe(base());
  });

  it('treats missing settings as the defaults rather than throwing', () => {
    expect(() => scanFingerprint({ settings: undefined, rules: listed, appVersion: '3.0.0' })).not.toThrow();
    expect(rulesSignature(undefined)).toBe(rulesSignature([]));
  });
});

describe('saving and loading the remembered scan', () => {
  it('round-trips what the tree needs to draw its sizes', () => {
    const storage = fakeStorage();
    expect(saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1700000000000 }, storage)).toBe(true);
    const cache = loadScanCache(storage);
    expect(cache.savedAt).toBe(1700000000000);
    expect(cache.fingerprint).toBe('fp');
    expect(cache.rules.temp).toMatchObject({ sizeBytes: 5000, fileCount: 12, heldCount: 1, present: true, accessible: true, filesListed: true });
    expect(cache.rules['brave-cache']).toMatchObject({ sizeBytes: 0, present: false });
  });

  it('keeps the per-file lists, names and paths out of storage', () => {
    const storage = fakeStorage();
    saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1 }, storage);
    const raw = storage.data[SCAN_CACHE_KEY];
    expect(raw).not.toContain('a.tmp');
    expect(raw).not.toContain('Temporary files');
    expect(raw).not.toContain('%TEMP%');
  });

  it('remembers a partial result as partial and a cleaned-but-unmeasured row as such', () => {
    const tree = [{ category: 'X', items: [
      { id: 'a', sizeBytes: 900, fileCount: 3, present: true, accessible: true, incomplete: 'cap' },
      { id: 'b', sizeBytes: null, fileCount: null, present: true, accessible: true, rescanNeeded: true },
      { id: 'c', sizeBytes: 10, fileCount: 1, present: true, accessible: false }
    ] }];
    const storage = fakeStorage();
    saveScanCache({ tree, fingerprint: 'fp', savedAt: 1 }, storage);
    const { rules } = loadScanCache(storage);
    expect(rules.a.incomplete).toBe('cap');
    expect(rules.b.rescanNeeded).toBe(true);
    expect(rules.b.sizeBytes).toBeNull();
    expect(rules.c.accessible).toBe(false);
  });

  it('does not write rows that were never measured', () => {
    const storage = fakeStorage();
    // A listed-only tree has nothing worth remembering.
    expect(saveScanCache({ tree: listed, fingerprint: 'fp', savedAt: 1 }, storage)).toBe(false);
    expect(storage.data[SCAN_CACHE_KEY]).toBeUndefined();
  });

  it('refuses something past the size cap, and drops the older entry rather than leave it to be trusted', () => {
    const storage = fakeStorage();
    saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1 }, storage);
    expect(storage.data[SCAN_CACHE_KEY]).toBeDefined();
    const huge = [{ category: 'X', items: Array.from({ length: 5000 }, (_, i) => ({ id: `rule-${i}-${'x'.repeat(60)}`, sizeBytes: i, fileCount: i, present: true, accessible: true })) }];
    expect(saveScanCache({ tree: huge, fingerprint: 'fp', savedAt: 2 }, storage)).toBe(false);
    expect(storage.data[SCAN_CACHE_KEY]).toBeUndefined();
    expect(SCAN_CACHE_MAX_CHARS).toBeLessThan(1_000_000);
  });

  it('stays small for a realistic number of rules', () => {
    const items = Array.from({ length: 90 }, (_, i) => ({ id: `some-rule-${i}`, sizeBytes: i * 1234567, fileCount: i * 100, heldCount: 0, present: true, accessible: true, filesListed: true, files: [{ path: 'x'.repeat(200), sizeBytes: 1 }] }));
    const storage = fakeStorage();
    expect(saveScanCache({ tree: [{ category: 'X', items }], fingerprint: 'fp', savedAt: 1 }, storage)).toBe(true);
    expect(storage.data[SCAN_CACHE_KEY].length).toBeLessThan(20_000);
  });

  it('reads nothing back when storage throws, and writing does not throw', () => {
    const storage = throwingStorage();
    expect(() => saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1 }, storage)).not.toThrow();
    expect(saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1 }, storage)).toBe(false);
    expect(loadScanCache(storage)).toBeNull();
  });

  it('copes with there being no storage at all', () => {
    expect(saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1 }, null)).toBe(false);
    expect(loadScanCache(null)).toBeNull();
  });

  it.each([
    ['not JSON', '{nope'],
    ['not an object', '[1,2,3]'],
    ['null', 'null'],
    ['an unknown version', JSON.stringify({ version: 99, savedAt: 1, fingerprint: 'fp', rules: { a: { sizeBytes: 1 } } })],
    ['no timestamp', JSON.stringify({ version: 1, fingerprint: 'fp', rules: { a: { sizeBytes: 1 } } })],
    ['a non-numeric timestamp', JSON.stringify({ version: 1, savedAt: 'yesterday', fingerprint: 'fp', rules: { a: { sizeBytes: 1 } } })],
    ['no fingerprint', JSON.stringify({ version: 1, savedAt: 1, rules: { a: { sizeBytes: 1 } } })],
    ['rules that are not an object', JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: [] })],
    ['no rules', JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: {} })],
    ['a negative size', JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: { a: { sizeBytes: -5 } } })],
    ['a string size', JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: { a: { sizeBytes: '5' } } })],
    ['a rule that is not an object', JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: { a: 7 } })],
    ['a flag of the wrong type', JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: { a: { sizeBytes: 1, present: 'yes' } } })]
  ])('ignores a stored value that is %s', (_, raw) => {
    expect(loadScanCache(fakeStorage({ [SCAN_CACHE_KEY]: raw }))).toBeNull();
  });

  it('ignores unknown fields instead of carrying them into the tree', () => {
    const raw = JSON.stringify({ version: 1, savedAt: 5, fingerprint: 'fp', rules: { a: { sizeBytes: 1, present: true, evil: '<script>', files: [{ path: 'x' }] } } });
    const cache = loadScanCache(fakeStorage({ [SCAN_CACHE_KEY]: raw }));
    expect(cache.rules.a).toEqual({ sizeBytes: 1, present: true });
  });

  it('ignores a stored value that is far too large to be ours', () => {
    const raw = JSON.stringify({ version: 1, savedAt: 1, fingerprint: 'fp', rules: { a: { sizeBytes: 1 } }, pad: 'x'.repeat(SCAN_CACHE_MAX_CHARS) });
    expect(loadScanCache(fakeStorage({ [SCAN_CACHE_KEY]: raw }))).toBeNull();
  });
});

describe('applying a remembered scan to the listed rules', () => {
  it('marks each remembered row fromCache and leaves the rule definition alone', () => {
    const storage = fakeStorage();
    saveScanCache({ tree: scanned, fingerprint: 'fp', savedAt: 1 }, storage);
    const tree = applyScanCache(listed, loadScanCache(storage));
    const temp = tree[0].items[0];
    expect(temp).toMatchObject({ id: 'temp', name: 'Temporary files', paths: ['%TEMP%'], sizeBytes: 5000, fileCount: 12, fromCache: true });
    expect(temp.files).toBeUndefined();
    expect(tree[1].items[0]).toMatchObject({ present: false, sizeBytes: 0, fromCache: true });
  });

  it('does not mutate the listed tree', () => {
    const before = structuredClone(listed);
    applyScanCache(listed, { savedAt: 1, fingerprint: 'fp', rules: { temp: { sizeBytes: 1 } } });
    expect(listed).toEqual(before);
  });

  it('is a miss when none of the remembered rules are in the listing', () => {
    expect(applyScanCache(listed, { savedAt: 1, fingerprint: 'fp', rules: { gone: { sizeBytes: 1 } } })).toBeNull();
  });

  it('snapshotRules keeps only measured rows', () => {
    expect(Object.keys(snapshotRules(scanned)).sort()).toEqual(['brave-cache', 'temp', 'thumbs']);
    expect(snapshotRules(listed)).toEqual({});
  });
});

describe('readFreshScanCache', () => {
  const fp = scanFingerprint({ settings, rules: listed, appVersion: '3.0.0' });

  it('returns the tree and when it was measured when the fingerprint matches', () => {
    const storage = fakeStorage();
    saveScanCache({ tree: scanned, fingerprint: fp, savedAt: 1234 }, storage);
    const fresh = readFreshScanCache({ fingerprint: fp, listedTree: listed }, storage);
    expect(fresh.savedAt).toBe(1234);
    expect(fresh.tree[0].items[0]).toMatchObject({ sizeBytes: 5000, fromCache: true });
  });

  it('is a miss, not an error, when the fingerprint differs (stale)', () => {
    const storage = fakeStorage();
    saveScanCache({ tree: scanned, fingerprint: 'an-older-one', savedAt: 1234 }, storage);
    expect(readFreshScanCache({ fingerprint: fp, listedTree: listed }, storage)).toBeNull();
  });

  it('is a miss when nothing was stored', () => {
    expect(readFreshScanCache({ fingerprint: fp, listedTree: listed }, fakeStorage())).toBeNull();
  });

  it('is a miss when storage throws', () => {
    expect(readFreshScanCache({ fingerprint: fp, listedTree: listed }, throwingStorage())).toBeNull();
  });
});
