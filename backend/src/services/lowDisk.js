import { statfs } from 'node:fs/promises';
import { listFixedDrives } from './localDrives.js';
import { normalizeLowDiskPercent, PERCENT_CHOICES, DEFAULT_PERCENT } from '../lib/lowDiskChoices.js';

/** Which local drives are running out of room.
 *
 * "Low" is a share of the drive's size (5, 10 or 15 percent, chosen in
 * Settings, or off), with two absolute limits that a bare percentage gets wrong:
 *
 * - A volume under 8 GB is not watched. Recovery and tool partitions are full by
 *   design, and a warning that is always on is one nobody reads.
 * - A drive with 100 GB or more free is never called low. 10% of a 4 TB disk is
 *   about 410 GB, and warning someone who still has 300 GB spare is how a
 *   warning gets switched off.
 *
 * Fixed drives only (Win32_LogicalDisk DriveType 3, as the free-space wipe's
 * picker): a USB stick or a network share is not the PC running out of room.
 *
 * Reading is cheap on purpose, because it runs every few minutes for as long
 * as Prune is open. The set of drives comes from one PowerShell query and is
 * kept for an hour; free space comes from fs.statfs on each drive's root, a
 * single system call with no process behind it. */

const GB = 1024 ** 3;
export const MIN_MONITORED_BYTES = 8 * GB;
export const ROOMY_FREE_BYTES = 100 * GB;
export { normalizeLowDiskPercent, PERCENT_CHOICES, DEFAULT_PERCENT };

const DRIVE_LIST_TTL_MS = 60 * 60 * 1000;
/** After a failed listing, try again soon rather than wait out the hour. */
const DRIVE_LIST_RETRY_MS = 60 * 1000;

/** Whether `space` ({ totalBytes, freeBytes }) is low for `percent`. */
export function isLow({ totalBytes, freeBytes }, percent) {
  if (!percent) return false;
  if (typeof totalBytes !== 'number' || !Number.isFinite(totalBytes) || totalBytes < MIN_MONITORED_BYTES) return false;
  if (typeof freeBytes !== 'number' || Number.isNaN(freeBytes)) return false;
  const free = Math.max(0, freeBytes);
  if (free >= ROOMY_FREE_BYTES) return false;
  return free < (totalBytes * percent) / 100;
}

let cache = null;

export function resetDriveListCache() {
  cache = null;
}

async function cachedDrives(fetchDrives, now) {
  const at = now();
  if (cache && at < cache.until) return cache.drives;
  try {
    const drives = await fetchDrives();
    cache = { drives, until: at + DRIVE_LIST_TTL_MS };
    return drives;
  } catch {
    cache = { drives: [], until: at + DRIVE_LIST_RETRY_MS };
    return [];
  }
}

/** Free and total bytes of a drive right now, from the file system itself. */
export async function readDriveSpace(drive) {
  const info = await statfs(`${drive}\\`);
  const size = Number(info.bsize);
  return { freeBytes: Number(info.bavail) * size, totalBytes: Number(info.blocks) * size };
}

/** The drives that are low for `percent`, each as { drive, label, freeBytes,
 * totalBytes, percentFree }. Empty when the warning is off (without reading
 * anything), when the drives cannot be listed, or when none is low.
 *
 * The dependencies are parameters so the rules can be tested without a disk. */
export async function findLowDrives({
  percent, fetchDrives = listFixedDrives, readSpace = readDriveSpace, now = Date.now
} = {}) {
  if (!percent) return [];
  const drives = await cachedDrives(fetchDrives, now);
  const low = [];
  for (const listed of drives) {
    let space = { freeBytes: listed.freeBytes, totalBytes: listed.totalBytes };
    try {
      const live = await readSpace(listed.drive);
      if (live && Number.isFinite(live.totalBytes) && live.totalBytes > 0) space = live;
    } catch { /* the figures the list was made with are the next best thing */ }
    if (!isLow(space, percent)) continue;
    low.push({
      drive: listed.drive,
      label: listed.label ?? '',
      freeBytes: Math.max(0, space.freeBytes),
      totalBytes: space.totalBytes,
      percentFree: Math.round((Math.max(0, space.freeBytes) / space.totalBytes) * 100)
    });
  }
  return low;
}

function formatGB(bytes) {
  return `${parseFloat((bytes / GB).toFixed(1))} GB`;
}

/** The notification's words. English, like the tray menu next to it: the
 * backend has no language catalog, and a notification is not a screen. */
export function lowDiskMessage({ drive, freeBytes, totalBytes, percentFree }) {
  return {
    title: `Low disk space on ${drive}`,
    body: `${formatGB(freeBytes)} free of ${formatGB(totalBytes)} (${percentFree}%). Open Prune to free some up.`
  };
}
