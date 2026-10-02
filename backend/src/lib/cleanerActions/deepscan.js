import { readdir, lstat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { partitionCleanableFiles, isExcluded, normalizePath } from '../cleanGuards.js';
import { executeFiles } from './delete.js';
import { createTopFiles, FILE_LIST_LIMIT } from '../topFiles.js';
import { quarantineRoot } from '../../services/quarantine.js';
import { settingsPath } from '../../services/settings.js';

/** BleachBit's "Deep scan" cleaner, for Windows.
 *
 * Every other rule here names a folder. These name a FILE PATTERN and look
 * for it everywhere under the user's profile -- the backup a text editor
 * left three projects deep, the Thumbs.db Explorer dropped in a photo
 * folder. That is why BleachBit warns "This option is slow", and why this
 * walk is asynchronous, capped, and cancellable rather than one more
 * synchronous readdir loop: it can touch millions of entries.
 *
 * The definitions are BleachBit's own (cleaners/deepscan.xml, master,
 * read 2026-09): each option is a regular expression matched against the
 * FILE NAME, case-insensitively on Windows, with no other conditions.
 * BleachBit's walk (DeepScan.py) descends into every folder except links
 * and reparse points and the user's own keep-list; it does not skip
 * node_modules or .git, and neither does this. What Prune adds is only
 * ever a refusal: its own Quarantine and data folders, and the same
 * excluded folders and file types every other rule already honours.
 *
 * `vim_swap_root` is not here. BleachBit declares it path="/" os="linux":
 * on Windows it does not run at all, so a Windows rule for it would be a
 * checkbox that does nothing.
 */

/** BleachBit's `backup` option: two actions. */
export const BACKUP = ['\\.[Bb][Aa][Kk]$', '[a-zA-Z]{1,4}~$'];
/** `ds_store`. */
export const DS_STORE = ['^\\.DS_Store$'];
/** `thumbs_db`. The second is an NTFS alternate-data-stream spelling that
 * cannot appear as a directory entry; kept because it is BleachBit's. */
export const THUMBS_DB = ['^Thumbs\\.db$', '^Thumbs\\.db:encryptable$'];
/** `tmp`: Word's ~wrXNNNN.tmp and PowerPoint's pptNNNN.tmp -- not every .tmp. */
export const TMP = ['^~wr[a-z][0-9]{4}\\.tmp$', '^ppt[0-9]{4}\\.tmp$'];
/** `vim_swap_user`: VIM's .swn/.swo/.swp. */
export const VIM_SWAP_USER = ['^.*\\.sw[nop]$'];

/** What one walk may spend before it stops and says it stopped.
 *
 * Generous, because a real profile is large -- AppData alone is often a
 * million entries -- and finite, because a walk that never ends is a
 * feature that looks hung. Hitting one is reported as an incomplete
 * measurement, never as a complete one. */
export const DEFAULT_LIMITS = {
  maxEntries: 3_000_000,
  maxMatches: 100_000,
  maxDepth: 64,
  maxMs: 180_000
};

/** Folders the walk must never enter whatever the caller says: Prune's own
 * Quarantine, and the folder its settings live in (which holds the wipe
 * filler too). Compared as normalized paths. */
function ownFolders() {
  const folders = [quarantineRoot()];
  try { folders.push(dirname(settingsPath())); } catch { /* no settings path: nothing to protect */ }
  return folders.filter(Boolean);
}

function isUnder(path, folders) {
  const target = normalizePath(path);
  return folders.some((f) => {
    const own = normalizePath(f);
    return own !== '' && target.startsWith(own);
  });
}

/** Whether a directory entry is a real directory rather than a link.
 * A junction can point anywhere -- out of the profile, onto another drive,
 * back at its own parent -- and following one is how a "profile scan"
 * ends up deleting from somewhere else. lstat reports a junction as a
 * link on Windows, where the Dirent alone may not. */
async function isRealDirectory(path) {
  try {
    const info = await lstat(path);
    return info.isDirectory() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Walks `root` for files whose NAME matches any of `patterns`.
 *
 * Resolves to { files: [{path, sizeBytes, mtimeMs}], truncated, dirs,
 * entries, rootReadable }. `truncated` is null for a complete walk, else
 * why it stopped: 'entries' | 'matches' | 'depth' | 'time' | 'aborted'.
 * Everything found before that point is kept and still real.
 *
 * Breadth of control, all injectable so tests write a handful of files
 * rather than a million: `limits`, `signal`, `excludeFolders`, `skipDirs`,
 * `onProgress` (called at most every `progressEveryMs`). */
export async function findFiles(root, {
  patterns,
  flags = 'i',
  signal,
  limits = {},
  excludeFolders = [],
  skipDirs,
  onProgress,
  progressEveryMs = 250
} = {}) {
  const cap = { ...DEFAULT_LIMITS, ...limits };
  const regexes = patterns.map((p) => new RegExp(p, flags));
  const never = skipDirs ?? ownFolders();
  const files = [];
  const started = Date.now();
  let dirs = 0;
  let entries = 0;
  let truncated = null;
  let rootReadable = true;
  let lastProgress = 0;

  const report = (force = false) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgress < progressEveryMs) return;
    lastProgress = now;
    onProgress({ dirs, entries, matches: files.length });
  };

  const stack = [{ dir: root, depth: 0 }];
  walk: while (stack.length > 0) {
    if (signal?.aborted) { truncated = 'aborted'; break; }
    if (Date.now() - started > cap.maxMs) { truncated = 'time'; break; }

    const { dir, depth } = stack.pop();
    let listing;
    try {
      listing = await readdir(dir, { withFileTypes: true });
    } catch {
      // A folder that will not list is skipped, not fatal: a profile always
      // holds a few (Application Data junctions, other users' leftovers).
      if (dir === root) rootReadable = false;
      continue;
    }
    dirs += 1;

    for (const entry of listing) {
      entries += 1;
      if (entries > cap.maxEntries) { truncated = 'entries'; break walk; }

      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth + 1 > cap.maxDepth) { truncated = truncated ?? 'depth'; continue; }
        if (isUnder(full, never) || isExcluded(full, excludeFolders)) continue;
        if (!(await isRealDirectory(full))) continue;
        stack.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile()) {
        if (!regexes.some((re) => re.test(entry.name))) continue;
        try {
          const info = await lstat(full);
          if (!info.isFile()) continue;
          files.push({ path: full, sizeBytes: info.size, mtimeMs: info.mtimeMs });
        } catch { /* gone between listing and stat */ }
        if (files.length >= cap.maxMatches) { truncated = 'matches'; break walk; }
      }
    }
    report();
  }

  report(true);
  return { files, truncated, dirs, entries, rootReadable };
}

