import { describe, it, expect } from 'vitest';
import {
  FAST_SCAN_DURATION_KEY, sanitizeFastScanMs, readFastScanMs, writeFastScanMs, fastScanEstimate
} from './fastScanDuration.js';

const memory = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

describe('sanitizeFastScanMs', () => {
  it('accepts a sane duration and rounds it', () => {
    expect(sanitizeFastScanMs(8000)).toBe(8000);
    expect(sanitizeFastScanMs('8000.4')).toBe(8000);
  });

  it('rejects garbage, negatives, zero and non-numbers', () => {
    for (const bad of [null, undefined, NaN, Infinity, -5, 0, '', '  ', 'abc', {}, [], true]) {
      expect(sanitizeFastScanMs(bad)).toBeNull();
    }
  });

  it('clamps an absurd value instead of trusting it', () => {
    expect(sanitizeFastScanMs(3)).toBe(1000);
    expect(sanitizeFastScanMs(10 ** 12)).toBe(10 * 60_000);
  });
});

describe('readFastScanMs / writeFastScanMs', () => {
  it('round-trips through storage', () => {
    const s = memory();
    expect(writeFastScanMs(s, 12_345)).toBe(true);
    expect(readFastScanMs(s)).toBe(12_345);
  });

  it('reads a missing or corrupt value as absent', () => {
    expect(readFastScanMs(memory())).toBeNull();
    expect(readFastScanMs(memory({ [FAST_SCAN_DURATION_KEY]: 'banana' }))).toBeNull();
    expect(readFastScanMs(memory({ [FAST_SCAN_DURATION_KEY]: '-400' }))).toBeNull();
    expect(readFastScanMs(memory({ [FAST_SCAN_DURATION_KEY]: '999999999999' }))).toBe(10 * 60_000);
  });

  it('never stores a value that is not a real duration', () => {
    const s = memory();
    expect(writeFastScanMs(s, NaN)).toBe(false);
    expect(writeFastScanMs(s, -1)).toBe(false);
    expect(s.data).toEqual({});
  });

  it('survives storage that throws, in either direction', () => {
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readFastScanMs(throwing)).toBeNull();
    expect(writeFastScanMs(throwing, 5000)).toBe(false);
    expect(readFastScanMs(undefined)).toBeNull();
  });
});

describe('fastScanEstimate', () => {
  it('gives NO number when nothing is remembered', () => {
    expect(fastScanEstimate({ expectedMs: null, elapsedMs: 3000 })).toEqual({ state: 'none' });
    expect(fastScanEstimate({ expectedMs: NaN, elapsedMs: 3000 })).toEqual({ state: 'none' });
  });

  it('counts down against the remembered duration', () => {
    expect(fastScanEstimate({ expectedMs: 10_000, elapsedMs: 0 })).toEqual({ state: 'left', seconds: 10 });
    expect(fastScanEstimate({ expectedMs: 10_000, elapsedMs: 4000 })).toEqual({ state: 'left', seconds: 6 });
    expect(fastScanEstimate({ expectedMs: 10_000, elapsedMs: 9500 })).toEqual({ state: 'left', seconds: 1 });
  });

  it('says it is running long instead of sitting on zero', () => {
    expect(fastScanEstimate({ expectedMs: 10_000, elapsedMs: 10_000 })).toEqual({ state: 'overrun' });
    expect(fastScanEstimate({ expectedMs: 10_000, elapsedMs: 90_000 })).toEqual({ state: 'overrun' });
  });
});
