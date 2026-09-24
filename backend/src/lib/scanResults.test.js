import { describe, it, expect } from 'vitest';
import { putScanResult, getScanResult, SCAN_RESULT_TTL_MS, SCAN_RESULT_CAP } from './scanResults.js';

describe('scanResults', () => {
  it('stores a tree and returns it by id', () => {
    const tree = { name: 'a', size: 1 };
    const id = putScanResult(tree, 0);
    expect(typeof id).toBe('string');
    expect(getScanResult(id, 1)).toBe(tree);
  });

  it('gives distinct ids', () => {
    expect(putScanResult({}, 0)).not.toBe(putScanResult({}, 0));
  });

  it('returns undefined for an unknown id', () => {
    expect(getScanResult('nope', 0)).toBeUndefined();
  });

  it('does not delete on read, so a retry works', () => {
    const id = putScanResult({ n: 1 }, 0);
    expect(getScanResult(id, 1)).toBeDefined();
    expect(getScanResult(id, 2)).toBeDefined();
  });

  it('expires after the 2-minute TTL', () => {
    expect(SCAN_RESULT_TTL_MS).toBe(120_000);
    const id = putScanResult({ n: 1 }, 1000);
    expect(getScanResult(id, 1000 + SCAN_RESULT_TTL_MS - 1)).toBeDefined();
    expect(getScanResult(id, 1000 + SCAN_RESULT_TTL_MS + 1)).toBeUndefined();
  });

  it('keeps at most 2 results, evicting the oldest', () => {
    expect(SCAN_RESULT_CAP).toBe(2);
    const a = putScanResult({ n: 'a' }, 10_000_000);
    const b = putScanResult({ n: 'b' }, 10_000_001);
    const c = putScanResult({ n: 'c' }, 10_000_002);
    expect(getScanResult(a, 10_000_003)).toBeUndefined();
    expect(getScanResult(b, 10_000_003)).toBeDefined();
    expect(getScanResult(c, 10_000_003)).toBeDefined();
  });

  it('drops expired entries on insert so they do not count toward the cap', () => {
    const old = putScanResult({ n: 'old' }, 20_000_000);
    const fresh1 = putScanResult({ n: 'f1' }, 20_000_000 + SCAN_RESULT_TTL_MS + 5);
    const fresh2 = putScanResult({ n: 'f2' }, 20_000_000 + SCAN_RESULT_TTL_MS + 6);
    expect(getScanResult(old, 20_000_000 + SCAN_RESULT_TTL_MS + 7)).toBeUndefined();
    expect(getScanResult(fresh1, 20_000_000 + SCAN_RESULT_TTL_MS + 7)).toBeDefined();
    expect(getScanResult(fresh2, 20_000_000 + SCAN_RESULT_TTL_MS + 7)).toBeDefined();
  });
});
