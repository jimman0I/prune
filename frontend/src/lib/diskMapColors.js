// Aurora Deck's ambient/data-viz palette (--accent-blue/-purple/-cyan in
// index.css), plus a fourth gray for everything that isn't one of the three
// named categories. Kept as literal hex here rather than a CSS var lookup --
// these color the SVG cells inside a recharts Treemap, painted straight into
// `fill`, not through a class the cascade can theme; index.css's tokens stay
// the single source of truth for every other Aurora Deck surface.
const APP_EXTENSIONS = new Set(['exe', 'msi']);
const MEDIA_EXTENSIONS = new Set(['mp4', 'jpg', 'jpeg', 'png', 'gif', 'mp3']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'doc', 'txt', 'md']);

const COLOR_APP = '#3b82f6';
const COLOR_MEDIA = '#8b5cf6';
const COLOR_DOCUMENT = '#06b6d4';
const COLOR_UNKNOWN = '#545f6c';
// Deliberately not one of the palette colors above: an unscanned region
// is not a category of content, it's an absence of knowledge, and it has
// to read that way at a glance rather than looking like another folder.
const COLOR_UNSCANNED = '#2b3440';

/** The fill color for one disk-map node. Directories are always the
 * "system/unknown" gray -- the interesting color-coding is about what's
 * actually TAKING UP the space (files), not the folders containing it. */
export function colorForNode(node) {
  if (node?.scanned === false) return COLOR_UNSCANNED;
  if (!node || node.type !== 'file') return COLOR_UNKNOWN;
  const match = /\.([a-z0-9]+)$/i.exec(node.name ?? '');
  const ext = match ? match[1].toLowerCase() : '';
  if (APP_EXTENSIONS.has(ext)) return COLOR_APP;
  if (MEDIA_EXTENSIONS.has(ext)) return COLOR_MEDIA;
  if (DOCUMENT_EXTENSIONS.has(ext)) return COLOR_DOCUMENT;
  return COLOR_UNKNOWN;
}
