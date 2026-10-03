import { createExclusionMatcher } from '../diskExclusions.js';
import { KEEP_FILES_PER_FOLDER, BYTE_BUDGET, FoldPlanner, keptCount, newAggregate, addToAggregate, mergeExts, foldedBlock } from '../foldFiles.js';

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
 * Each node carries `size` (the logical length) and, when the records
 * carried it, `allocated` (what the item occupies on disk). A file with no
 * clusters of its own (data inside the MFT record) simply has no
 * `allocated`; a directory always does, as the sum of what is below it.
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
 * `exclusions` ({ excludeFolders, excludeExtensions }, the user's Settings) are
 * honoured here exactly as the folder walk honours them: an excluded entry is
 * kept in the tree as a marked, empty placeholder and contributes nothing to
 * any total, and everything beneath an excluded folder is accounted for so the
 * orphan sweep cannot bring it back. `report`, if given, is filled with what
 * was left out (excludedItems / excludedSizeBytes / excludedAllocatedBytes) so
 * the omission is stated rather than silent.
 *
 * `maxDepth` bounds only the SHAPE of the returned tree. The walk always
 * descends to the leaves, so a file twenty levels down still counts
 * toward every ancestor's total -- same contract the recursive scanner's
 * own DEFAULT_MAX_DEPTH already has.
 *
 * FILES ARE FOLDED, directories never are. A drive with millions of files
 * produced a result past V8's ~512 MB string limit ("Invalid string length"),
 * and a node per file is more than anything downstream can usefully hold. So
 * each folder keeps its `keepFiles` largest files as nodes and the rest become
 * one `folded` block on the folder carrying their size, allocation, count and
 * a per-type breakdown (see lib/foldFiles.js). Nothing leaves a total: a
 * folder's size is still the sum of everything in it.
 *
 * When even that leaves more than `byteBudget` (estimated, serialized), the
 * smallest kept files are folded too: a size floor is searched for that makes
 * the drive fit. `report` gets foldedFiles, foldedBytes, sizeFloorBytes and
 * estimatedBytes so the omission is stated. */
export function buildTree(records, { name = 'C:', maxDepth = 12, exclusions = null, report = null, keepFiles = KEEP_FILES_PER_FOLDER, byteBudget = BYTE_BUDGET } = {}) {
  const isExcluded = createExclusionMatcher(exclusions);
  if (report) {
    report.excludedItems = 0; report.excludedSizeBytes = 0; report.excludedAllocatedBytes = 0;
    report.foldedFiles = 0; report.foldedBytes = 0; report.sizeFloorBytes = 0; report.keepFiles = keepFiles; report.estimatedBytes = 0;
  }
  // Only report allocation if the records carry it at all: a tree from an
  // older reader must not claim that everything occupies zero bytes.
  let hasAllocation = false;
  for (const entry of records.values()) {
    if (entry.allocatedBytes !== undefined) { hasAllocation = true; break; }
  }

  const childrenOf = new Map();
  for (const [recordNumber, entry] of records) {
    if (recordNumber === ROOT_RECORD) continue; // the root names itself "." and parents itself
    const parent = entry.parentRecord;
    if (!records.has(parent)) continue; // swept below, not dropped
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(recordNumber);
  }

  // The size floor: the smallest size a file may have and still be kept as a
  // node. -1 (keep everything the per-folder cap allows) unless the drive's
  // estimated tree would not fit the byte budget.
  const planner = new FoldPlanner({ keep: keepFiles });
  for (const kids of childrenOf.values()) {
    let sizes = null;
    for (const kid of kids) {
      const entry = records.get(kid);
      if (!entry.isDirectory) (sizes ??= []).push(entry.sizeBytes);
    }
    planner.addFolder(sizes);
  }
  const sizeFloor = planner.floorFor(byteBudget);
  if (report) { report.sizeFloorBytes = Math.max(sizeFloor, 0); report.estimatedBytes = planner.estimate(sizeFloor); }

  // Every file folded anywhere, by type: the whole-drive breakdown stays exact
  // even for folds too small to carry their own.
  const foldedExts = new Map();

  /** Keeps a folder's largest files as nodes (pushed onto `nodes`) and
   * returns the block for the rest, or null when nothing was folded. */
  const foldFiles = (entries, nodes) => {
    if (entries.length > keepFiles || sizeFloor >= 0) entries.sort((a, b) => b.sizeBytes - a.sizeBytes);
    const kept = keptCount(entries.length, entries.map((e) => e.sizeBytes), sizeFloor, keepFiles);
    for (let i = 0; i < kept; i++) nodes.push(fileNode(entries[i]));
    if (kept === entries.length) return null;
    const aggregate = newAggregate();
    for (let i = kept; i < entries.length; i++) {
      const entry = entries[i];
      addToAggregate(aggregate, entry.name, entry.sizeBytes, hasAllocation ? entry.allocatedBytes ?? 0 : 0);
    }
    mergeExts(foldedExts, aggregate);
    if (report) { report.foldedFiles += aggregate.count; report.foldedBytes += aggregate.size; }
    return foldedBlock(aggregate, { withAllocation: hasAllocation });
  };

  // Every record whose bytes the root walk already counted. The sweep at
  // the end uses this to add what's left exactly once -- getting this
  // wrong in the other direction (double-counting) is just as dishonest
  // as dropping it.
  const accounted = new Set();
  // Directories currently on the path being walked. This is what makes a
  // parent cycle terminate rather than recurse until the stack dies.
  const onPath = new Set();

  const fileNode = (entry) => {
    const node = { name: entry.name, size: entry.sizeBytes, type: 'file' };
    if (hasAllocation && entry.allocatedBytes > 0) node.allocated = entry.allocatedBytes;
    if (entry.hardLinks) node.links = entry.hardLinks;
    if (typeof entry.modified === 'number') node.modified = entry.modified;
    return node;
  };

  /** Accounts for an excluded entry and everything below it, without
   * building nodes for any of it. Iterative, with the accounted set as the
   * visited guard, so a parent cycle inside an excluded folder terminates. */
  function leaveOut(recordNumber) {
    const stack = [recordNumber];
    while (stack.length > 0) {
      const current = stack.pop();
      const entry = records.get(current);
      if (!entry || (accounted.has(current) && current !== recordNumber)) continue;
      accounted.add(current);
      if (report) {
        report.excludedItems += 1;
        report.excludedSizeBytes += entry.isDirectory ? 0 : entry.sizeBytes;
        report.excludedAllocatedBytes += entry.allocatedBytes ?? 0;
      }
      for (const child of childrenOf.get(current) || []) if (!accounted.has(child)) stack.push(child);
    }
  }

  function nodeFor(recordNumber, depthRemaining, parentPath) {
    const entry = records.get(recordNumber);
    if (!entry) return null;
    accounted.add(recordNumber);

    const path = isExcluded ? `${parentPath}\\${entry.name}` : '';
    if (isExcluded && isExcluded(path)) {
      accounted.delete(recordNumber);
      leaveOut(recordNumber);
      const placeholder = entry.isDirectory
        ? { name: entry.name, size: 0, type: 'directory', excluded: true, children: [] }
        : { name: entry.name, size: 0, type: 'file', excluded: true };
      if (hasAllocation && entry.isDirectory) placeholder.allocated = 0;
      return placeholder;
    }

    if (!entry.isDirectory) return fileNode(entry);
    if (onPath.has(recordNumber)) {
      // Already its own ancestor. Stop here; whatever is below stays
      // unaccounted and the sweep will pick it up.
      return hasAllocation
        ? { name: entry.name, size: 0, allocated: 0, type: 'directory' }
        : { name: entry.name, size: 0, type: 'directory' };
    }

    onPath.add(recordNumber);
    const children = [];
    let size = 0;
    // A directory's own index buffers sit on disk too.
    let allocated = entry.allocatedBytes ?? 0;
    const plainFiles = [];
    for (const childRecord of childrenOf.get(recordNumber) || []) {
      const childEntry = records.get(childRecord);
      // Plain files are collected and folded together below; directories and
      // excluded files go through nodeFor as they always did.
      if (childEntry && !childEntry.isDirectory && !(isExcluded && isExcluded(`${path}\\${childEntry.name}`))) {
        accounted.add(childRecord);
        plainFiles.push(childEntry);
        continue;
      }
      const child = nodeFor(childRecord, depthRemaining - 1, path);
      if (!child) continue;
      size += child.size;
      allocated += child.allocated ?? 0;
      children.push(child);
    }
    onPath.delete(recordNumber);

    let folded = null;
    if (plainFiles.length > 0) {
      for (const f of plainFiles) {
        size += f.sizeBytes;
        allocated += f.allocatedBytes ?? 0;
      }
      // Past the depth cap the files are not shown at all, so nothing is made
      // of them: they are in the totals, which is all they need to be.
      if (depthRemaining > 0) folded = foldFiles(plainFiles, children);
    }

    children.sort((a, b) => b.size - a.size);
    const node = { name: entry.name, size, type: 'directory' };
    if (hasAllocation) node.allocated = allocated;
    if (typeof entry.modified === 'number') node.modified = entry.modified;
    if (depthRemaining > 0) {
      node.children = children;
      if (folded) node.folded = folded;
    }
    return node;
  }

  const children = [];
  let total = 0;
  let totalAllocated = records.get(ROOT_RECORD)?.allocatedBytes ?? 0;
  for (const childRecord of childrenOf.get(ROOT_RECORD) || []) {
    const child = nodeFor(childRecord, maxDepth - 1, name);
    if (!child) continue;
    total += child.size;
    totalAllocated += child.allocated ?? 0;
    children.push(child);
  }

  // Swept FLAT rather than re-nested. Nesting them would mean walking
  // parent links through exactly the broken structure that stranded them,
  // and the one thing that must hold here is that each stray record's
  // bytes are counted once and only once.
  const strays = [];
  const strayFiles = [];
  for (const [recordNumber, entry] of records) {
    if (recordNumber === ROOT_RECORD || accounted.has(recordNumber)) continue;
    if (entry.isDirectory) {
      const node = { name: entry.name, size: 0, type: 'directory' };
      if (hasAllocation) node.allocated = entry.allocatedBytes ?? 0;
      if (typeof entry.modified === 'number') node.modified = entry.modified;
      strays.push(node);
    } else {
      strayFiles.push(entry);
    }
  }
  const strayFolded = strayFiles.length > 0 ? foldFiles(strayFiles, strays) : null;

  if (strays.length > 0) {
    const straySize = strays.reduce((sum, n) => sum + n.size, 0) + (strayFolded?.size ?? 0);
    const strayAllocated = strays.reduce((sum, n) => sum + (n.allocated ?? 0), 0) + (strayFolded?.allocated ?? 0);
    total += straySize;
    totalAllocated += strayAllocated;
    const bucket = { name: ORPHAN_BUCKET, size: straySize, type: 'directory', children: strays.sort((a, b) => b.size - a.size) };
    if (hasAllocation) bucket.allocated = strayAllocated;
    if (strayFolded) bucket.folded = strayFolded;
    children.push(bucket);
  }

  children.sort((a, b) => b.size - a.size);
  const root = { name, size: total, type: 'directory' };
  if (hasAllocation) root.allocated = totalAllocated;
  const rootModified = records.get(ROOT_RECORD)?.modified;
  if (typeof rootModified === 'number') root.modified = rootModified;
  root.children = children;
  if (foldedExts.size > 0) root.foldedExts = Object.fromEntries(foldedExts);
  return root;
}
