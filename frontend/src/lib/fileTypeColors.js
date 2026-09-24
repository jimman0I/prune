/** One colour per file type, shared by the treemap and the list beside it.
 *
 * This is the part of WizTree that makes its two panels one tool rather
 * than two: every cell in the map is painted by the file's TYPE, and the
 * swatch down the left of the file-type table is the same colour. You read
 * "14.2% .pak" in the list, and the map shows you where those .pak files
 * are without you clicking anything.
 *
 * Prune used to colour by four hardcoded buckets -- app, media, document,
 * everything else -- so the map could never answer that question: a drive
 * that is one third .pak and one third .dll painted both the same grey.
 * The buckets also had no relationship to the list, so the two panels
 * agreed about nothing. */

/** Picked for a dark ground and for being told apart from each other, not
 * for harmony -- this is data encoding, not decoration. Hues are spaced
 * around the wheel at a similar lightness so no one type looks more
 * important than another; the eye should read area, which is the quantity,
 * rather than brightness, which is not. */
export const PALETTE = [
  '#e0685f', '#4a92e0', '#5fb85f', '#d9b03a', '#9366d9', '#3bb3c4',
  '#e08a3c', '#d95f9e', '#a8bf3f', '#6d7fe0', '#3fbf95', '#c064cc',
  '#c47a5a', '#5fa8a0', '#b58fd4', '#8a9bb0'
];

/** Files the scan reached but that carry no extension at all. Deliberately
 * a neutral rather than a palette slot: "no type" is the absence of the
 * thing being encoded, and giving it a hue of its own would make it look
 * like one more category competing with .dll and .pak. */
const COLOR_NO_EXTENSION = '#6b7684';

/** A directory's own area, on the rare occasions one is painted rather
 * than its contents. */
const COLOR_DIRECTORY = '#545f6c';

/** Not a category of content -- an absence of knowledge. It has to read
 * that way at a glance rather than looking like another folder. */
const COLOR_UNSCANNED = '#2b3440';

export const NO_EXTENSION_COLOR = COLOR_NO_EXTENSION;
export const UNSCANNED_COLOR = COLOR_UNSCANNED;
export const DIRECTORY_COLOR = COLOR_DIRECTORY;

/** FNV-1a, 32-bit. Any stable string hash would do; this one is four
 * lines, has no dependencies, and spreads short similar strings (which is
 * all extensions are -- "dll", "dl_", "dat") across the palette instead of
 * clustering them the way a sum-of-characters hash would.
 *
 * Exported because the program tiles need the same property for the same
 * reason: their names cluster even harder than extensions do, being a
 * shared prefix with a version welded on the end. */
export function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** The extension of a file name, without its dot and lowercased, or ''
 * for a name that has none.
 *
 * Only the last dot counts, and a leading one does not: ".gitignore" is a
 * name, not an extension, and treating it as one would file every dotfile
 * on the machine under a type nobody would recognise. */
export function extensionOf(fileName) {
  if (typeof fileName !== 'string') return '';
  const match = /[^.]\.([A-Za-z0-9_-]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

export function normalizeExtension(extension) {
  if (typeof extension !== 'string') return '';
  return extension.trim().replace(/^\./, '').toLowerCase();
}

/** Assigns a colour to each file type, biggest first.
 *
 * Rank, not a hash of the name. A hash is tempting because it never
 * changes -- but with sixteen colours and eight common types it collides
 * about as often as not, and a collision between two of the types actually
 * on screen breaks the one thing the colour is for. Measured on this
 * drive: `pak`, `dll`, `exe`, `cache`, `mp4`, `zip`, `iso`, `log` came
 * back as six colours, so two pairs of the biggest types on the machine
 * were painted identically.
 *
 * Assigning down the ranked list makes the first sixteen types distinct by
 * construction, which is exactly the set the legend lists and the map is
 * mostly made of. Everything past the palette falls back to the hash: those
 * are slivers, and a repeated colour among them costs nothing. */
export function buildTypeColors(extensions) {
  const colors = new Map();
  let slot = 0;

  for (const raw of extensions || []) {
    const extension = normalizeExtension(raw);
    if (extension === '' || colors.has(extension)) continue;
    colors.set(extension, slot < PALETTE.length
      ? PALETTE[slot]
      : PALETTE[hash(extension) % PALETTE.length]);
    slot++;
  }

  return colors;
}

/** The colour for one file type. `colors` is the map built above; without
 * one this falls back to the hash, so a caller that has no breakdown yet
 * still paints something stable rather than nothing. */
export function colorForExtension(extension, colors) {
  const normalized = normalizeExtension(extension);
  if (normalized === '') return COLOR_NO_EXTENSION;
  return colors?.get(normalized) ?? PALETTE[hash(normalized) % PALETTE.length];
}

/** The fill for one disk-map node.
 *
 * Order matters: an unscanned region is a directory too, and checking it
 * first is the whole distinction between "empty" and "never opened". */
export function colorForNode(node, colors) {
  if (node?.scanned === false) return COLOR_UNSCANNED;
  if (!node || node.type !== 'file') return COLOR_DIRECTORY;
  return colorForExtension(extensionOf(node.name), colors);
}

/** Label inks for the treemap. Dark on the sixteen type colours (4.9 to 9.7:1
 * on them) and full white only on the three dark neutrals: the old label was
 * white at 85% opacity on every fill, which is 2 to 3.4:1 on the light hues. */
export const INK_DARK = '#09090b';
export const INK_LIGHT = '#ffffff';

/** Relative luminance of a #rrggbb colour, per WCAG 2.x. */
function relativeLuminance(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function wcagContrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The label ink for a fill: whichever of the two has the higher contrast.
 * Chosen by measurement, so a future palette entry gets the right ink
 * without anyone remembering which end of the wheel is "light". */
export function inkForFill(fill) {
  return wcagContrast(INK_DARK, fill) >= wcagContrast(INK_LIGHT, fill) ? INK_DARK : INK_LIGHT;
}
