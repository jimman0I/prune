import { describe, it, expect } from 'vitest';
import { storageBarColor, NEUTRAL, WARN } from './usageTone.js';

describe('storageBarColor', () => {
  it('stays neutral while at least 10% is free', () => {
    expect(storageBarColor(100, 1000)).toBe(NEUTRAL);
    expect(storageBarColor(500, 1000)).toBe(NEUTRAL);
  });

  it('turns amber only below 10% free', () => {
    expect(storageBarColor(99, 1000)).toBe(WARN);
    expect(storageBarColor(0, 1000)).toBe(WARN);
  });

  it('is never the primary accent, and never red', () => {
    for (const free of [0, 50, 99, 100, 900]) {
      const colour = storageBarColor(free, 1000);
      expect(colour).not.toContain('accent-primary');
      expect(colour).not.toContain('danger');
    }
  });

  it('has nothing to warn about when the size is unknown', () => {
    expect(storageBarColor(undefined, 1000)).toBe(NEUTRAL);
    expect(storageBarColor(10, 0)).toBe(NEUTRAL);
  });
});
