import { describe, it, expect } from 'vitest';
import { positiveOrOff } from './limitInput.js';

/** What a number field means when it is empty, or zero, or nonsense.
 *
 * The two quarantine limits are both "a number, or no limit at all", and
 * a number input can produce an empty string at any moment -- while the
 * field is being cleared to type a new value, most obviously. This is the
 * frontend half of the rule quarantineRetention.js and quarantineSizeCap.js
 * apply on the other side: every ambiguous value means keep everything.
 */

describe('positiveOrOff', () => {
  it('keeps a real number', () => {
    expect(positiveOrOff('30')).toBe(30);
    expect(positiveOrOff('0.5')).toBe(0.5);
    expect(positiveOrOff(5)).toBe(5);
  });

  it('is off for an empty field', () => {
    // The value while someone is clearing the box to type a new one. It
    // must not be read as zero -- and zero must not be read as "keep
    // nothing" either, see below.
    expect(positiveOrOff('')).toBeNull();
    expect(positiveOrOff('   ')).toBeNull();
    expect(positiveOrOff(null)).toBeNull();
    expect(positiveOrOff(undefined)).toBeNull();
  });

  it('is off for zero, not "keep nothing"', () => {
    // The whole reason this exists. Typing a 0 into a retention field
    // would otherwise empty the app's only undo, and typing one into the
    // size field would do it faster.
    expect(positiveOrOff('0')).toBeNull();
    expect(positiveOrOff(0)).toBeNull();
    expect(positiveOrOff('0.0')).toBeNull();
  });

  it('is off for anything that is not a positive finite number', () => {
    for (const value of ['-1', '-0.5', 'lots', 'Infinity', '1e400', NaN, {}, []]) {
      expect(positiveOrOff(value), JSON.stringify(value)).toBeNull();
    }
  });
});
