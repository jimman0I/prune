/** The Junk files scan's patterns: which file names count as junk.
 *
 * Deep Clean's own "Deep scan" rules (cleanerActions/deepscan.js) are fixed
 * regular expressions walked over the user's profile. This is the other half:
 * a short, EDITABLE list of Windows wildcard patterns -- `*.tmp`, `~*.*` --
 * looked for on whichever drives and folders the person picks. Because the
 * list is editable, this file's main job is saying no: a pattern that would
 * match everything, or programs, or the file that gives a folder its icon, is
 * refused with a reason before it can ever be saved, and the scan refuses
 * those files again by name whatever the pattern said (see fileNameRefusal).
 *
 * Patterns are matched against a file's NAME only, case-insensitively, with
 * the wildcard rules a Windows user already knows from the command prompt:
 * `*` is any run of characters (none included), `?` is exactly one, and a
 * trailing `.*` also matches a name with no extension at all -- `~*.*` finds
 * `~lock` as well as `~$report.docx`, exactly as `dir ~*.*` would. Nothing
 * else is special: `[` is a character, not a class.
 *
 * Pure functions; nothing here touches the disk. */

/** The patterns a new install starts with, and what Reset to defaults puts
 * back. Each one is here for a stated reason, and two are listed but OFF so
 * the person can turn them on knowing what they are. `*.tmp`-style names are
 * stored as written; matching ignores case. */
export const DEFAULT_JUNK_PATTERNS = Object.freeze([
  // Scratch files a program writes while it works and is meant to delete when
  // it is done. Left behind by crashes and killed installers. One being
  // written right now looks the same, which is what the "modified in the last
  // N hours" guard is for -- and an open one is locked and skipped anyway.
  Object.freeze({ pattern: '*.tmp', enabled: true }),
  // The same thing spelled out; less common, same meaning.
  Object.freeze({ pattern: '*.temp', enabled: true }),
  // Office's owner files ("~$Report.docx", 162 bytes, saying who has the
  // document open) and the "~WRL0001.tmp" family, orphaned whenever Office
  // closes badly. On, but never ticked for removal by default: a leading
  // tilde is a naming habit, not a file type, and some people name their own
  // files that way to sort them first.
  Object.freeze({ pattern: '~*.*', enabled: true }),
  // Editor backups that replace the extension's first letter with a tilde
  // ("unit1.~pas", "report.~doc"). On, never pre-ticked: a backup can be the
  // only copy of the version before a bad save.
  Object.freeze({ pattern: '*.~*', enabled: true }),
  // Check Disk's recovered fragments. Special-cased (see CHK_SPECIAL): only
  // FILE0000.CHK-style names directly inside a FOUND.000-style folder at a
  // drive's root, never any other .chk -- programs use that extension for
  // their own checkpoints and checksums. Never pre-ticked: a fragment can be
  // the last remaining piece of a file the disk lost.
  Object.freeze({ pattern: '*.chk', enabled: true }),
  // Something renamed aside before an update replaced it ("hosts.old",
  // "settings.old"). Often the only copy of a previous configuration, so
  // offered but never pre-ticked.
  Object.freeze({ pattern: '*.old', enabled: true }),
  // Windows Help's index cache, rebuilt the next time that help file opens.
  // Nothing is lost by removing one.
  Object.freeze({ pattern: '*.gid', enabled: true }),
  // Crash dumps. Large, and useless to anyone not debugging that crash --
  // which is exactly who might have kept one on purpose (a developer, or a
  // support case that asked for it). Offered, never pre-ticked; Deep Clean
  // already clears Windows' own crash-dump folders.
  Object.freeze({ pattern: '*.dmp', enabled: true }),
  // Explorer's per-folder thumbnail cache from before Vista. Rebuilt on
  // demand, and only ever a cache.
  Object.freeze({ pattern: 'thumbs.db', enabled: true }),
  // Listed but OFF: ".bak" is what people and programs call a deliberate
  // backup, and a backup is the opposite of junk. Turn it on knowingly.
  Object.freeze({ pattern: '*.bak', enabled: false }),
  // Listed but OFF: logs are what anyone reaches for when something breaks,
  // some programs keep their history in them, and a log being written is
  // usually locked. Turn it on knowingly.
  Object.freeze({ pattern: '*.log', enabled: false })
]);

