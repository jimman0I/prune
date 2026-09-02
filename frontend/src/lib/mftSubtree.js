/** Finds the node for `path` inside an already-scanned MFT tree.
 *
 * This is what makes the fast scan feel fast to use rather than just to
 * run. The MFT scan reads the entire volume in one pass, so once it's
 * done every folder on the drive is already in memory -- drilling into
 * one should be instant, not another trip to the disk. Without this,
 * clicking a folder would fall back to the recursive scanner and undo the
 * whole point.
 *
 * Returns null rather than an empty node when the path isn't browsable
 * here -- not in the tree, on another drive, a file rather than a folder,
 * or a directory the scan's depth cap never expanded. Those are all
 * "can't answer from this tree", and the caller needs to tell them apart
 * from "this folder is genuinely empty" so it can fall back to a real
 * scan instead of drawing an empty treemap. */
export function subtreeForPath(tree, path) {
  if (!tree || typeof path !== 'string') return null;

  const segments = path.split(/[\\/]+/).filter(Boolean);
  if (segments.length === 0) return null;

  // Windows paths are case-insensitive, and the drive segment carries a
  // colon ("C:") that must still match the tree's own root label.
  if (segments[0].toLowerCase() !== tree.name.toLowerCase().replace(/[\\/]+$/, '')) return null;

  let node = tree;
  for (const segment of segments.slice(1)) {
    if (!node.children) return null; // past the depth cap -- not "empty"
    const next = node.children.find((c) => c.name.toLowerCase() === segment.toLowerCase());
    if (!next || next.type !== 'directory') return null;
    node = next;
  }
  return node.children ? node : null;
}
