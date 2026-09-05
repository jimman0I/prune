import { describe, it, expect } from 'vitest';
import { sizeBadgeTone } from './sizeBadgeTone.js';

/** The bands return a SEVERITY, not a colour.
 *
 * They used to return 'cyan' | 'blue' | 'amber' | 'coral', which tied this
 * file to whatever the palette happened to be and broke twice over when it
 * changed: cyan became the primary action colour, so the smallest band
 * would have matched every button on the screen, and coral stopped
 * existing entirely. A band is a statement about size; what colour that
 * is belongs to the component that draws it. */
describe('sizeBadgeTone', () => {
  it('is low under 100MB', () => {
    expect(sizeBadgeTone(50 * 1024 * 1024)).toBe('low');
  });
  it('is moderate from 100MB up to (not including) 1GB', () => {
    expect(sizeBadgeTone(100 * 1024 * 1024)).toBe('moderate');
    expect(sizeBadgeTone(500 * 1024 * 1024)).toBe('moderate');
  });
  it('is high from 1GB up to (not including) 5GB', () => {
    expect(sizeBadgeTone(1024 * 1024 * 1024)).toBe('high');
    expect(sizeBadgeTone(3 * 1024 * 1024 * 1024)).toBe('high');
  });
  it('is peak at 5GB and above', () => {
    expect(sizeBadgeTone(5 * 1024 * 1024 * 1024)).toBe('peak');
    expect(sizeBadgeTone(40 * 1024 * 1024 * 1024)).toBe('peak');
  });
  it('is low for null/undefined/zero (unknown size)', () => {
    // Many system components report no size at all. Unknown reads as the
    // quietest band rather than as an error state.
    expect(sizeBadgeTone(null)).toBe('low');
    expect(sizeBadgeTone(undefined)).toBe('low');
    expect(sizeBadgeTone(0)).toBe('low');
  });
  it('never returns a colour name', () => {
    // The regression this file exists to prevent.
    const sizes = [0, 50e6, 500e6, 3e9, 40e9];
    for (const bytes of sizes) {
      expect(['cyan', 'blue', 'amber', 'coral']).not.toContain(sizeBadgeTone(bytes));
    }
  });
});
