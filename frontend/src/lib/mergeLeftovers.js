import { TIERS } from './leftoverTiers.js';

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
 * frees. When both report it, the surer tier is kept.
 *
 * A group is `ok: false` if it failed for ANY program. Reporting "no
 * registry leftovers" for the batch when one program's registry scan
 * errored would be a clean bill of health nothing supports.
 *
 * What the scans held back (`protected`) is added up, and a partial search
 * (`truncated`) stays partial. */
export function mergeLeftovers(results) {
  const merged = {};

  for (const group of GROUPS) {
    const items = [];
    const seen = new Map();
    let ok = true;
    let withheld = 0;
    let truncated = false;

    for (const { program, scan } of results) {
      const source = scan?.[group];
      if (!source) continue;
      if (source.ok === false) ok = false;
      withheld += Number(source.protected) || 0;
      if (source.truncated) truncated = true;

      for (const item of source.items || []) {
        // Scheduled tasks have no path, so fall back to the name.
        const key = (item.path || item.name || '').toLowerCase();
        if (key && seen.has(key)) {
          const at = seen.get(key);
          if (TIERS.indexOf(item.confidence) !== -1 && TIERS.indexOf(item.confidence) < TIERS.indexOf(items[at].confidence)) {
            items[at] = { ...item, program: items[at].program };
          }
          continue;
        }
        if (key) seen.set(key, items.length);
        items.push({ ...item, program });
      }
    }

    merged[group] = { ok, items, ...(withheld > 0 ? { protected: withheld } : {}), ...(truncated ? { truncated: true } : {}) };
  }

  return merged;
}
