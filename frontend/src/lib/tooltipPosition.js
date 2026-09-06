/** Where the Disk Map's tooltip goes, given the cursor and the window.
 *
 * It used to go at exactly `cursor + 14` with no bound at all. The panel
 * around it cannot clip it -- it is portalled to the body precisely so a
 * `backdrop-filter` ancestor stops being its containing block -- but the
 * viewport still can, and near the right edge a 320px-wide tooltip simply
 * left the screen, taking the full path with it. The path is the part
 * worth reading.
 *
 * Flipped rather than clamped when it does not fit. Clamping slides the
 * tooltip back under the cursor, where it covers the very cell being
 * pointed at; flipping puts it on the other side, which is what every
 * native tooltip does and what the eye expects.
 *
 * Pure, so the arithmetic can be tested without a browser. The component
 * measures the element and reads the window; this only decides.
 */

/** Distance from the cursor, on whichever side the tooltip lands. Big
 * enough that the pointer never overlaps the panel's own shadow. */
export const TOOLTIP_GAP = 14;

const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

export function tooltipPosition({ x, y, size, viewport } = {}) {
  const cursorX = finite(x, 0);
  const cursorY = finite(y, 0);
  const width = finite(size?.width, 0);
  const height = finite(size?.height, 0);
  // A viewport we cannot read is treated as unbounded rather than as
  // zero: placing everything at the origin would be worse than the
  // overflow this exists to prevent.
  const maxX = finite(viewport?.width, Infinity);
  const maxY = finite(viewport?.height, Infinity);

  let left = cursorX + TOOLTIP_GAP;
  if (left + width > maxX) left = cursorX - TOOLTIP_GAP - width;

  let top = cursorY + TOOLTIP_GAP;
  if (top + height > maxY) top = cursorY - TOOLTIP_GAP - height;

  // The flip can overshoot the other way for a tooltip taller or wider
  // than the space before the cursor -- near the top-left, or with a very
  // long path. Never leave through the opposite edge to avoid leaving
  // through this one.
  return { left: Math.max(0, left), top: Math.max(0, top) };
}
