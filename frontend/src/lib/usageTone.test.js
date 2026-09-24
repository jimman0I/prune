import { describe, it, expect } from 'vitest';
import { storageBarColor, gaugeColor, NEUTRAL, WARN } from './usageTone.js';

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

describe('gaugeColor', () => {
  it('keeps the gauge\'s own hue below 85%', () => {
    expect(gaugeColor(84, 'var(--accent-blue)')).toBe('var(--accent-blue)');
    expect(gaugeColor(0, 'var(--accent-blue)')).toBe('var(--accent-blue)');
  });

  it('goes amber from 85% up', () => {
    expect(gaugeColor(85, 'var(--accent-blue)')).toBe(WARN);
    expect(gaugeColor(100)).toBe(WARN);
  });

  it('defaults to neutral, not the primary accent', () => {
    expect(gaugeColor(10)).toBe(NEUTRAL);
  });

  it('keeps the base when there is no reading', () => {
    expect(gaugeColor(null, 'var(--accent-purple)')).toBe('var(--accent-purple)');
    expect(gaugeColor(NaN)).toBe(NEUTRAL);
  });
});
