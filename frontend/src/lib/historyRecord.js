import { appendHistoryEntry, updateHistoryEntry } from './api.js';

/** Writing the uninstall history, which must never get in the way of an
 * uninstall. The program has already been removed by the time these run;
 * a history that cannot be written is not a reason to tell the person their
 * uninstall failed. Both swallow every failure and say nothing. */

/** Records an entry; resolves its id, or null when it was not written (the
 * history is off, or the write failed). */
export async function recordHistory(fields) {
  try {
    const result = await appendHistoryEntry(fields);
    return typeof result?.id === 'string' ? result.id : null;
  } catch {
    return null;
  }
}

/** Adds what is known now to an entry written earlier. */
export async function patchHistory(id, fields) {
  if (!id) return false;
  try {
    await updateHistoryEntry(id, fields);
    return true;
  } catch {
    return false;
  }
}

/** The numbers a removal adds to its entry, from the removal manifest and
 * the scan it followed. */
export function removalFields(manifest, scanResult) {
  const tasks = manifest?.scheduledTasks?.removed?.length ?? 0;
  const found = ['files', 'registryKeys', 'scheduledTasks']
    .reduce((sum, group) => sum + (scanResult?.[group]?.items?.length ?? 0), 0);
  const failed = (manifest?.failedFiles?.length ?? 0) + (manifest?.failedRegistryKeys?.length ?? 0)
    + (manifest?.scheduledTasks?.failed?.length ?? 0);
  const fields = {
    leftoversFound: found,
    leftoversRemoved: (manifest?.files?.length ?? 0) + (manifest?.registryKeys?.length ?? 0) + tasks,
    bytesFreed: manifest?.totalSizeBytes ?? 0,
    tasksRemoved: tasks,
    failedCount: failed,
    outcome: failed > 0 ? 'partial' : 'removed'
  };
  if (typeof manifest?.destination === 'string') fields.destination = manifest.destination;
  if (typeof manifest?.batchDir === 'string') fields.quarantineBatch = manifest.batchDir;
  if (typeof manifest?.restorePoint?.created === 'boolean') {
    fields.restorePoint = { created: manifest.restorePoint.created };
    if (typeof manifest.restorePoint.reason === 'string') fields.restorePoint.reason = manifest.restorePoint.reason;
  }
  return fields;
}
