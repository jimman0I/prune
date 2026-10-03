/** Folding a folder's small files into one counted block.
 *
 * A drive with millions of files cannot be sent as a tree with a node for
 * every one: the serialized scan passed V8's string limit (about 512 MB) and
 * failed with "Invalid string length", and even below it the renderer would be
 * asked to hold a node per file. The directories are the structure and are
 * always kept; the files are what is folded.
 *
 * In every folder the largest files stay as nodes and the rest become ONE
 * block on the folder itself, so nothing is lost from a total:
 *
 *   directory.folded = { count: 37, size, allocated, exts: { '.dll': [bytes, count], '': [...] } }
 *
 * The front end turns it back into a "(37 smaller files)" row (an `aggregated`
 * node, as a reopened saved scan already has) when it attaches paths.
 *
 * `exts` says what the folded files were, by extension ('' for none), so the
 * file-type breakdown of a folder stays exact. It is written for folds of
 * EXT_MIN_FOLD files or more; a smaller fold's breakdown would cost nearly as
 * much as the files it replaces. EVERY folded file is in the root's
 * `foldedExts`, so the whole-drive breakdown is exact either way.
 *
 * The largest-files list stays exact while it asks for no more than
 * KEEP_FILES_PER_FOLDER: a file in the top N of a whole tree is in the top N of
 * its own folder. */

/** Files kept as nodes per folder, largest first. Above the 60 rows the
 * Disk Map's file list shows, so that list is unaffected. */
export const KEEP_FILES_PER_FOLDER = 200;

/** A fold of fewer files than this is not made: the block costs as much as the
 * files it would replace. */
export const MIN_FOLD = 3;
export const EXT_MIN_FOLD = 8;

/** What a drive's tree may cost serialized, estimated (bytes). Well under the
 * ~512 MB a single V8 string can hold, and a tree the renderer can parse, keep
 * and clone to its worker. When a drive has more than this leaves room for,
 * the smallest kept files are folded too: see FoldPlanner. */
export const BYTE_BUDGET = 280_000_000;

// Rough serialized cost of each kind of node, names included.
const FOLDER_BYTES = 165;
const FILE_BYTES = 115;
const FOLD_BYTES = 90;
const FOLD_EXTS_BYTES = 90;

/** Same rule as the front end's extensionOf (lib/fileTypeIcon.js): lowercased
 * ".ext", and it must contain a letter so a "app-1.0.9255" folder name or a
 * "1.0" file is not a type. '' when there is none. */
export function extensionKey(name) {
  if (typeof name !== 'string') return '';
  const match = /(\.[a-z0-9_-]{1,12})$/i.exec(name);
  if (!match) return '';
  const ext = match[1].toLowerCase();
  return /[a-z]/.test(ext) ? ext : '';
}

export function newAggregate() {
  return { count: 0, size: 0, allocated: 0, exts: new Map() };
}

export function addToAggregate(aggregate, name, size, allocated) {
  aggregate.count += 1;
  aggregate.size += size;
  aggregate.allocated += allocated;
  const key = extensionKey(name);
  const row = aggregate.exts.get(key);
  if (row) { row[0] += size; row[1] += 1; } else aggregate.exts.set(key, [size, 1]);
}

/** Adds one fold's per-type totals into the drive-wide ones. */
export function mergeExts(into, aggregate) {
  for (const [key, [bytes, count]] of aggregate.exts) {
    const row = into.get(key);
    if (row) { row[0] += bytes; row[1] += count; } else into.set(key, [bytes, count]);
  }
}

export function foldedBlock(aggregate, { withAllocation }) {
  const block = { count: aggregate.count, size: aggregate.size };
  if (withAllocation && aggregate.allocated > 0) block.allocated = aggregate.allocated;
  if (aggregate.count >= EXT_MIN_FOLD) block.exts = Object.fromEntries(aggregate.exts);
  return block;
}

/** How many of a folder's files (n of them, `top` the largest in descending
 * order, at most `keep`) stay as nodes at this size floor. */
export function keptCount(n, top, floor, keep = KEEP_FILES_PER_FOLDER) {
  let kept = 0;
  while (kept < top.length && kept < keep && top[kept] > floor) kept++;
  // Folding one or two files costs as much as keeping them.
  return n - kept < MIN_FOLD ? n : kept;
}

/** Picks the size floor for a whole drive.
 *
 * Feed it every folder's file sizes (`addFolder`), then ask for the floor that
 * keeps the estimated tree inside the byte budget: -1 (keep what the
 * per-folder cap allows) when that already fits, otherwise the smallest size
 * for which it does. Searched, not computed, because what a floor saves depends
 * on which folders it empties; the search is a few dozen passes over the
 * (capped) candidate sizes. */
