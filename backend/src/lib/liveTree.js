/** A depth-limited picture of a folder walk that is still running.
 *
 * The walk builds its real tree bottom-up and hands it over only when it is
 * finished, which for a whole drive can be many minutes of nothing to look at.
 * This keeps a second, small tree beside it, fed by the same per-file events:
 * every file adds its size to each folder above it (to a limited depth), so
 * at any moment `snapshot()` is "what has been read so far", with real sizes
 * that only ever grow.
 *
 * Bounded on purpose. It tracks folders to `depth` levels and only the
 * biggest `maxChildren` of each are put in a snapshot (the rest are folded
 * into one counted block that carries their bytes), so a snapshot stays a few
 * hundred kilobytes however many millions of files the walk has seen, and a
 * folder's children always add up to its size. */
const SEPARATORS = /[\\/]+/;

/** The names between `root` and `path`, or null when `path` is not under
 * `root`. Case-insensitive, like Windows. */
export function relativeSegments(root, path) {
  const rootParts = String(root).split(SEPARATORS).filter(Boolean);
  const parts = String(path).split(SEPARATORS).filter(Boolean);
  if (parts.length < rootParts.length) return null;
  for (let i = 0; i < rootParts.length; i++) {
    if (parts[i].toLowerCase() !== rootParts[i].toLowerCase()) return null;
  }
  return parts.slice(rootParts.length);
}

const newNode = (name) => ({ name, size: 0, allocated: 0, dirs: new Map(), files: [] });

export function createLiveTree(rootName, { depth = 2, maxChildren = 60 } = {}) {
  const root = newNode(rootName);

  /** `segments` are the folder names and then the file's name. */
  function add(segments, size, allocated = 0) {
    if (!Array.isArray(segments) || segments.length === 0 || !(size > 0)) return;
    root.size += size;
    root.allocated += allocated;

    const folders = segments.slice(0, -1);
    let node = root;
    for (let level = 0; level < folders.length && level < depth; level++) {
      const name = folders[level];
      let next = node.dirs.get(name);
      if (!next) { next = newNode(name); node.dirs.set(name, next); }
      next.size += size;
      next.allocated += allocated;
      node = next;
    }
    // The file is listed only if its folder is one this tree shows the
    // contents of; a file further down is counted in its ancestors and kept
    // nowhere, so memory stays bounded by the folders, not by the files.
    if (folders.length < depth) node.files.push({ name: segments.at(-1), size, allocated });
  }

  function view(node, level) {
    const out = { name: node.name, size: node.size, allocated: node.allocated, type: 'directory' };
    if (level >= depth) return out;

    const entries = [
      ...[...node.dirs.values()].map((d) => view(d, level + 1)),
      ...node.files.map((f) => (f.allocated > 0
        ? { name: f.name, size: f.size, allocated: f.allocated, type: 'file' }
        : { name: f.name, size: f.size, type: 'file' }))
    ].sort((a, b) => b.size - a.size);

    const kept = entries.slice(0, maxChildren);
    const rest = entries.slice(maxChildren);
    if (rest.length > 0) {
      kept.push({ name: '', type: 'file', aggregated: true, count: rest.length, size: rest.reduce((s, e) => s + e.size, 0) });
    }
    out.children = kept;
    return out;
  }

  function snapshot() {
    return { ...view(root, 0), partial: true, truncated: true };
  }

  return { add, snapshot };
}
