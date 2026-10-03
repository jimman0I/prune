/** Undo after a move into Quarantine: which batches a removal made, and putting
 * them back.
 *
 * Quarantine is this app's undo already (Quarantine screen, Restore). This is
 * the same restore, offered at the moment it is most wanted -- on the toast that
 * reports the move -- and it goes through the same route, so it has the same
 * guarantees and the same limits. */

const isPath = (value) => typeof value === 'string' && value.length > 0;

/** The Quarantine batches a Deep Clean made: one per rule that moved files
 * (`quarantineBatch` on its result). A rule that deleted, recycled or did
 * nothing made none. */
export function batchDirsOfResults(results) {
  if (!Array.isArray(results)) return [];
  return [...new Set(results.map((r) => r?.quarantineBatch).filter(isPath))];
}

/** The rule ids whose batch is among `dirs` -- which rows of Deep Clean an Undo
 * has just brought back. */
export function ruleIdsOfBatches(results, dirs) {
  if (!Array.isArray(results)) return [];
  const wanted = new Set(dirs);
  return results.filter((r) => wanted.has(r?.quarantineBatch) && typeof r?.id === 'string').map((r) => r.id);
}

/** The batch an uninstall's leftover removal made -- only when the files went to
 * Quarantine and something was actually moved. With the Recycle Bin or Delete
 * permanently there is no batch of files to bring back, and a registry-only
 * batch exported alongside them is not "the files moved to Quarantine". */
export function batchDirOfManifest(manifest) {
  if (!manifest || manifest.destination !== 'quarantine' || !isPath(manifest.batchDir)) return [];
  const held = (manifest.files?.length ?? 0) + (manifest.registryKeys?.length ?? 0);
  return held > 0 ? [manifest.batchDir] : [];
}

/** Whether a failed restore means "that batch is no longer there" -- emptied,
 * purged by the retention window or the size cap, or restored already from the
 * Quarantine screen -- as opposed to something that went wrong. */
export function isGoneError(error) {
  return /ENOENT|no such file|no quarantine batch/i.test(String(error?.message ?? error ?? ''));
}

/** Restores each batch in turn through `restore` (the API call), never stopping
 * at one that cannot be. Resolves { restored, gone, failed } -- the directories
 * that came back, the ones that were already gone, and the ones that failed with
 * why. */
export async function restoreBatches(dirs, restore) {
  const out = { restored: [], gone: [], failed: [] };
  for (const dir of dirs) {
    try {
      await restore(dir);
      out.restored.push(dir);
    } catch (err) {
      if (isGoneError(err)) out.gone.push(dir);
      else out.failed.push({ dir, error: err?.message ?? String(err) });
    }
  }
  return out;
}
