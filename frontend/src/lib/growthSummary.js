import { formatBytes } from './formatBytes.js';

/** What "what grew since the last scan" is made of.
 *
 * The numbers come from the backend's compareScans (the same comparison as
 * Saved scans -> Compare), run on the drive's latest two automatic scans. This
 * file only decides what is worth showing and which warnings are honest. */

/** How many folders the summary lists. */
export const GROWTH_ROWS = 5;

/** A folder has to have grown by at least this to be listed. Two scans minutes
 * apart always differ by some logs and caches; a summary that led with "+40 KB"
 * would be noise dressed as news. */
export const GROWTH_MIN_BYTES = 1024 * 1024;

/** The folders that grew the most: those in both scans that got bigger, plus
 * folders that only the newer scan has (their whole size is growth). The drive's
 * own root is left out -- it is the total, which is shown on its own line. */
export function growthRows(comparison, { limit = GROWTH_ROWS, min = GROWTH_MIN_BYTES } = {}) {
  const rows = [
    ...(comparison?.grew ?? []).map((r) => ({ path: r.path, delta: r.delta, isNew: false })),
    ...(comparison?.added ?? []).map((r) => ({ path: r.path, delta: r.size, isNew: true }))
  ];
  return rows
    .filter((r) => typeof r.path === 'string' && !/^[a-z]:[\\/]?$/i.test(r.path) && r.delta >= min)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);
}

/** The reasons two scans may not be comparable like for like, by the key of the
 * sentence that says it. Only reasons that are known: a scan saved without a
 * drive size says nothing about it. */
export function growthCaveats(older, newer) {
  const caveats = [];
  if (older?.truncated === true || newer?.truncated === true) caveats.push('partial');
  const a = older?.capacityBytes;
  const b = newer?.capacityBytes;
  if (typeof a === 'number' && typeof b === 'number' && a !== b) caveats.push('differentSize');
  if (older?.source && newer?.source && older.source !== newer.source) caveats.push('differentMethod');
  return caveats;
}

/** The path to open for a row. A drive is "C:" in a saved scan and "C:\" to the
 * Disk Map. */
export function drillPathFor(path) {
  return /^[a-z]:$/i.test(path) ? `${path}\\` : path;
}

/** "+3.2 GB", "−300 B": the size with its direction. */
export function signedBytes(bytes) {
  return `${bytes > 0 ? '+' : bytes < 0 ? '−' : ''}${formatBytes(Math.abs(bytes))}`;
}

/** Whether the summary is folded away, kept in localStorage like the Settings
 * tab and the scan mode: interface memory nobody needs synced. Open by default. */
export const GROWTH_COLLAPSED_KEY = 'prune.diskMapGrowthCollapsed';

export function readGrowthCollapsed(storage) {
  try {
    return storage?.getItem(GROWTH_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeGrowthCollapsed(storage, collapsed) {
  try {
    if (!storage) return false;
    storage.setItem(GROWTH_COLLAPSED_KEY, collapsed ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}
