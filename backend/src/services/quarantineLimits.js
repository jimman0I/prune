import { listQuarantineBatches } from './quarantine.js';
import { purgeExpiredQuarantine, retentionDaysFrom, RETENTION_OFF } from './quarantineRetention.js';
import { purgeOversizeQuarantine, maxBytesFrom, SIZE_CAP_OFF } from './quarantineSizeCap.js';

/** Both quarantine limits, applied together.
 *
 * There are two rules -- an age window and a size cap -- with separate
 * settings, separate reasoning and no overlap. Nobody outside this file
 * should have to remember that there are two, or which order they go in.
 *
 * That order is age, then size, and it is not arbitrary. An expired batch
 * should go for being expired whatever the total happens to be. Running
 * size first could evict a batch that was about to be removed anyway and
 * spare one the user had already said to stop keeping.
 *
 * Every batch that goes is named along with WHICH rule took it. A user
 * looking for a backup that is not there is owed better than "purged 3":
 * "removed for being older than 30 days" and "removed to stay under 5 GB"
 * are different facts, and only one of them is fixed by raising a number.
 */

/** A batch, as something a person can be told about. */
function removed(batch, reason) {
  return { programName: batch?.programName, reason };
}

export async function enforceQuarantineLimits(settings) {
  const retentionDays = retentionDaysFrom(settings);
  const maxBytes = maxBytesFrom(settings);

  // Both off is the default, and this runs after every removal, so the
  // no-op path must not read the quarantine directory either.
  if (retentionDays === RETENTION_OFF && maxBytes === SIZE_CAP_OFF) {
    return {
      ok: true, purged: [], failed: [], errors: [],
      retentionDays, maxBytes, stillOverCap: false
    };
  }

  const purged = [];
  const failed = [];
  const errors = [];

  const byAge = await purgeExpiredQuarantine(settings);
  for (const batch of byAge.purged || []) purged.push(removed(batch, 'age'));
  for (const batch of byAge.failed || []) failed.push({ ...removed(batch, 'age'), error: batch.error });
  if (byAge.ok === false && byAge.error) errors.push(byAge.error);

  // Deliberately still runs when the age pass failed. They are
  // independent limits, and an unreadable listing in one is not a reason
  // to leave the disk unprotected by the other.
  //
  // The size pass is handed the list that remains rather than reading it
  // again, so it cannot decide against batches the age pass has already
  // taken -- or report deleting them a second time.
  let remaining = null;
  if (maxBytes !== SIZE_CAP_OFF) {
    try {
      remaining = await listQuarantineBatches();
    } catch (err) {
      errors.push(err.message);
    }
  }

  const bySize = await purgeOversizeQuarantine(settings, remaining ? { batches: remaining } : {});
  for (const batch of bySize.purged || []) purged.push(removed(batch, 'size'));
  for (const batch of bySize.failed || []) failed.push({ ...removed(batch, 'size'), error: batch.error });
  if (bySize.ok === false && bySize.error) errors.push(bySize.error);

  return {
    ok: errors.length === 0,
    purged,
    failed,
    errors,
    retentionDays,
    maxBytes,
    totalBytes: bySize.totalBytes ?? null,
    stillOverCap: bySize.stillOverCap === true
  };
}
