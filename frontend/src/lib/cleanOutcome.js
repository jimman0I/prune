/** What a Deep Clean actually did, and what it is about to do.
 *
 * Two facts the screen used to run together under one word, "Freed":
 * files that were DELETED (the space is back on the drive) and files that
 * were MOVED into Quarantine or the Recycle Bin (they are out of their
 * folder and the drive is exactly as full as before). Telling someone 15.7
 * GB was freed when it had merely been renamed into another folder on the
 * same disk is the kind of number this app exists not to print.
 */

/** How the next Clean will remove files, from settings: 'delete' only when
 * the setting is exactly 'delete'; 'recycle' when Auto-Quarantine is off
 * (the backend then sends files to the Recycle Bin); otherwise
 * 'quarantine'. Anything unreadable is the reversible one.
 *
 * Mirrors the backend, which decides for itself -- this only decides what
 * the screen SAYS beforehand, and is never sent anywhere. */
export function removalModeFrom(settings) {
  if (settings?.deepCleanRemoval === 'delete') return 'delete';
  if (settings?.autoQuarantine === false) return 'recycle';
  return 'quarantine';
}

/** The numbers and destination of a finished clean.
 *
 * `freedBytes` is what was deleted or compacted in place, `movedBytes` what
 * was taken out of its folder but still exists, and `movedTo` says where:
 * 'quarantine' or 'recycle' (null when nothing was moved). Read from the
 * per-rule results, because that is where the backend records which of
 * them happened. */
export function cleanOutcome(result) {
  const results = Array.isArray(result?.results) ? result.results : [];
  const freedBytes = Number(result?.freedBytes) || 0;
  const movedBytes = Number(result?.movedBytes) || 0;
  let movedTo = null;
  if (movedBytes > 0) {
    movedTo = results.some((r) => r?.quarantineBatch) || !results.some((r) => r?.recycled) ? 'quarantine' : 'recycle';
  }
  return { freedBytes, movedBytes, movedTo };
}
