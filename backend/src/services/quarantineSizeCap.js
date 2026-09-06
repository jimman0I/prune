import { listQuarantineBatches, deletePermanently } from './quarantine.js';

/** Keeping the quarantine from growing without limit.
 *
 * The second half of the same problem quarantineRetention.js solves.
 * Everything Deep Clean removes, every leftover an uninstall finds and
 * every folder taken off the Disk Map goes here instead of being deleted,
 * and none of it ever leaves on its own. On a machine where the app is
 * doing its job that is gigabytes -- which is a poor outcome for a disk
 * cleaner specifically, since the tool the user opened to get space back
 * is the one quietly holding it.
 *
 * Age and size are genuinely different questions and neither answers the
 * other. A weekly user with a 30-day window can still fill a drive in an
 * afternoon by uninstalling four games; a machine that is used twice a
 * year keeps its undo for exactly as long as it should and never
 * approaches any cap. So this is a second, independent limit rather than
 * a replacement.
 *
 * Off by default, and off for every ambiguous value, on the same
 * reasoning quarantineRetention.js sets out: the failure modes are not
 * symmetric. A cap that fails to run wastes disk. A cap that runs when it
 * should not destroys the only copy of something the user deleted by
 * accident.
 */

/** No cap. Named rather than 0 or null so a caller cannot accidentally
 * treat "off" as a number of bytes, or the reverse. */
export const SIZE_CAP_OFF = null;

/** 1024-based, because the quarantine screen's own formatBytes is.
 *
 * Not a pedantic distinction here: it is the difference between a setting
 * that agrees with the number printed above it and one that does not.
 * Someone who sets a 5 GB cap and reads "4.9 GB held" is owed those two
 * figures being in the same unit. */
export const GIB = 1024 ** 3;

/** The cap from settings, in bytes, or SIZE_CAP_OFF.
 *
 * Zero means off. Read as "hold nothing" it would empty the safety net
 * the moment somebody typed a 0 into a number field, so it joins missing,
 * null, negative, infinite and non-numeric in meaning "keep everything". */
export function maxBytesFrom(settings) {
  const gigabytes = Number(settings?.quarantineMaxSizeGb);
  if (!Number.isFinite(gigabytes) || gigabytes <= 0) return SIZE_CAP_OFF;
  return gigabytes * GIB;
}

/** A batch's recorded size, if it recorded one.
 *
 * quarantineAndDelete stats every file it moves, so its manifests carry a
 * real number. quarantinePath records the size the Disk Map's scan
 * already had rather than walking the tree again, and a client that sends
 * none leaves it null. */
function sizeOf(batch) {
  // Checked before Number(), because Number(null) is 0 -- an unmeasured
  // batch would otherwise read as one measured at zero bytes, which is
  // exactly the conflation quarantineTotals exists to avoid.
  const raw = batch?.totalSizeBytes;
  if (raw === null || raw === undefined) return null;
  const bytes = Number(raw);
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

/** Newest first. A batch with no usable createdAt sorts to the back:
 * unknown age is not evidence of being new, and treating it as newest
 * would let a corrupted manifest protect itself from every purge
 * indefinitely. */
function newestFirst(batches) {
  return [...(batches || [])].sort((a, b) => {
    const left = Number(a?.createdAt);
    const right = Number(b?.createdAt);
    return (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity);
  });
}

/** What the quarantine is holding.
 *
 * An unmeasured batch is counted separately rather than added in as 0,
 * which would understate the total while looking exact -- the same
 * distinction batchSummary draws for a program with no recorded size.
 * `exact` is what lets the UI say "at least" when it has to. */
export function quarantineTotals(batches) {
  const list = batches || [];
  let totalBytes = 0;
  let unknownSizeCount = 0;
  for (const batch of list) {
    const bytes = sizeOf(batch);
    if (bytes === null) unknownSizeCount++;
    else totalBytes += bytes;
  }
  return { totalBytes, batchCount: list.length, unknownSizeCount, exact: unknownSizeCount === 0 };
}

/** Which batches have to go for the quarantine to fit, oldest first.
 *
 * Two rules, and the second one is why this is not simply "delete until
 * it fits":
 *
 *   Oldest first. The newest batch is the thing the user just did and
 *   the one they are likeliest to want back.
 *
 *   The newest batch is never dropped, even when it alone exceeds the
 *   cap. Someone quarantining a 60 GB folder from the Disk Map under a
 *   5 GB cap would otherwise have it permanently destroyed by the very
 *   feature they used to keep it safe. The cap does not hold in that
 *   case, and that is the honest outcome: the quarantine contains one
 *   item larger than its whole budget, and saying so is better than
 *   silently obeying a number.
 *
 * An unmeasured batch counts as zero toward the running total, so it can
 * never push a measured one out. It can still be dropped itself once
 * measured batches cross the line -- it is a batch like any other, it
 * just does not contribute a number nobody recorded.
 */
export function batchesOverCap(batches, { maxBytes = SIZE_CAP_OFF } = {}) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return [];

  const sorted = newestFirst(batches);
  let running = 0;
  for (let i = 0; i < sorted.length; i++) {
    running += sizeOf(sorted[i]) ?? 0;
    // i > 0 is the "never the newest" rule. Reached at i === 0 it would
    // mean dropping the batch that was just created.
    if (i > 0 && running > maxBytes) return sorted.slice(i);
  }
  return [];
}

/** Deletes whatever is over the cap, and reports exactly what went.
 *
 * Returns the batches rather than a count, for the reason
 * purgeExpiredQuarantine already gives: the caller has to be able to say
 * WHICH programs' backups were dropped, and "purged 3 batches" is not
 * something a user can check or dispute.
 *
 * A batch that fails to delete is reported and does not stop the rest.
 * `stillOverCap` is true when the quarantine is over its limit even after
 * this ran -- one batch larger than the whole budget, or a failed delete
 * -- because a limit quietly not holding is worse than one that says so.
 */
export async function purgeOversizeQuarantine(settings, { batches = null } = {}) {
  const maxBytes = maxBytesFrom(settings);
  if (maxBytes === SIZE_CAP_OFF) {
    return { ok: true, maxBytes: SIZE_CAP_OFF, purged: [], failed: [], stillOverCap: false };
  }

  let list = batches;
  if (!list) {
    try {
      list = await listQuarantineBatches();
    } catch (err) {
      return { ok: false, error: err.message, maxBytes, purged: [], failed: [], stillOverCap: false };
    }
  }

  const doomed = batchesOverCap(list, { maxBytes });
  const purged = [];
  const failed = [];
  for (const batch of doomed) {
    try {
      const result = await deletePermanently(batch.batchDir);
      if (result?.deleted === false) failed.push({ ...batch, error: 'could not be deleted' });
      else purged.push(batch);
    } catch (err) {
      failed.push({ ...batch, error: err.message });
    }
  }

  const kept = list.filter((batch) => !purged.includes(batch));
  const totals = quarantineTotals(kept);
  return {
    ok: true,
    maxBytes,
    purged,
    failed,
    totalBytes: totals.totalBytes,
    stillOverCap: totals.totalBytes > maxBytes
  };
}
