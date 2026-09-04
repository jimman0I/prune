import { PALETTE, hash } from './fileTypeColors.js';

/** The colour of the tile a program falls back to when it has no icon.
 *
 * Every one of those tiles was the same coral, because `program.color`
 * has never existed on a program object and the `|| '#f98074'` behind it
 * always won. Combined with a letter that was "M" twenty-six times out of
 * forty-four, the iconless half of the list was a single repeated square.
 *
 * The colour encodes NOTHING. That distinction matters because these are
 * the disk map's palette entries, and there the colour is data -- a
 * treemap cell and its legend swatch agree because they are the same file
 * type. Here it is an identity anchor: a stable mark that makes a row
 * findable again after you scroll away, the way an avatar colour does. The
 * two never share a screen and neither carries the other's legend.
 *
 * Reusing that palette rather than inventing a second one is deliberate:
 * it was already picked for a dark ground, for the entries being told
 * apart from each other, and for sitting at a similar lightness so no one
 * of them looks more important than the rest. Those are exactly this
 * problem's constraints.
 */

/** The letter, and the reason this is not white.
 *
 * Measured against all sixteen palette entries: white text clears WCAG AA
 * on ZERO of them, and the dark navy clears it on fifteen. The tile letter
 * is 9px bold, which is not "large text", so the bar is 4.5:1 rather than
 * 3:1 -- and the coral tile this replaces was white at 2.51:1 from the day
 * it was written.
 *
 * It is also the pattern the app already uses for ink on a bright chip:
 * the startup screen's tick is drawn in this same colour on cyan. */
export const TILE_INK = '#041638';

const AA_NORMAL_TEXT = 4.5;

/** WCAG 2.1 relative luminance. */
function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}

/** The palette entries a letter can actually be read on.
 *
 * Derived rather than copied. One swatch -- the purple -- lands at 4.37:1,
 * just under the bar, and hardcoding a filtered list would mean a later
 * change to the disk map's palette silently reintroduces an illegible
 * tile. This re-filters instead. */
export const TILE_COLORS = PALETTE.filter(
  (color) => contrastRatio(color, TILE_INK) >= AA_NORMAL_TEXT
);

/** A stable colour for one program, by name.
 *
 * Hashed rather than assigned by position in the list. The list is
 * filtered, searched and re-sorted constantly, and a tile that changed
 * colour when you typed in the search box would be worse than one colour
 * for everything -- which is what it had.
 *
 * FNV-1a for the same reason the file types use it: these names cluster
 * even harder than extensions do, being one shared prefix with a version
 * welded on the end, and a sum-of-characters hash would drop the whole
 * Visual C++ family into adjacent slots. */
export function tileColor(name) {
  const key = String(name ?? '').trim().toLowerCase();
  return TILE_COLORS[hash(key) % TILE_COLORS.length];
}
