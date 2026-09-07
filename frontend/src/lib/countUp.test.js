import { describe, it, expect } from 'vitest';
import { countUpValue, EASE_OUT_DURATION } from './countUp.js';

/** The interpolation behind an animated number.
 *
 * Kept apart from the hook that drives it because the maths is the part
 * with edge cases in it, and none of them need a frame loop to exercise.
 */

describe('countUpValue', () => {
  it('starts at the beginning and ends exactly on the target', () => {
    // Landing on 99.97% of the real figure would be worse than not
    // animating: the number on screen has to BE the number.
    expect(countUpValue(0, 500, 0)).toBe(0);
    expect(countUpValue(0, 500, 1)).toBe(500);
  });

  it('eases out rather than running linearly', () => {
    // Most of the distance in the first half is the whole point -- a
    // linear count reads as a progress bar, not as a value settling.
    const half = countUpValue(0, 100, 0.5);
    expect(half).toBeGreaterThan(50);
    expect(half).toBeLessThan(100);
  });

  it('counts down as readily as up', () => {
    expect(countUpValue(100, 0, 1)).toBe(0);
    expect(countUpValue(100, 0, 0.5)).toBeLessThan(50);
  });

  it('clamps progress outside 0..1', () => {
    // A tab left in the background can hand back a delta far past the
    // duration; overshooting would show a number larger than the truth.
    expect(countUpValue(0, 500, 1.8)).toBe(500);
    expect(countUpValue(0, 500, -0.4)).toBe(0);
  });

  it('handles a target equal to the start', () => {
    expect(countUpValue(42, 42, 0.3)).toBe(42);
  });

  it('survives non-numeric input rather than rendering NaN', () => {
    // These read from live queries, so undefined genuinely arrives before
    // the first response. "NaN GB" on a dashboard is worse than a zero.
    expect(countUpValue(undefined, 100, 0.5)).not.toBeNaN();
    expect(countUpValue(0, undefined, 0.5)).toBe(0);
    expect(countUpValue(null, null, 0.5)).toBe(0);
  });
});

describe('EASE_OUT_DURATION', () => {
  it('is short enough not to delay reading the number', () => {
    // Long enough to be seen settling, short enough that a value which
    // updates on a poll is never mid-flight when the next one lands.
    expect(EASE_OUT_DURATION).toBeGreaterThanOrEqual(300);
    expect(EASE_OUT_DURATION).toBeLessThanOrEqual(900);
  });
});
