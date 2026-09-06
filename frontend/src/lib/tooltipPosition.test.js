import { describe, it, expect } from 'vitest';
import { tooltipPosition, TOOLTIP_GAP } from './tooltipPosition.js';

/** Keeping the Disk Map's tooltip inside the window.
 *
 * It was positioned at exactly `translate(clientX + 14, clientY + 14)`
 * with no bound of any kind. The panel it lives in cannot clip it -- it is
 * portalled to the body for that reason -- but the VIEWPORT still can, and
 * nothing was stopping it: hover a cell near the right edge and a tooltip
 * up to 320px wide runs off the screen, taking the full path with it,
 * which is the part worth reading.
 */

const size = { width: 320, height: 90 };
const viewport = { width: 1280, height: 800 };

describe('tooltipPosition', () => {
  it('sits below and right of the cursor when there is room', () => {
    expect(tooltipPosition({ x: 100, y: 100, size, viewport }))
      .toEqual({ left: 100 + TOOLTIP_GAP, top: 100 + TOOLTIP_GAP });
  });

  it('flips to the left of the cursor rather than running off the right', () => {
    // Flipped, not merely clamped. Clamping would slide it under the
    // cursor, where it covers the cell being pointed at.
    const { left } = tooltipPosition({ x: 1270, y: 100, size, viewport });
    expect(left).toBe(1270 - TOOLTIP_GAP - size.width);
    expect(left + size.width).toBeLessThanOrEqual(viewport.width);
  });

  it('flips above the cursor rather than running off the bottom', () => {
    const { top } = tooltipPosition({ x: 100, y: 790, size, viewport });
    expect(top).toBe(790 - TOOLTIP_GAP - size.height);
    expect(top + size.height).toBeLessThanOrEqual(viewport.height);
  });

  it('flips both ways at once in the bottom-right corner', () => {
    const { left, top } = tooltipPosition({ x: 1275, y: 795, size, viewport });
    expect(left + size.width).toBeLessThanOrEqual(viewport.width);
    expect(top + size.height).toBeLessThanOrEqual(viewport.height);
  });

  it('never pushes it off the top or left edge instead', () => {
    // The flip has to be bounded too, or a tooltip taller than the cursor
    // position simply leaves through the other side.
    const tall = { width: 320, height: 700 };
    const { left, top } = tooltipPosition({ x: 5, y: 10, size: tall, viewport });
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('copes with a size it has not measured yet', () => {
    // The first hover renders before the element exists to measure, so
    // the size arrives as zero. It must place it sensibly rather than
    // computing NaN.
    const { left, top } = tooltipPosition({ x: 200, y: 200, size: { width: 0, height: 0 }, viewport });
    expect(Number.isFinite(left)).toBe(true);
    expect(Number.isFinite(top)).toBe(true);
  });

  it('copes with a viewport it cannot read', () => {
    const { left, top } = tooltipPosition({ x: 50, y: 60, size, viewport: undefined });
    expect(Number.isFinite(left)).toBe(true);
    expect(Number.isFinite(top)).toBe(true);
  });
});
