/** The biggest individual files the scan found, largest first.
 *
 * WizTree's second tab, and the one that answers "what do I actually
 * delete". A treemap is good at showing that a folder is enormous and bad
 * at showing that a single 8 GB file inside it is the reason -- and on
 * this machine two .ucas files account for a quarter of everything
 * scanned, which the map draws as one indistinguishable slab.
 *
 * Same walk as the file-type breakdown: iterative, over whatever tree it
 * is given, so it works for the MFT scan and the unelevated
 * folder-by-folder scan alike.
 *
 * `limit` is applied after sorting, not during. Keeping a bounded heap
 * would matter at millions of files; at the 68,000 a real scan produces
 * here, sorting the whole list takes a few milliseconds and the simpler
 * code is worth more than the saving. */
export function largestFiles(tree, { limit = 100 } = {}) {
  const files = [];

  const stack = [tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    if (node.children) {
      for (const child of node.children) stack.push(child);
    }

    // The synthetic block standing for space the scan never reached is a
    // directory carrying hundreds of gigabytes. It would otherwise top
    // this list, and it is not a file anyone can delete.
    if (node.scanned === false) continue;
    if (node.type !== 'file') continue;

    const size = typeof node.size === 'number' ? node.size : 0;
    if (size <= 0) continue;

    files.push({
      name: node.name,
      fullPath: node.fullPath || null,
      size
    });
  }

  files.sort((a, b) => b.size - a.size);
  return files.slice(0, limit);
}
