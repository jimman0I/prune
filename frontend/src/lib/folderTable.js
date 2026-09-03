/** Rows for the folder table, one per direct child of the node in view.
 *
 * WizTree's Tree View, which answers questions the treemap cannot. A map
 * shows proportion and nothing else: it cannot tell you that a 2 GB
 * folder is two files or two hundred thousand, and "how many things are
 * in here" is what decides whether a folder is worth opening.
 *
 * Columns deliberately NOT here, and why:
 *
 *   Allocated -- WizTree shows it; this project measured it and threw it
 *     out. The allocated sizes summed to 1270 GB on a 952.9 GB volume
 *     while claiming no file was smaller allocated than logical. A number
 *     that fails its own sanity check is worse than an absent column.
 *
 *   Attributes -- Windows file attributes are not on a Node stat, and
 *     nothing in this scan carries them. An empty column would be worse
 *     than none.
 *
 * Counts come from the tree that is already loaded, so they cost one walk
 * and no extra request. They are honest about a truncated scan: a folder
 * the scan never opened reports no counts at all rather than zero, which
 * would read as "empty". */
export function folderTableRows(node) {
  const children = node?.children;
  if (!Array.isArray(children) || children.length === 0) return [];

  const total = children.reduce((sum, child) => sum + (child.size || 0), 0);

  return children.map((child) => {
    const counted = countSubtree(child);
    return {
      name: child.name,
      fullPath: child.fullPath || null,
      type: child.type,
      size: child.size || 0,
      // Of the parent, not of the drive -- the question this column
      // answers is "how much of what I am looking at is this".
      percentOfParent: total > 0 ? ((child.size || 0) / total) * 100 : 0,
      modified: typeof child.modified === 'number' ? child.modified : null,
      scanned: child.scanned !== false,
      ...counted
    };
  });
}

/** Files, folders and total items beneath a node.
 *
 * Iterative: a real volume nests deep enough that a recursive walk is a
 * stack risk for no benefit, the same reason the file-type breakdown and
 * the largest-files list are iterative.
 *
 * Returns nulls rather than zeros for a node the scan never opened. Zero
 * is a measurement; null is the absence of one, and a folder table that
 * reports "0 files" for somewhere nobody looked is stating something it
 * does not know. */
function countSubtree(node) {
  if (node?.scanned === false) return { items: null, files: null, folders: null };

  // A directory Windows would not let us list. It comes back with an empty
  // children array, exactly like a directory that really is empty, so
  // without this flag the table would report "0 items" for somewhere it
  // could not look -- "Documents and Settings" being the everyday case.
  if (node?.readable === false) return { items: null, files: null, folders: null };

  // A file is one item and no folder, and has nothing beneath it.
  if (node?.type === 'file') return { items: 1, files: 1, folders: 0 };

  // A directory past the scan's depth cap has a real size but no
  // `children` array, so its contents were never enumerated.
  if (!Array.isArray(node?.children)) return { items: null, files: null, folders: null };

  let files = 0;
  let folders = 0;
  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.scanned === false) continue;
    // Counted as a folder (it is one), but nothing is claimed about what
    // is inside it.
    if (current.readable === false) { folders += 1; continue; }
    if (current.type === 'file') files += 1;
    else {
      folders += 1;
      if (Array.isArray(current.children)) stack.push(...current.children);
    }
  }
  return { items: files + folders, files, folders };
}
