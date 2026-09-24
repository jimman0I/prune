/** Which Deep Clean categories the user has collapsed -- pure UI memory,
 * kept in localStorage for the same reason lib/settingsTab.js and
 * lib/theme.js keep theirs there: it is a view preference, nobody needs it
 * synced or in the config file, and above all it must stay out of the
 * `deepCleanSelection` setting. What is TICKED is a decision that changes
 * what Clean removes; what is COLLAPSED is only how the list is drawn, and
 * the two are stored, read and validated separately so neither can corrupt
 * the other.
 *
 * Collapsed rather than expanded is what is stored, so a category Prune
 * adds in a later version opens by default instead of arriving hidden.
 *
 * Read defensively: the value survives upgrades and is editable by hand, so
 * anything that is not a JSON array of strings is treated as absent, and
 * storage access itself can throw in a packaged renderer with site data
 * blocked. A list view is not worth a blank screen. */
export const DEEP_CLEAN_COLLAPSED_KEY = 'prune.deepCleanCollapsed';

/** Far above the ~30 categories that exist. A bound so a hand-edited or
 * corrupted value cannot make the read allocate without limit. */
const MAX_REMEMBERED = 200;

export function readCollapsedCategories(storage) {
  let raw;
  try {
    raw = storage?.getItem(DEEP_CLEAN_COLLAPSED_KEY) ?? null;
  } catch {
    return new Set();
  }
  if (typeof raw !== 'string') return new Set();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Set();
  }
  if (!Array.isArray(parsed)) return new Set();

  return new Set(parsed.filter((name) => typeof name === 'string' && name !== '').slice(0, MAX_REMEMBERED));
}

export function writeCollapsedCategories(storage, collapsed) {
  try {
    storage?.setItem(DEEP_CLEAN_COLLAPSED_KEY, JSON.stringify([...collapsed].slice(0, MAX_REMEMBERED)));
    return true;
  } catch {
    // The layout still applies for this session; it just will not be
    // remembered. Worth not crashing over.
    return false;
  }
}
