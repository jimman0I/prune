/** The two things that stop a cleaner from taking a file it shouldn't.
 *
 * Both are lifted from Revo, which ships them as defaults rather than as
 * options nobody finds: its junk-file cleaner carries an exclusion list of
 * about thirty path patterns and an "ignore the last 24 hours" switch that
 * is on out of the box. Prune had neither. It had an exclusion list in its
 * settings screen that the user could add folders to, and nothing anywhere
 * in the backend ever read it -- a setting that quietly does nothing is
 * worse than no setting, because the user stops checking.
 */

/** Paths no cleaner may take a file from, whatever a rule says.
 *
 * Adapted from the list Revo ships enabled. These are not caches: they are
 * places where something that LOOKS like junk is load-bearing -- an
 * antivirus quarantine holds live malware samples, a restore folder holds
 * the machine's own rollback data, and the component store's catalogue is
 * what Windows validates its own files against.
 *
 * Written as lowercase substrings of a forward-slash-normalised path, which
 * is the same shape Revo stores them in and is enough for the job: these
 * are directory names, not patterns that need a glob engine.
 *
 * The user's own list is added to this, never replaces it. Someone who
 * types a folder into Settings is adding a rule, not removing thirty. */
export const DEFAULT_EXCLUDED = [
  '/system volume information/',
  '/$recycle.bin/',
  '/_restore/',
  '/config.msi/',
  '/windows/security/',
  '/windows/system32/catroot/',
  '/windows/system32/catroot2/',
  '/windows/system32/usmt/',
  '/windows/servicing/',
  '/windows/winsxs/',
  '/windows/twain_32/',
  '/uninstall information/',
  '/quarantine/',
  '/virusdefs/',
  '/sendto/',
  '/i386/'
];

/** One comparable spelling for a filesystem path.
 *
 * Lowercased because Windows paths are case-insensitive, forward-slashed
 * because writing the patterns above with backslashes would mean escaping
 * every one of them, and wrapped in separators so a pattern like
 * "/i386/" matches a directory called i386 and not a file called
 * "loader-i386.dll". */
export function normalizePath(path) {
  if (typeof path !== 'string' || path.trim() === '') return '';
  const slashed = path.trim().replace(/\\/g, '/').toLowerCase();
  return `/${slashed.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
}

/** Turns whatever the user typed into Settings into a matchable pattern.
 *
 * A folder they picked is an absolute path ("C:\Games"); this has to match
 * that folder and everything under it, and nothing that merely starts with
 * the same letters -- "C:\Games" must not exclude "C:\GamesBackup". The
 * surrounding separators do exactly that. */
export function toExcludePattern(folder) {
  const normalized = normalizePath(folder);
  return normalized === '' ? null : normalized;
}

/** Whether this file sits inside somewhere nothing may be taken from.
 *
 * Substring, not prefix: the defaults above are directory names that can
 * appear at any depth ("/quarantine/" is a folder inside an antivirus's
 * own install, wherever that is), while a user's entry is absolute and so
 * only ever matches at the front anyway. One test covers both. */
export function isExcluded(filePath, userFolders = []) {
  const haystack = normalizePath(filePath);
  if (haystack === '') return false;

  const patterns = [
    ...DEFAULT_EXCLUDED,
    ...userFolders.map(toExcludePattern).filter(Boolean)
  ];

  return patterns.some((pattern) => haystack.includes(pattern));
}

/** Whether a file was touched too recently to be safe to take.
 *
 * Revo's "ignore the last 24 hours", and it earns its place: the temp
 * folder is the one place on the machine where a file being written RIGHT
 * NOW looks exactly like a file abandoned two years ago. An installer
 * halfway through unpacking, a game writing a shader cache, a document
 * being converted -- all of them are junk by every rule this app has, and
 * all of them break if the file goes.
 *
 * `hours` of 0 disables the guard, which is what a user who wants
 * everything gone expects that number to mean. */
export function isTooRecent(mtimeMs, hours, now = Date.now()) {
  if (!Number.isFinite(hours) || hours <= 0) return false;
  if (!Number.isFinite(mtimeMs) || mtimeMs <= 0) return false;
  return now - mtimeMs < hours * 60 * 60 * 1000;
}

/** Splits a rule's candidate files into what may be taken and what may
 * not, with a reason for everything held back.
 *
 * A reason, not a silent drop. "Cleaned 4 files" when the user could see
 * six is the kind of small dishonesty that makes people stop trusting a
 * number, and the reason is also the only way anyone would ever discover
 * that their own exclusion is what held a file back. */
export function partitionCleanableFiles(files, { excludeFolders = [], skipRecentHours = 0, now = Date.now() } = {}) {
  const cleanable = [];
  const held = [];

  for (const file of files || []) {
    if (isExcluded(file?.path, excludeFolders)) {
      held.push({ path: file.path, reason: 'in an excluded folder' });
      continue;
    }
    if (isTooRecent(file?.mtimeMs, skipRecentHours, now)) {
      held.push({ path: file.path, reason: `modified in the last ${skipRecentHours} hours` });
      continue;
    }
    cleanable.push(file);
  }

  return { cleanable, held };
}