/** The patterns whose results start TICKED for removal. Only names that are
 * by definition never the only copy of anything: scratch files and caches
 * that rebuild themselves. Everything else a scan finds starts unticked, the
 * same rule Deep Clean follows for any rule that can lose something. A
 * pattern the person adds is never in here, whatever it is. */
export const PRESELECTED_PATTERNS = Object.freeze(['*.tmp', '*.temp', '*.gid', 'thumbs.db']);

/** Check Disk's lost-cluster files, the one pattern that is more than a name:
 * `*.chk` means FILE####.CHK inside FOUND.### and nothing else. */
const CHK_SPECIAL = '*.chk';
const CHK_NAME = /^file\d{4}\.chk$/i;
const CHK_FOLDER = /^found\.\d{3}$/i;

/** Never offered, whatever a pattern says, and refused in the list when a
 * pattern names them: programs, libraries, drivers, installers and updates,
 * the fonts-and-strings resources Windows loads with them, and the signature
 * catalogs it checks them against. A "junk" match on any of these is a broken
 * program, not free space. */
export const NEVER_EXTENSIONS = Object.freeze([
  'exe', 'dll', 'sys', 'msi', 'msp', 'msu', 'com', 'scr', 'cpl', 'ocx', 'drv', 'efi', 'mui', 'cat'
]);

/** desktop.ini is how Windows gives a folder its icon, its localized name
 * (it is why "Documents" reads "Documents" in every language) and its view.
 * It looks like clutter and is not. */
const DESKTOP_INI = 'desktop.ini';

export const MAX_PATTERN_LENGTH = 64;
export const MAX_PATTERNS = 100;

const REGEX_SPECIALS = /[.+^${}()|[\]\\]/g;

/** One wildcard pattern as a whole-name RegExp, case-insensitive. */
export function globToRegExp(pattern) {
  let body = pattern;
  let optionalExtension = false;
  // Windows' own rule: "name.*" matches "name" too. Only a TRAILING ".*",
  // and not when that is the whole pattern (which validation refuses anyway).
  if (body.length > 2 && body.endsWith('.*')) {
    body = body.slice(0, -2);
    optionalExtension = true;
  }
  let source = '';
  for (const ch of body) {
    if (ch === '*') source += '.*';
    else if (ch === '?') source += '.';
    else source += ch.replace(REGEX_SPECIALS, '\\$&');
  }
  return new RegExp(`^${source}${optionalExtension ? '(?:\\..*)?' : ''}$`, 'iu');
}

/** The extension part of a pattern, or null when it has no dot. */
function extensionPart(pattern) {
  const dot = pattern.lastIndexOf('.');
  return dot === -1 ? null : pattern.slice(dot + 1);
}

/** Whether a name's own extension is one of NEVER_EXTENSIONS. */
function hasNeverExtension(name) {
  const match = /\.([^.]+)$/.exec(name);
  return Boolean(match) && NEVER_EXTENSIONS.includes(match[1].toLowerCase());
}

/** { ok: true, pattern } with the pattern tidied (trimmed), or
 * { ok: false, reason } where reason is one of:
 *   empty      -- nothing typed
 *   long       -- over MAX_PATTERN_LENGTH characters
 *   separator  -- a folder, a drive or a path: patterns are names only
 *   invalid    -- a character no Windows file name can contain
 *   everything -- only wildcards and dots: it would match every file
 *   executable -- it names programs, libraries, drivers or installers
 *   desktopIni -- it would match desktop.ini
 * Reasons are codes, not sentences: the Settings screen says them in the
 * person's language. */
