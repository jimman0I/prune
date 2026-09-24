import { describe, it, expect } from 'vitest';
import { scanPercent } from './scanPercent.js';

describe('scanPercent', () => {
  it.each([null, undefined, 0, NaN, -5, Infinity, '100'])('is null when the in-use figure is %s', (inUse) => {
    expect(scanPercent(50, inUse)).toBeNull();
  });

  it('is 0 at 0 bytes', () => {
    expect(scanPercent(0, 1000)).toBe(0);
  });

  it('floors rather than rounds', () => {
    expect(scanPercent(199, 1000)).toBe(19);
    expect(scanPercent(1, 1000)).toBe(0);
    expect(scanPercent(989, 1000)).toBe(98);
  });

  it('caps at 99 when bytes reach or pass the in-use figure', () => {
    expect(scanPercent(1000, 1000)).toBe(99);
    expect(scanPercent(5000, 1000)).toBe(99);
  });

  it('never returns 100', () => {
    for (const bytes of [0, 990, 999, 1000, 1001, 1e12]) {
      expect(scanPercent(bytes, 1000)).toBeLessThan(100);
    }
  });
});
