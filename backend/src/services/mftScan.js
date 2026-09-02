import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runElevatedNodeJson } from '../lib/elevated.js';

const here = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(here, '..', 'lib', 'ntfs', 'mftWorker.js');

/** A full-drive scan read straight from the NTFS Master File Table.
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
 * Which is the whole design constraint here. The scan can only run behind
 * a deliberate user action, and a declined UAC prompt is an ordinary
 * answer rather than an error -- the recursive scanner still works and
 * stays the default. Returns the same discriminated shape the rest of the
 * elevated code uses:
 *   { ok: true, tree, stats }
 *   { ok: false, cancelled: true }
 *   { ok: false, error }
 */
export async function scanDriveViaMft({ driveLetter = 'C', maxDepth = 12, timeoutMs } = {}) {
  const result = await runElevatedNodeJson(
    WORKER_PATH,
    [driveLetter, String(maxDepth)],
    timeoutMs ? { timeoutMs } : {}
  );

  if (!result.ok) return result;

  const { tree, stats, driveLetter: letter } = result.data || {};
  if (!tree) return { ok: false, error: 'The scan returned no tree.' };

  return { ok: true, tree, stats: stats || {}, driveLetter: letter || driveLetter };
}
