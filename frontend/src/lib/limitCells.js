/** Label for the cell standing in for everything past the cap. */
export const AGGREGATE_NAME_PREFIX = 'smaller items';

/** Caps how many rectangles the treemap actually draws.
 *
 * Measured cause of real lag (2026-09-02): C:\Windows\System32 has ~1,900
 * direct children, and every one became an interactive cell -- 1,903
 * rects inside 8,083 SVG groups, 10,086 DOM nodes in total. Every mouse
 * move re-rendered all of them, and a 60-move sweep that should take half
 * a second took over three minutes.
 *
 * It costs nothing in information. Past a hundred or so cells the
 * rectangles are a few pixels across: they can't be labelled, can't
 * realistically be clicked, and convey nothing except that a lot of small
 * things exist -- which is exactly what the aggregate cell says, in
 * words, while keeping their bytes in the picture.
 *
 * The total is preserved exactly. A treemap that quietly dropped its tail
 * would understate the folder it is describing. */
export function limitCells(cells, max) {
  if (!cells || cells.length === 0) return [];
  // Aggregating a single leftover is strictly worse than drawing it.
  if (cells.length <= max + 1) return cells;

  const sorted = [...cells].sort((a, b) => (b.size || 0) - (a.size || 0));
  const kept = sorted.slice(0, max);
  const rest = sorted.slice(max);

  return [
    ...kept,
    {
      name: `${rest.length.toLocaleString()} ${AGGREGATE_NAME_PREFIX}`,
      size: rest.reduce((sum, c) => sum + (c.size || 0), 0),
      type: 'directory',
      // No fullPath: it is not a place, so it must not look clickable.
      aggregated: true
    }
  ];
}
