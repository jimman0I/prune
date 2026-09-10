/** Whether a program can take part in a batch uninstall.
 *
 * A batch runs uninstallers back to back with no one reviewing each one,
 * so the bar is higher than for a single click: the program must have a
 * command that can actually run. */
export function canBatchUninstall(program) {
  return batchIneligibleReason(program) === null;
}

/** Why a program can't be batch-uninstalled, or null if it can.
 *
 * Returned as a sentence rather than a boolean so the row can say what to
 * do instead. A checkbox that is disabled for no visible reason is a dead
 * end. */
export function batchIneligibleReason(program) {
  if (program?.health?.orphaned) {
    // Its uninstaller is gone, so running it would fail every time. The
    // forced path exists for exactly this, and it is a per-program review
    // of what to delete -- not something to run unattended across a queue.
    return 'Its uninstaller is broken — use Force remove instead.';
  }
  if (program?.source === 'extension') {
    return 'Browser extensions are removed from the browser itself.';
  }
  if (program?.source === 'store') {
    /* Eligible since Prune can remove a Store app itself, but on a
     * stricter condition than the single-app button. A batch runs with
     * nobody reviewing each removal, so only an app Windows has EXPLICITLY
     * said may be removed is let in: an unknown NonRemovable means out,
     * the same lopsided default the backend's reading of the flag uses. */
    if (!program.packageFullName) return 'This Store app has no package name to remove.';
    if (program.nonRemovable === true) {
      return 'Windows marks this app as part of the system and does not allow it to be removed.';
    }
    if (program.nonRemovable !== false) {
      return 'Windows has not said whether this app can be removed, so it is left out of the batch.';
    }
    // Returned here, before the uninstall-command rule below -- which
    // every Store app would fail, since it has no command and needs none.
    return null;
  }
  if (!program?.uninstallString) {
    return 'No uninstall command is registered for this program.';
  }
  return null;
}

/** Count and total size of a selection.
 *
 * A missing size is unknown, not zero. Adding it in as 0 would understate
 * the total while looking exact, so it's counted separately and the UI
 * can say "and some of unknown size". */
export function batchSummary(programs) {
  let totalBytes = 0;
  let unknownSizes = 0;
  for (const program of programs) {
    if (typeof program.sizeBytes === 'number') totalBytes += program.sizeBytes;
    else unknownSizes++;
  }
  return { count: programs.length, totalBytes, unknownSizes };
}
