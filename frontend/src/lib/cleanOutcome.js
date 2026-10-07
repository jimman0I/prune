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

/** What the confirm bar's "this run only" removal mode actually is, once the
 * person's per-run choice is combined with the Settings default.
 *
 * `deleteNow` is the confirm bar's own toggle -- ticked makes this one clean
 * delete, unticked leaves the Settings default alone. So: ticking it always
 * means 'delete'; leaving it off keeps Recycle exactly as configured, and
 * only replaces a Settings default of 'delete' with the reversible
 * 'quarantine' -- backing out of a global delete-now default for one run is
 * a request to be safe, never a request to guess which other mode they meant. */
export function effectiveRemovalMode(settingsMode, deleteNow) {
  if (deleteNow) return 'delete';
  return settingsMode === 'delete' ? 'quarantine' : settingsMode;
}

/** The value sent to the backend for this one run, or undefined to say
 * nothing and let it use the saved setting. Only ever 'delete' or
 * 'quarantine' -- see cleanGuardsFrom's own doc comment: recycle is never
 * something a client asks for, only something Settings configures. */
export function removalOverrideFor(settingsMode, deleteNow) {
  if (deleteNow) return 'delete';
  if (settingsMode === 'delete') return 'quarantine';
  return undefined;
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