/** Same guards every rule runs its matches through -- excluded folders and
 * types, and "modified in the last N hours". */
function guarded(found, guards) {
  return partitionCleanableFiles(found.files, guards);
}

function walkOptions(action, guards) {
  return {
    patterns: action.patterns,
    signal: guards.signal,
    limits: guards.limits,
    excludeFolders: guards.excludeFolders,
    skipDirs: guards.skipDirs,
    onProgress: guards.onProgress
  };
}

/** Preview: how much a clean would take, without touching anything. */
export async function scan(action, guards = {}) {
  const found = await findFiles(action.expandedRoot, walkOptions(action, guards));
  const { cleanable, held } = guarded(found, guards);
  const top = createTopFiles(FILE_LIST_LIMIT);
  for (const file of cleanable) top.add(file.path, file.sizeBytes);
  return {
    files: top.toArray(),
    sizeBytes: cleanable.reduce((sum, f) => sum + f.sizeBytes, 0),
    fileCount: cleanable.length,
    heldCount: held.length,
    accessible: found.rootReadable,
    // Set when the walk hit a cap or was stopped, so the number on screen
    // is labelled a partial measurement rather than passed off as a total.
    ...(found.truncated ? { incomplete: found.truncated } : {}),
    dirs: found.dirs
  };
}

/** Clean: walk again (the disk may have changed since Preview) and take
 * what matches through the same road every other file rule uses. */
export async function execute(action, ruleName, guards = {}) {
  const found = await findFiles(action.expandedRoot, walkOptions(action, guards));
  // A Stop pressed during the walk means nothing has been touched yet, and
  // nothing will be: a half-finished walk must not become a half-finished
  // delete of whatever it happened to reach.
  if (found.truncated === 'aborted') return { freedBytes: 0, skipped: [] };
  const { cleanable, held } = guarded(found, guards);
  return executeFiles(cleanable, held, ruleName, guards);
}
