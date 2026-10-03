import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runElevatedNodeJson, runNodeJson } from '../lib/elevated.js';
import { isElevated } from '../lib/privilege.js';
import { readDriveLines } from '../lib/ntfs/driveOutput.js';
import { SCAN_TOO_LARGE_MESSAGE, classifyScanError } from '../lib/scanErrors.js';

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
 * `raw: true` leaves each drive's tree as the JSON bytes the helper wrote
 * (`treeJson`, a Buffer) instead of parsing it: the route writes them straight
 * to the response. On a drive with millions of files that is the difference
 * between the Electron main process holding a tree it only means to forward
 * (and then a second copy of its JSON) and holding neither.
 *
 * Returns the same discriminated shape the rest of the elevated code uses:
 *   { ok: true, drives: [{ driveLetter, tree, stats } | { driveLetter, error, code? }],
 *     driveLetter, tree, stats }       -- the last three mirror the first
 *                                          good drive, for single-drive callers
 *   { ok: false, cancelled: true }
 *   { ok: false, error, code? }        -- code 'scan_too_large' when the drive is
 *                                          more than one scan can hold
 */
export async function scanDrivesViaMft({ driveLetters = ['C'], maxDepth = 12, excludeFolders = [], excludeExtensions = [], timeoutMs = MFT_TIMEOUT_MS, raw = false } = {}) {
  // Already Administrator? Then there is nothing to ask: run the helper in
  // this process's own token. Otherwise it goes through a UAC prompt.
  const run = (await isElevated()) ? runNodeJson : runElevatedNodeJson;
  const result = await run(WORKER_PATH, [], {
    timeoutMs,
    input: { drives: driveLetters, maxDepth, excludeFolders, excludeExtensions },
    lines: true
  });

  if (!result.ok) return failed(result);

  const output = readDriveLines(result.lines, { parseTrees: !raw });
  if (output.error) return failed({ error: output.error, code: output.code });
  const drives = output.drives;
  if (drives.length === 0) return { ok: false, error: 'The scan returned no drives.' };

  const good = drives.find((d) => d.tree || d.treeJson);
  if (!good) {
    const codes = drives.map((d) => d.code).filter(Boolean);
    return {
      ok: false,
      error: drives.map((d) => d.error).filter(Boolean).join(' ') || 'The scan returned no tree.',
      ...(codes.length > 0 ? { code: codes[0] } : {})
    };
  }

  return {
    ok: true,
    drives: drives.map((d) => (d.tree || d.treeJson ? { driveLetter: d.driveLetter, tree: d.tree, treeJson: d.treeJson, stats: d.stats || {} } : d)),
    driveLetter: good.driveLetter,
    tree: good.tree,
    stats: good.stats || {}
  };
}

/** A failure with its cause named. The helper stopping without a word is, on
 * the drives this is run against, almost always memory. */
function failed(result) {
  if (result.cancelled) return result;
  if (result.code === 'crashed') {
    return { ok: false, error: 'The scan helper stopped unexpectedly. On a drive with a very large number of files that is usually memory: use "Walk folders" to scan it a folder at a time.', code: 'crashed' };
  }
  const code = result.code ?? classifyScanError(result.error ?? '');
  return code ? { ok: false, error: SCAN_TOO_LARGE_MESSAGE, code } : result;
}
