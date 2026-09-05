import { mkdir, rename, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { quarantineRoot } from './quarantine.js';
import { protectionReason } from './pathGuard.js';

/** Moving one arbitrary path into quarantine.
 *
 * The Disk Map's context menu can offer to remove whatever is under the
 * cursor. That is a genuinely different risk from every other removal in
 * this app -- those act on curated targets, this one acts on whatever
 * happened to be right-clicked in a picture -- so it goes through
 * pathGuard first and then into quarantine, never to a delete.
 *
 * A separate service from quarantineAndDelete rather than a flag on it,
 * because two of that function's assumptions do not hold for a folder:
 * it takes stat().size, which for a directory is the size of the
 * directory ENTRY and not of anything in it, and it assumes the move can
 * always be a rename.
 */

/** Windows cannot rename across volumes, and the quarantine lives beside
 * the app's data on the system drive. A folder on D: therefore cannot be
 * moved into it.
 *
 * The alternative is copy-then-delete, and that is deliberately not done:
 * a 40 GB copy takes minutes, needs 40 GB free on the system drive first,
 * and a failure halfway leaves the data in two places with nothing to say
 * which is authoritative. Refusing with a reason is the honest answer for
 * a feature whose entire purpose is being safe. */
const CROSS_VOLUME = 'EXDEV';

/** Records the size the caller already knows rather than measuring it.
 *
 * The Disk Map has just drawn this folder, so it has a size from the
 * scan. Walking the tree again to confirm it would take as long as the
 * scan did, for a number only used to render one row in the quarantine
 * list -- and the move is a rename, so the walk would be the slowest part
 * of an otherwise instant operation.
 *
 * Marked `sizeReported` so the manifest never claims to have measured
 * something it took on trust. */
export async function quarantinePath({ path, reportedSizeBytes = null }) {
  const refusal = protectionReason(path);
  if (refusal) return { ok: false, protected: true, error: refusal };

  if (!existsSync(path)) return { ok: false, error: 'That path is no longer there.' };

  let isDirectory = false;
  try {
    isDirectory = (await stat(path)).isDirectory();
  } catch (err) {
    return { ok: false, error: `Could not read that path: ${err.message}` };
  }

  const batchDir = join(quarantineRoot(), `${Date.now()}-diskmap-${safeSegment(basename(path))}`);

  try {
    await mkdir(batchDir, { recursive: true });
    const dest = join(batchDir, `file-0-${basename(path)}`);
    await rename(path, dest);

    const manifest = {
      // The quarantine list keys off this, and it is what the restore
      // puts back. Shaped exactly like quarantineAndDelete's manifest so
      // the existing screen, restore and purge all work unchanged.
      programName: basename(path),
      createdAt: Date.now(),
      batchDir,
      source: 'diskMap',
      isDirectory,
      files: [{
        originalPath: path,
        quarantinedPath: dest,
        sizeBytes: reportedSizeBytes,
        sizeReported: reportedSizeBytes !== null
      }],
      registryKeys: [],
      regFiles: [],
      totalSizeBytes: reportedSizeBytes
    };
    await writeFile(join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    return { ok: true, batch: manifest };
  } catch (err) {
    if (err.code === CROSS_VOLUME) {
      return {
        ok: false,
        error: 'That is on a different drive from the quarantine, so it cannot be moved there safely.'
      };
    }
    if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
      return { ok: false, error: 'Something is using that, or it is not yours to move.' };
    }
    return { ok: false, error: err.message };
  }
}

/** Same rule the existing quarantine uses for a folder name. */
function safeSegment(name) {
  return String(name).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 60) || 'item';
}
