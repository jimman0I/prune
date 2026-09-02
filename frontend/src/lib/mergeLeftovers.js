const GROUPS = ['files', 'registryKeys', 'scheduledTasks'];

/** Combines several programs' leftover scans into one reviewable set.
 *
 * A batch uninstall runs several uninstallers and each leaves its own
 * traces. Reviewing them one dialog at a time would undo the point of
 * batching, so they're merged into a single list — with each item tagged
 * by the program it came from, because after a batch that label is the
 * only way to judge a path you don't recognise.
 *
 * Two rules that matter:
 *
 * Paths are de-duplicated. Two programs from the same vendor legitimately
 * match the same folder, and listing it twice would let it be selected
 * twice — making the review claim more space than removing it actually
 * frees.
 *
 * A group is `ok: false` if it failed for ANY program. Reporting "no
 * registry leftovers" for the batch when one program's registry scan
 * errored would be a clean bill of health nothing supports. */
export function mergeLeftovers(results) {
  const merged = {};

  for (const group of GROUPS) {
    const items = [];
    const seen = new Set();
    let ok = true;

    for (const { program, scan } of results) {
      const source = scan?.[group];
      if (!source) continue;
      if (source.ok === false) ok = false;

      for (const item of source.items || []) {
        // Scheduled tasks have no path, so fall back to the name.
        const key = (item.path || item.name || '').toLowerCase();
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        items.push({ ...item, program });
      }
    }

    merged[group] = { ok, items };
  }

  return merged;
}
