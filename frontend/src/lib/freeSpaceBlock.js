/** Name of the block standing in for the drive's free space. Exported so
 * the renderer and scanCoverage can recognise it without matching on a
 * string literal in two places. */
export const FREE_SPACE_LABEL = 'Free space';

/** WizTree's "Show Free Space on Treemap": the drive's free space as one
 * more block, so every folder reads as a share of the whole drive rather
 * than of the part in use.
 *
 * Marked scanned: false, which is what already makes the unscanned
 * remainder un-clickable and keeps it out of the right-click menu -- free
 * space is not a place, and there is nothing in it to open or remove.
 * `free` tells it apart from that remainder.
 *
 * Returns the tree untouched when there is no usable figure rather than
 * drawing a block of nothing. */
export function withFreeSpace(tree, freeBytes) {
  if (!tree) return tree;
  if (typeof freeBytes !== 'number' || !Number.isFinite(freeBytes) || freeBytes <= 0) return tree;
  return {
    ...tree,
    size: tree.size + freeBytes,
    children: [
      ...(tree.children || []),
      { name: FREE_SPACE_LABEL, size: freeBytes, type: 'directory', scanned: false, free: true }
    ]
  };
}

/** The tree the Disk Map draws: with the free-space block only when the
 * setting is explicitly on AND the map is showing a whole drive. A
 * subfolder's share of the drive's free space is not a thing, so a folder
 * view never gets one. */
export function mapTreeFor(tree, { enabled, atDriveRoot, freeBytes }) {
  if (enabled !== true || !atDriveRoot) return tree;
  return withFreeSpace(tree, freeBytes);
}
