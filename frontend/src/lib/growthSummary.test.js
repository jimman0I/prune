import { describe, it, expect } from 'vitest';
import {
  GROWTH_ROWS, GROWTH_MIN_BYTES, growthRows, growthCaveats, drillPathFor, signedBytes,
  GROWTH_COLLAPSED_KEY, readGrowthCollapsed, writeGrowthCollapsed
} from './growthSummary.js';

const MB = 1024 * 1024;
const cmp = (extra = {}) => ({
  delta: 10 * MB, grew: [], added: [], shrank: [], removed: [], ...extra
});

describe('growthRows', () => {
  it('takes the folders that grew, biggest first, at most five', () => {
    const grew = Array.from({ length: 8 }, (_, i) => ({ path: `C:\\Users\\f${i}`, before: 0, after: (i + 2) * MB, delta: (i + 2) * MB }));
    const rows = growthRows(cmp({ grew }));
    expect(GROWTH_ROWS).toBe(5);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.path)).toEqual(['C:\\Users\\f7', 'C:\\Users\\f6', 'C:\\Users\\f5', 'C:\\Users\\f4', 'C:\\Users\\f3']);
    expect(rows[0]).toEqual({ path: 'C:\\Users\\f7', delta: 9 * MB, isNew: false });
  });

  it('counts a folder that only exists in the newer scan as growth, marked new', () => {
    const rows = growthRows(cmp({
      grew: [{ path: 'C:\\Old', before: MB, after: 4 * MB, delta: 3 * MB }],
      added: [{ path: 'C:\\Fresh', size: 8 * MB }]
    }));
    expect(rows.map((r) => [r.path, r.delta, r.isNew])).toEqual([['C:\\Fresh', 8 * MB, true], ['C:\\Old', 3 * MB, false]]);
  });

  it('leaves out the drive itself, which only repeats the total', () => {
    const rows = growthRows(cmp({ grew: [{ path: 'C:', delta: 5 * MB }, { path: 'C:\\Games', delta: 4 * MB }] }));
    expect(rows.map((r) => r.path)).toEqual(['C:\\Games']);
  });

  it('ignores growth below a megabyte, which is the drive breathing', () => {
    expect(GROWTH_MIN_BYTES).toBe(MB);
    const rows = growthRows(cmp({ grew: [{ path: 'C:\\Tiny', delta: MB - 1 }, { path: 'C:\\Edge', delta: MB }] }));
    expect(rows.map((r) => r.path)).toEqual(['C:\\Edge']);
  });

  it('does not list what shrank or went away', () => {
    expect(growthRows(cmp({ shrank: [{ path: 'C:\\S', delta: -9 * MB }], removed: [{ path: 'C:\\R', size: 9 * MB }] }))).toEqual([]);
  });

  it('copes with a comparison missing its lists', () => {
    expect(growthRows({})).toEqual([]);
    expect(growthRows(null)).toEqual([]);
  });
});

describe('growthCaveats', () => {
  const meta = (extra = {}) => ({ source: 'fast', truncated: false, capacityBytes: 1000, ...extra });

  it('has none for two like scans of the same drive', () => {
    expect(growthCaveats(meta(), meta())).toEqual([]);
  });

  it('says when either scan was partial', () => {
    expect(growthCaveats(meta({ truncated: true }), meta())).toEqual(['partial']);
    expect(growthCaveats(meta(), meta({ truncated: true }))).toEqual(['partial']);
  });

  it('says when the drive is not the size it was', () => {
    expect(growthCaveats(meta({ capacityBytes: 1000 }), meta({ capacityBytes: 2000 }))).toEqual(['differentSize']);
  });

  it('does not guess at a size it was never told', () => {
    expect(growthCaveats(meta({ capacityBytes: null }), meta({ capacityBytes: 2000 }))).toEqual([]);
    expect(growthCaveats(meta({ capacityBytes: undefined }), meta())).toEqual([]);
  });

  it('says when one scan was a fast scan and the other a folder walk', () => {
    expect(growthCaveats(meta({ source: 'crawl' }), meta({ source: 'fast' }))).toEqual(['differentMethod']);
  });

  it('can name several', () => {
    expect(growthCaveats(meta({ truncated: true, source: 'crawl', capacityBytes: 5 }), meta())).toEqual(['partial', 'differentSize', 'differentMethod']);
  });
});

describe('drillPathFor', () => {
  it('opens a drive by its root path and any other folder as it is', () => {
    expect(drillPathFor('C:')).toBe('C:\\');
    expect(drillPathFor('C:\\Users\\me')).toBe('C:\\Users\\me');
  });
});

describe('signedBytes', () => {
  it('writes the sign and the size', () => {
    expect(signedBytes(2048)).toBe('+2 KB');
    expect(signedBytes(-300)).toBe('−300 B');
    expect(signedBytes(0)).toBe('0 B');
  });
});

describe('the remembered collapsed state', () => {
  const memory = (initial = {}) => {
    const data = { ...initial };
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  };

  it('is open until someone closes it, then stays closed', () => {
    const storage = memory();
    expect(readGrowthCollapsed(storage)).toBe(false);
    expect(writeGrowthCollapsed(storage, true)).toBe(true);
    expect(storage.data[GROWTH_COLLAPSED_KEY]).toBe('1');
    expect(readGrowthCollapsed(storage)).toBe(true);
    writeGrowthCollapsed(storage, false);
    expect(readGrowthCollapsed(storage)).toBe(false);
  });

  it('survives storage that throws or is missing', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readGrowthCollapsed(broken)).toBe(false);
    expect(writeGrowthCollapsed(broken, true)).toBe(false);
    expect(readGrowthCollapsed(null)).toBe(false);
    expect(writeGrowthCollapsed(null, true)).toBe(false);
  });
});
