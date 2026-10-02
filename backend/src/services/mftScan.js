import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runElevatedNodeJson, runNodeJson } from '../lib/elevated.js';
import { isElevated } from '../lib/privilege.js';

const here = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(here, '..', 'lib', 'ntfs', 'mftWorker.js');

/** A scan of a drive can run for a while on a big volume, and several drives
 * run back to back in one job, so the helper gets far longer than the
 * two-minute default every other elevated call uses. */
const MFT_TIMEOUT_MS = 15 * 60_000;

/** Full-drive scans read straight from the NTFS Master File Table.
 *
 * The recursive scanner (diskScan.js) asks the filesystem about one
 * directory at a time and pays a round trip per entry; measured on this
 * machine it took 15.2 seconds to walk a single 37 GB folder. NTFS
 * already keeps one flat table describing every file on the volume, so
 * reading that table sequentially and rebuilding the hierarchy afterward
 * does the WHOLE drive for a fraction of the work. It's the same trick
 * WizTree uses, and the same reason WizTree asks for administrator:
 * Windows won't hand a raw volume handle to an unelevated process.
 *
 * Which is the whole design constraint here. Unless Prune itself was started
 * as Administrator -- in which case the helper runs directly and nothing is
 * asked -- the scan can only run behind a deliberate user action, and a
 * declined UAC prompt is an ordinary answer rather than an error: the
 * recursive scanner still works.
 *
 * Every requested drive goes to the helper as ONE job, so choosing C: and
 * D: is one consent prompt, not two. A drive that cannot be read (not
 * NTFS, locked) fails on its own entry and does not discard the rest.
 *
 * Returns the same discriminated shape the rest of the elevated code uses:
 *   { ok: true, drives: [{ driveLetter, tree, stats } | { driveLetter, error }],
 *     driveLetter, tree, stats }       -- the last three mirror the first
 *                                          good drive, for single-drive callers
 *   { ok: false, cancelled: true }
 *   { ok: false, error }
 */
export async function scanDrivesViaMft({ driveLetters = ['C'], maxDepth = 12, excludeFolders = [], excludeExtensions = [], timeoutMs = MFT_TIMEOUT_MS } = {}) {
  // Already Administrator? Then there is nothing to ask: run the helper in
  // this process's own token. Otherwise it goes through a UAC prompt.
  const run = (await isElevated()) ? runNodeJson : runElevatedNodeJson;
  const result = await run(WORKER_PATH, [], {
    timeoutMs,
    input: { drives: driveLetters, maxDepth, excludeFolders, excludeExtensions }
  });

  if (!result.ok) return result;

  const drives = Array.isArray(result.data?.drives) ? result.data.drives : [];
  if (drives.length === 0) return { ok: false, error: 'The scan returned no drives.' };

  const good = drives.find((d) => d.tree);
  if (!good) {
    return { ok: false, error: drives.map((d) => d.error).filter(Boolean).join(' ') || 'The scan returned no tree.' };
  }

  return {
    ok: true,
    drives: drives.map((d) => (d.tree ? { driveLetter: d.driveLetter, tree: d.tree, stats: d.stats || {} } : d)),
    driveLetter: good.driveLetter,
    tree: good.tree,
    stats: good.stats || {}
  };
}
