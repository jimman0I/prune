/** The biggest files among the rules about to be cleaned, for the Delete now
 * confirmation: "47 items" is a browser cache or most of a game install, and
 * naming the largest few is what lets someone tell which before agreeing to
 * something that cannot be undone.
 *
 * Reads the per-rule `files` the scan returned (each already the biggest
 * of its rule), so it adds nothing to what the scan held. */
export function biggestSelected(categories, selected, n = 3) {
  const all = [];
  for (const group of categories || []) {
    for (const item of group.items || []) {
      if (selected.has(item.id) && Array.isArray(item.files)) all.push(...item.files);
    }
  }
  return all.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, n);
}

/** The last part of a path, whichever slash it uses. */
export function fileName(path) {
  return String(path).split(/[\\/]/).filter(Boolean).pop() ?? String(path);
}