export function validateJunkPattern(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'empty' };
  const pattern = raw.trim();
  if (pattern.length > MAX_PATTERN_LENGTH) return { ok: false, reason: 'long' };
  if (/[\\/:]/.test(pattern)) return { ok: false, reason: 'separator' };
  // eslint-disable-next-line no-control-regex
  if (/[<>"|\u0000-\u001f]/.test(pattern)) return { ok: false, reason: 'invalid' };
  if (pattern.replace(/[*?.\s]/g, '') === '') return { ok: false, reason: 'everything' };

  // A pattern whose EXTENSION can only be a program's (`*.exe`, `*.dl?`,
  // `setup.ms*`) is refused outright. A bare `*` extension (`~*.*`) is not:
  // it means "any extension", and the scan drops the program files it would
  // reach by name instead (fileNameRefusal) -- refusing it here would refuse
  // every pattern that ends in ".*".
  const ext = extensionPart(pattern);
  if (ext !== null && ext !== '*') {
    const extRegex = globToRegExp(ext);
    if (NEVER_EXTENSIONS.some((never) => extRegex.test(never))) return { ok: false, reason: 'executable' };
  }

  if (globToRegExp(pattern).test(DESKTOP_INI)) return { ok: false, reason: 'desktopIni' };
  return { ok: true, pattern };
}

/** The saved list as everything else can rely on it: [{ pattern, enabled }],
 * valid entries only, in order, without duplicates (compared ignoring case),
 * capped at MAX_PATTERNS. A plain string is an enabled pattern. Anything that
 * is not a list -- a missing key, a corrupted file -- is the defaults; an
 * empty list stays empty, because removing every pattern is a choice. Only an
 * explicit `enabled: false` turns one off: a hand-edited entry that forgot
 * the field is searched for, and a search on its own removes nothing. */
export function normalizeJunkPatterns(value) {
  if (!Array.isArray(value)) return defaultJunkPatterns();
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    const raw = typeof entry === 'string' ? entry : entry?.pattern;
    const checked = validateJunkPattern(raw);
    if (!checked.ok) continue;
    const key = checked.pattern.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ pattern: checked.pattern, enabled: typeof entry === 'string' ? true : entry.enabled !== false });
    if (out.length >= MAX_PATTERNS) break;
  }
  return out;
}

/** A fresh, unfrozen copy of the defaults -- what is saved, and edited later. */
export function defaultJunkPatterns() {
  return DEFAULT_JUNK_PATTERNS.map((p) => ({ ...p }));
}

export function isPreselected(pattern) {
  return typeof pattern === 'string' && PRESELECTED_PATTERNS.includes(pattern.toLowerCase());
}

/** The enabled patterns, compiled once per scan, in list order: the first one
 * that matches a file is the group it is shown under. */
export function compileJunkPatterns(patterns) {
  return normalizeJunkPatterns(patterns)
    .filter((p) => p.enabled)
    .map(({ pattern }) => {
      const chk = pattern.toLowerCase() === CHK_SPECIAL;
      return { pattern, regex: chk ? CHK_NAME : globToRegExp(pattern), chk, preselected: isPreselected(pattern) };
    });
}

/** The first compiled pattern this file matches, or null. `parentName` is the
 * name of the folder it sits in, and `parentIsDriveChild` whether that folder
 * is directly under a drive's root -- the two facts the Check Disk pattern
 * needs (FOUND.000 only ever appears at a root). */
export function matchJunkName(name, compiled, { parentName = '', parentIsDriveChild = false } = {}) {
  if (typeof name !== 'string' || name === '') return null;
  for (const entry of compiled) {
    if (!entry.regex.test(name)) continue;
    if (entry.chk && !(parentIsDriveChild && CHK_FOLDER.test(parentName))) continue;
    return entry;
  }
  return null;
}

/** Why a file must never be offered by name alone, or null: 'executable' for
 * NEVER_EXTENSIONS, 'desktopIni' for desktop.ini. Applied to every match, so
 * a pattern like `~*.*` that is fine in itself still never offers
 * "~setup.exe". */
export function fileNameRefusal(name) {
  if (typeof name !== 'string') return 'executable';
  if (name.toLowerCase() === DESKTOP_INI) return 'desktopIni';
  if (hasNeverExtension(name)) return 'executable';
  return null;
}
