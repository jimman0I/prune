/** The folders someone has pointed a duplicate search at before, most
 * recent first.
 *
 * Pure UI memory in localStorage, like scanMode.js and fastScanDuration.js:
 * nobody needs this synced or in the config file, and it decides nothing by
 * itself -- it only offers a folder back for a click instead of a retype
 * or a trip through the file picker. The empty state before any search has
 * run is a blank field above nothing, which is the blank screen this
 * fixes. */
export const RECENT_FOLDERS_KEY = 'prune.duplicates.recentFolders';
const MAX_RECENT = 5;

export function readRecentFolders(storage) {
  try {
    const raw = storage?.getItem(RECENT_FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f) => typeof f === 'string' && f.length > 0);
  } catch {
    return [];
  }
}

/** Moves `folder` to the front, dropping any earlier copy of it (case
 * sensitivity matches the file system this list is pointing at -- Windows
 * paths, so comparisons fold case), and caps the list at MAX_RECENT.
 * Returns the new list; writes nothing and returns the unchanged list on
 * a storage failure. */
export function addRecentFolder(storage, folder) {
  const trimmed = typeof folder === 'string' ? folder.trim() : '';
  if (!trimmed) return readRecentFolders(storage);
  const current = readRecentFolders(storage);
  const next = [trimmed, ...current.filter((f) => f.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
  try {
    storage?.setItem(RECENT_FOLDERS_KEY, JSON.stringify(next));
  } catch {
    return current;
  }
  return next;
}
