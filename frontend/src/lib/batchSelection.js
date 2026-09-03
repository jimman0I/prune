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
  if (program?.source === 'store') {
    // Technically it has no uninstall command, but saying so would be
    // misleading: a Store app has a perfectly good way to be removed, it
    // is just not the one this queue runs.
    return 'Store apps are removed through Windows, not an uninstaller.';
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
