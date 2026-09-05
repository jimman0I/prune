import { listQuarantineBatches, deletePermanently } from './quarantine.js';

/** Emptying the quarantine on a timer.
 *
 * Quarantine is the app's undo. Everything Deep Clean removes and every
 * leftover an uninstall finds goes there instead of being deleted, and it
 * grows without limit -- which is the right default, and eventually a
 * folder nobody wanted holding gigabytes nobody remembers.
 *
 * So this is opt-in and it is off unless a real number of days is set.
 * Every ambiguous value resolves to off rather than to a duration,
 * because the failure modes are not symmetric: a retention that fails to
 * run wastes disk, and one that runs when it should not destroys the only
 * copy of something the user deleted by accident.
 */

/** Retention disabled. Not 0 and not null: a named value, so a caller
 * cannot accidentally treat "off" as a number of days and vice versa. */
export const RETENTION_OFF = null;

/** The retention window from settings, in days, or RETENTION_OFF.
 *
 * Zero means off. It is tempting to read it as "purge immediately", and
 * that reading empties the safety net the moment somebody types a 0 into
 * a number field -- so it joins missing, null, negative and non-numeric
 * in meaning "keep everything". */
export function retentionDaysFrom(settings) {
  const raw = settings?.quarantineRetentionDays;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) return RETENTION_OFF;
  return days;
}

/** Which batches are older than the window.
 *
 * Strictly older, so "empty after 30 days" does not delete something on
 * its thirtieth day -- the boundary keeps the file, which is the
 * direction an irreversible operation should round.
 *
 * A batch whose manifest lost its createdAt, or carries one that is not a
 * finite number, has an UNKNOWN age and is never expired. Unknown must
 * not resolve to "delete this" for something with no undo. A timestamp in
 * the future is treated the same way rather than as an error: a clock
 * change should not empty the quarantine. */
export function expiredBatches(batches, { now = Date.now(), retentionDays = RETENTION_OFF } = {}) {
  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days <= 0) return [];

  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return (batches || []).filter((batch) => {
    const created = Number(batch?.createdAt);
    if (!Number.isFinite(created) || created > now) return false;
    return created < cutoff;
  });
}

/** Deletes every expired batch, and reports exactly what went.
 *
 * Returns the batches it removed rather than a count, because the caller
 * has to be able to say WHICH programs' backups were dropped -- "purged 3
 * batches" is not something a user can check or dispute.
 *
 * A batch that fails to delete is reported and does not stop the rest:
 * one locked file inside one batch should not leave the other four
 * sitting there for another day. */
export async function purgeExpiredQuarantine(settings, { now = Date.now() } = {}) {
  const retentionDays = retentionDaysFrom(settings);
  if (retentionDays === RETENTION_OFF) {
    return { ok: true, retentionDays: RETENTION_OFF, purged: [], failed: [] };
  }

  let batches;
  try {
    batches = await listQuarantineBatches();
  } catch (err) {
    return { ok: false, error: err.message, purged: [], failed: [] };
  }

  const expired = expiredBatches(batches, { now, retentionDays });
  const purged = [];
  const failed = [];

  for (const batch of expired) {
    try {
      const result = await deletePermanently(batch.batchDir);
      if (result?.ok === false) failed.push({ ...batch, error: result.error || 'could not be deleted' });
      else purged.push(batch);
    } catch (err) {
      failed.push({ ...batch, error: err.message });
    }
  }

  return { ok: true, retentionDays, purged, failed };
}
