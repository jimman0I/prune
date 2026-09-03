import { extensionOf, GENERIC_FILE_KEY } from './fileTypeIcon.js';

/** What a file with no extension is filed under. Deliberately not lumped
 * in with a real type: on this machine these are mostly game data blobs
 * and lockfiles, and calling them ".bin" would invent a fact. */
export const NO_EXTENSION = GENERIC_FILE_KEY;

/** Every file extension in the scanned tree, largest first.
 *
 * WizTree shows this beside its treemap and it answers a question the map
 * cannot: the map tells you WHERE the space went, this tells you WHAT it
 * went to. A folder view will never reveal that 40 GB is .pak files spread
 * across six games.
 *
 * Walks whatever tree it is given, which matters because Prune has two
 * scanners. The MFT scan sees the whole volume but needs admin; the
 * folder-by-folder scan runs unelevated and reaches a fraction of it.
 * Aggregating from the tree rather than from the scanner means this works
 * either way -- and the caller already knows what fraction was covered, so
 * it can say so rather than implying these totals are the whole disk.
 *
 * Iterative rather than recursive: the tree is 80,000 nodes deep in
 * places on a real volume, and a recursive walk risks the stack for no
 * benefit. */
export function extensionBreakdown(tree) {
  const totals = new Map();
  let totalBytes = 0;
  let totalFiles = 0;
  // The synthetic block standing for space the scan never reached. Its
  // bytes are inside tree.size but they are not a folder anyone skipped.
  let unscannedBytes = 0;

  const stack = [tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    if (node.children) {
      for (const child of node.children) stack.push(child);
    }

    // The synthetic "unscanned remainder" block, first: it is a
    // DIRECTORY, so a type check ahead of this one skips it before its
    // bytes can be subtracted -- which is exactly the bug that made the
    // panel report the whole untouched drive as skipped folders.
    if (node.scanned === false) {
      unscannedBytes += typeof node.size === 'number' ? node.size : 0;
      continue;
    }

    // Directories carry the sum of their children, so counting them too
    // would report every byte at least twice. Only leaves are files.
    if (node.type !== 'file') continue;

    const size = typeof node.size === 'number' && node.size > 0 ? node.size : 0;
    const key = extensionOf(node.name) ?? NO_EXTENSION;
    const row = totals.get(key) || { extension: key, sizeBytes: 0, fileCount: 0 };
    row.sizeBytes += size;
    row.fileCount += 1;
    totals.set(key, row);

    totalBytes += size;
    totalFiles += 1;
  }

  const rows = [...totals.values()].sort((a, b) => b.sizeBytes - a.sizeBytes || b.fileCount - a.fileCount);
  for (const row of rows) {
    row.percent = totalBytes > 0 ? (row.sizeBytes / totalBytes) * 100 : 0;
  }

  // What the scan actually reached, against what these rows account for.
  // The two differ because the scan is depth-limited: a folder past the
  // limit still reports its size, but its files are not in the tree to be
  // categorised -- 33.4 GB of a 35.1 GB tree on this machine.
  //
  // The unscanned remainder is subtracted first, and that correction is
  // the whole point. Left in, the gap came out as 794 GB and the panel
  // described the entire untouched drive as "folders the scan did not
  // open" -- a true number under a false label, which is worse than
  // either alone. What was never scanned is the coverage banner's job to
  // report; this number is only about what the scan itself skipped.
  const rawTreeBytes = typeof tree?.size === 'number' ? tree.size : totalBytes;
  const treeBytes = Math.max(totalBytes, rawTreeBytes - unscannedBytes);
  return {
    rows,
    totalBytes,
    totalFiles,
    treeBytes,
    uncategorizedBytes: Math.max(0, treeBytes - totalBytes)
  };
}
