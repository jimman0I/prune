/** MFT record 5 is always the volume root directory. */
export const ROOT_RECORD = 5;

/** Where entries that don't hang off the root end up. */
const ORPHAN_BUCKET = 'Unknown (orphaned entries)';

/** Turns the flat map of MFT records into the same
 * { name, size, type, children } tree the recursive scanner already
 * produces, so the existing treemap renders it unchanged.
 *
 * Every file knows only its parent's record number, so the tree is built
 * by linking children to parents in one pass and then summing sizes
 * upward -- never by walking parent pointers per file, which on 800,000
 * records would be quadratic.
 *
 * Two properties matter more than they look:
 *
 *  - It must TERMINATE on malformed input. A corrupt MFT can contain a
 *    parent cycle (a inside b inside a), and a walk that follows parent
 *    links naively hangs the scan forever.
 *
 *  - Bytes must never silently vanish. Two different situations put a
 *    record outside the root's tree: its parent isn't in the snapshot at
 *    all (ordinary on a live volume -- the MFT is read over several
 *    seconds while files are being created and deleted), or it sits in a
 *    cycle that never reaches the root. Both would quietly shrink the
 *    reported total, which is precisely the lie a disk usage tool exists
 *    to prevent. Everything the root walk didn't account for is swept
 *    into a visible bucket instead.
 *
 * `maxDepth` bounds only the SHAPE of the returned tree. The walk always
 * descends to the leaves, so a file twenty levels down still counts
 * toward every ancestor's total -- same contract the recursive scanner's
 * own DEFAULT_MAX_DEPTH already has. */
export function buildTree(records, { name = 'C:', maxDepth = 12 } = {}) {
  const childrenOf = new Map();
  for (const [recordNumber, entry] of records) {
    if (recordNumber === ROOT_RECORD) continue; // the root names itself "." and parents itself
    const parent = entry.parentRecord;
    if (!records.has(parent)) continue; // swept below, not dropped
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(recordNumber);
  }

  // Every record whose bytes the root walk already counted. The sweep at
  // the end uses this to add what's left exactly once -- getting this
  // wrong in the other direction (double-counting) is just as dishonest
  // as dropping it.
  const accounted = new Set();
  // Directories currently on the path being walked. This is what makes a
  // parent cycle terminate rather than recurse until the stack dies.
  const onPath = new Set();

  function nodeFor(recordNumber, depthRemaining) {
    const entry = records.get(recordNumber);
    if (!entry) return null;
    accounted.add(recordNumber);

    if (!entry.isDirectory) {
      return { name: entry.name, size: entry.sizeBytes, type: 'file' };
    }
    if (onPath.has(recordNumber)) {
      // Already its own ancestor. Stop here; whatever is below stays
      // unaccounted and the sweep will pick it up.
      return { name: entry.name, size: 0, type: 'directory' };
    }

    onPath.add(recordNumber);
    const children = [];
    let size = 0;
    for (const childRecord of childrenOf.get(recordNumber) || []) {
      const child = nodeFor(childRecord, depthRemaining - 1);
      if (!child) continue;
      size += child.size;
      children.push(child);
    }
    onPath.delete(recordNumber);

    children.sort((a, b) => b.size - a.size);
    return depthRemaining > 0
      ? { name: entry.name, size, type: 'directory', children }
      : { name: entry.name, size, type: 'directory' };
  }

  const children = [];
  let total = 0;
  for (const childRecord of childrenOf.get(ROOT_RECORD) || []) {
    const child = nodeFor(childRecord, maxDepth - 1);
    if (!child) continue;
    total += child.size;
    children.push(child);
  }

  // Swept FLAT rather than re-nested. Nesting them would mean walking
  // parent links through exactly the broken structure that stranded them,
  // and the one thing that must hold here is that each stray record's
  // bytes are counted once and only once.
  const strays = [];
  for (const [recordNumber, entry] of records) {
    if (recordNumber === ROOT_RECORD || accounted.has(recordNumber)) continue;
    strays.push(entry.isDirectory
      ? { name: entry.name, size: 0, type: 'directory' }
      : { name: entry.name, size: entry.sizeBytes, type: 'file' });
  }

  if (strays.length > 0) {
    const straySize = strays.reduce((sum, n) => sum + n.size, 0);
    total += straySize;
    children.push({
      name: ORPHAN_BUCKET,
      size: straySize,
      type: 'directory',
      children: strays.sort((a, b) => b.size - a.size)
    });
  }

  children.sort((a, b) => b.size - a.size);
  return { name, size: total, type: 'directory', children };
}
