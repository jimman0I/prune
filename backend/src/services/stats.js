import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The running total behind "Prune has freed 12.4 GB since 3 Oct".
 *
 * Only space that is actually back counts, the same line Deep Clean draws
 * between "Freed" and "Moved":
 *
 *   - bytes a clean DELETED (Delete now), or compacted in place;
 *   - an uninstall's leftovers removed with "Delete permanently";
 *   - files Shred destroyed;
 *   - a Quarantine batch that was permanently deleted -- by hand, by Empty
 *     Quarantine, or by the retention window or size cap.
 *
 * A move into Quarantine or the Recycle Bin records nothing, so a batch is
 * counted exactly once: when it is finally deleted, not when it went in.
 *
 * Its own small file beside settings.json rather than a key inside it. Settings
 * are read and rewritten as a whole by every screen; a counter bumped by every
 * clean has no business racing them. Written atomically, and a damaged file
 * reads as an empty total instead of an error: this is a number for a caption,
 * and no failure here may reach the clean that caused it. */

/** A function, not a constant, read at call time so a test can point it at a
 * scratch file (UNREVO_STATS_PATH). Otherwise beside settings.json, in the
 * same userData folder the packaged app sets UNREVO_SETTINGS_PATH to.
 * Deliberately not imported from settings.js: this must keep working in a
 * test that replaces that module. */
export function statsPath() {
  if (process.env.UNREVO_STATS_PATH) return process.env.UNREVO_STATS_PATH;
  const settings = process.env.UNREVO_SETTINGS_PATH
    || join(process.env.LOCALAPPDATA || process.cwd(), 'Prune', 'settings.json');
  return join(dirname(settings), 'stats.json');
}

const EMPTY = Object.freeze({ freedBytes: 0, since: null });

/** What the file says, or an empty total if it is missing or not ours. */
async function readStats() {
  let raw;
  try {
    raw = JSON.parse(await readFile(statsPath(), 'utf8'));
  } catch {
    return { ...EMPTY };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY };
  const total = raw.freedBytes;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return { ...EMPTY };
  const since = typeof raw.since === 'number' && Number.isFinite(raw.since) && raw.since > 0 ? raw.since : null;
  return { freedBytes: Math.floor(total), since };
}

/** { freedBytes, since } -- `since` is when the first byte was counted, or null
 * before any was. */
export async function getStats() {
  return readStats();
}

// One at a time, so two cleans finishing together each add to the other's
// result instead of both reading the same old total.
let queue = Promise.resolve();

async function add(bytes, now) {
  const current = await readStats();
  const next = {
    freedBytes: Math.min(Number.MAX_SAFE_INTEGER, current.freedBytes + bytes),
    since: current.since ?? now
  };
  const path = statsPath();
  await mkdir(dirname(path), { recursive: true });
  // Beside the real file, then renamed over it: a reader, or a crash mid-write,
  // sees the old total or the new one, never half of one.
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify({ version: 1, ...next, updatedAt: now }), 'utf8');
    await rename(tmp, path);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
  return next;
}

/** Adds `bytes` to the total. Anything that is not a positive number of whole
 * bytes is ignored. Never throws and never rejects: it resolves to the total as
 * it now stands (or as it stood, if the write failed). */
export function recordFreed(bytes, now = Date.now()) {
  const whole = typeof bytes === 'number' && Number.isFinite(bytes) ? Math.floor(bytes) : 0;
  if (whole <= 0) return readStats();
  const run = queue.then(() => add(whole, now)).catch(() => readStats());
  queue = run.catch(() => {});
  return run;
}