export class FoldPlanner {
  constructor({ keep = KEEP_FILES_PER_FOLDER } = {}) {
    this.keep = keep;
    this.folders = 0;
    this.counts = [];     // files per folder with files
    this.starts = [];     // where each folder's top sizes begin in `tops`
    this.tops = new Float64Array(1 << 16);
    this.used = 0;
  }

  /** Called for every directory (with its file sizes, possibly none). */
  addFolder(sizes) {
    this.folders += 1;
    if (!sizes || sizes.length === 0) return;
    let top = sizes;
    if (top.length > this.keep) { top = [...top].sort((a, b) => b - a).slice(0, this.keep); } else if (top.length > 1) { top = [...top].sort((a, b) => b - a); }
    if (this.used + top.length > this.tops.length) {
      const grown = new Float64Array(Math.max(this.tops.length * 2, this.used + top.length));
      grown.set(this.tops.subarray(0, this.used));
      this.tops = grown;
    }
    this.counts.push(sizes.length);
    this.starts.push(this.used);
    for (const s of top) this.tops[this.used++] = s;
    this.starts.push(this.used); // end marker; read as starts[2i+1]
  }

  /** Estimated serialized bytes of the tree at `floor`. */
  cost(floor) {
    let bytes = this.folders * FOLDER_BYTES;
    for (let i = 0; i < this.counts.length; i++) {
      const n = this.counts[i];
      const from = this.starts[2 * i];
      const to = this.starts[2 * i + 1];
      let kept = 0;
      while (from + kept < to && this.tops[from + kept] > floor) kept++;
      if (n - kept < MIN_FOLD) kept = n;
      bytes += kept * FILE_BYTES;
      if (kept < n) bytes += FOLD_BYTES + (n - kept >= EXT_MIN_FOLD ? FOLD_EXTS_BYTES : 0);
    }
    return bytes;
  }

  floorFor(budget = BYTE_BUDGET) {
    if (this.cost(-1) <= budget) return -1;
    // 1.41x steps from 1 byte to ~1 TB.
    const candidates = [];
    for (let i = 0; i <= 80; i++) candidates.push(Math.floor(2 ** (i / 2)));
    let lo = 0;
    let hi = candidates.length - 1;
    if (this.cost(candidates[hi]) > budget) return candidates[hi]; // nothing more to give
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cost(candidates[mid]) <= budget) hi = mid; else lo = mid + 1;
    }
    return candidates[lo];
  }

  estimate(floor) { return this.cost(floor); }
}

/** Folds the file nodes of a finished tree (the folder walk's, which builds
 * every node before it can be pruned) the same way buildTree does for the MFT.
 * Mutates and returns `tree`; a tree with nothing to fold comes back
 * untouched. */
export function foldTreeFiles(tree, { keep = KEEP_FILES_PER_FOLDER, budget = BYTE_BUDGET } = {}) {
  const isPlainFile = (c) => c.type !== 'directory' && !c.aggregated && !c.excluded && c.scanned !== false;
  const planner = new FoldPlanner({ keep });
  const survey = [tree];
  while (survey.length > 0) {
    const node = survey.pop();
    if (!Array.isArray(node.children)) continue;
    const sizes = [];
    for (const child of node.children) {
      if (child.type === 'directory') survey.push(child); else if (isPlainFile(child)) sizes.push(child.size || 0);
    }
    planner.addFolder(sizes);
  }
  const floor = planner.floorFor(budget);
  const foldedExts = new Map();
  let foldedAny = false;

  const stack = [tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!Array.isArray(node.children)) continue;
    const files = [];
    const rest = [];
    for (const child of node.children) {
      if (child.type === 'directory') { rest.push(child); stack.push(child); } else if (isPlainFile(child)) files.push(child); else rest.push(child);
    }
    files.sort((a, b) => (b.size || 0) - (a.size || 0));
    const kept = keptCount(files.length, files.map((f) => f.size || 0), floor, keep);
    if (kept < files.length) {
      const aggregate = newAggregate();
      let withAllocation = false;
      for (let i = kept; i < files.length; i++) {
        if (typeof files[i].allocated === 'number') withAllocation = true;
        addToAggregate(aggregate, files[i].name, files[i].size || 0, files[i].allocated ?? 0);
      }
      node.folded = foldedBlock(aggregate, { withAllocation });
      mergeExts(foldedExts, aggregate);
      foldedAny = true;
    }
    if (kept < files.length) node.children = [...rest, ...files.slice(0, kept)].sort((a, b) => (b.size || 0) - (a.size || 0));
  }
  if (foldedAny) tree.foldedExts = Object.fromEntries(foldedExts);
  return tree;
}
