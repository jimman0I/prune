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

/** The English this carries when no translated set is passed in -- a
 * plain default rather than the only option, the same pattern
 * lib/batchSelection.js's `reasons` and lib/groupStartupItems.js's
 * `labels` both use: this is a plain utility function with no access to
 * the language hook, so the CALLER supplies a translated set
 * (DeepClean.jsx passes `t('deepClean.locked')`) and this file stays
 * free of any i18n import of its own. Exported so this file's own tests,
 * which never pass a second argument, keep asserting the exact English
 * wording. */
export const DEFAULT_LOCKED_MESSAGES = {
  message: (count) => `Skipped ${count} locked ${count === 1 ? 'file' : 'files'}.`,
  detail: 'Close the apps using them and clean again.'
};

export function lockedFileSummary(cleanResult, messages = DEFAULT_LOCKED_MESSAGES) {
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
    message: messages.message(paths.length),
    detail: messages.detail
  };
}
