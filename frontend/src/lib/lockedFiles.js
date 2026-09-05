/** What the clean could not touch, said in one line.
 *
 * The backend already handles a locked file correctly: `executeRule`
 * records it in `skipped` with a reason and never throws, so a
 * `pagefile.sys` or an open browser cache cannot fail the run. What was
 * missing is that the screen said so in a passive half-sentence appended
 * to the result -- "some files were skipped (in use)" -- with no count,
 * no paths, and no suggestion of what to do about it.
 */

/** Files held back deliberately are NOT locked files.
 *
 * The recency guard holds back anything modified inside
 * `skipRecentHours`, which is a decision the user configured, not a
 * failure. Counting those as locked would tell someone to go and close an
 * application to release a file that nothing is holding. */
const LOCKED_REASON = /lock|access|denied|in use|EPERM|EBUSY|permission/i;

/** How many paths to carry. "3 files were skipped" invites "which ones",
 * and five answers it better than forty. */
const MAX_PATHS = 5;

export function lockedFileSummary(cleanResult) {
  const results = cleanResult?.results;
  if (!Array.isArray(results)) return null;

  const paths = [];
  for (const rule of results) {
    for (const entry of rule?.skipped || []) {
      const reason = entry?.reason ?? '';
      // No reason recorded is treated as locked: the only caller that
      // omits it is the inaccessible-file path, and under-reporting a
      // failure is worse than over-reporting one here.
      if (reason && !LOCKED_REASON.test(reason)) continue;
      if (entry?.path) paths.push(entry.path);
    }
  }

  if (paths.length === 0) return null;

  return {
    count: paths.length,
    paths: paths.slice(0, MAX_PATHS),
    message: `Skipped ${paths.length} locked ${paths.length === 1 ? 'file' : 'files'}.`,
    detail: 'Close the apps using them and clean again.'
  };
}
