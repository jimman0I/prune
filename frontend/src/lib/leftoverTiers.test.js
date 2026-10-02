import { describe, it, expect } from 'vitest';
import { TIERS, tierOf, hasTiers, preselectKeys, protectedCount } from './leftoverTiers.js';
import { mergeLeftovers } from './mergeLeftovers.js';

const scan = {
  files: { ok: true, items: [
    { path: 'D:\\Own', confidence: 'certain' },
    { path: 'D:\\ByName', confidence: 'likely' },
    { path: 'D:\\ByPublisher', confidence: 'possible' }
  ] },
  registryKeys: { ok: true, items: [
    { path: 'HKCU\\A', confidence: 'possible' },
    { path: 'HKCU\\B', confidence: 'certain' }
  ] },
  scheduledTasks: { ok: true, items: [{ name: 'T', path: '\\', confidence: 'likely' }] }
};

describe('tiers', () => {
  it('are ordered from most to least sure', () => {
    expect(TIERS).toEqual(['certain', 'likely', 'possible']);
  });

  it('read an item\'s tier, treating an untiered item as likely', () => {
    expect(tierOf({ confidence: 'certain' })).toBe('certain');
    expect(tierOf({ confidence: 'possible' })).toBe('possible');
    expect(tierOf({ path: 'x' })).toBe('likely');
    expect(tierOf({ confidence: 'bogus' })).toBe('likely');
  });

  it('say whether a scan carries tiers at all', () => {
    expect(hasTiers(scan)).toBe(true);
    expect(hasTiers({ files: { ok: true, items: [{ path: 'x' }] } })).toBe(false);
    expect(hasTiers(null)).toBe(false);
  });
});

describe('preselectKeys', () => {
  it('ticks certain and likely items and never possible ones', () => {
    expect([...preselectKeys(scan)].sort()).toEqual(['files:0', 'files:1', 'registryKeys:1'].sort());
  });

  it('can be asked about other groups too', () => {
    expect([...preselectKeys(scan, ['scheduledTasks'])]).toEqual(['scheduledTasks:0']);
  });

  it('ticks everything in a scan with no tiers, as before', () => {
    const plain = { files: { ok: true, items: [{ path: 'a' }, { path: 'b' }] }, registryKeys: { ok: true, items: [{ path: 'k' }] } };
    expect([...preselectKeys(plain)].sort()).toEqual(['files:0', 'files:1', 'registryKeys:0']);
  });

  it('ignores a group that failed or is missing', () => {
    expect(preselectKeys({ files: { ok: false, items: [] } }).size).toBe(0);
    expect(preselectKeys({}).size).toBe(0);
  });
});

describe('protectedCount', () => {
  it('adds up what the scan held back', () => {
    expect(protectedCount({ files: { protected: 2 }, registryKeys: { protected: 1 }, scheduledTasks: {} })).toBe(3);
    expect(protectedCount({})).toBe(0);
  });
});

describe('mergeLeftovers keeps the tiers and the counts', () => {
  it('carries confidence through and adds up protected', () => {
    const merged = mergeLeftovers([
      { program: 'A', scan: { ...scan, files: { ...scan.files, protected: 2 } } },
      { program: 'B', scan: { files: { ok: true, items: [], protected: 1, truncated: true }, registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] } } }
    ]);
    expect(merged.files.items[0].confidence).toBe('certain');
    expect(merged.files.protected).toBe(3);
    expect(merged.files.truncated).toBe(true);
  });

  it('keeps the surest tier when two programs report the same path', () => {
    const merged = mergeLeftovers([
      { program: 'A', scan: { files: { ok: true, items: [{ path: 'D:\\X', confidence: 'possible' }] } } },
      { program: 'B', scan: { files: { ok: true, items: [{ path: 'D:\\X', confidence: 'certain' }] } } }
    ]);
    expect(merged.files.items).toHaveLength(1);
    expect(merged.files.items[0].confidence).toBe('certain');
  });
});
