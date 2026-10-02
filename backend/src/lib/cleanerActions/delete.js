import * as fs from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { partitionCleanableFiles } from '../cleanGuards.js';
import { quarantineAndDelete } from '../../services/quarantine.js';
import { sendToRecycleBin } from '../../services/recycleBin.js';
import { removePermanently } from '../../services/leftoverRemoval.js';
import { protectionReason } from '../../services/pathGuard.js';
import { schedulePendingDelete } from '../../services/pendingReboot.js';

/** Converts one `*`-bearing path SEGMENT (not a full path) into a
 * case-insensitive RegExp matching a filename/dirname against it --
 * `thumbcache_*.db` -> /^thumbcache_.*\.db$/i, `*` (Firefox's randomized
 * profile folder) -> /^.*$/i. */
function segmentToRegex(segment) {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Resolves one expanded path (which may contain at most one `*` in any
 * single segment -- a filename glob like `thumbcache_*.db`, or a whole
 * wildcard segment like Firefox's randomized profile folder name) against
 * the real filesystem, returning every concrete path it actually matches.
 * A path with no `*` anywhere resolves to exactly itself (existence is
 * checked later, by the caller) -- no directory listing needed for the
 * overwhelmingly common case.
 *
 * A segment that is exactly `**` is different: it means "zero or more
 * directory levels", so `Foo\**\*.tmp` finds a .tmp at any depth under Foo
 * (see resolveRecursive). */
export function resolveGlob(basePath, segments) {
  if (segments.length === 0) return [basePath];
  const [segment, ...rest] = segments;
  if (segment === '**') return resolveRecursive(basePath, rest);
  if (!segment.includes('*')) return resolveGlob(join(basePath, segment), rest);

  let entries;
  try {
    entries = readdirSync(basePath, { withFileTypes: true });
  } catch {
    return []; // the wildcard's parent directory doesn't exist -- 0 matches, not an error
  }
  const regex = segmentToRegex(segment);
  const matches = [];
  for (const entry of entries) {
    if (regex.test(entry.name)) matches.push(...resolveGlob(join(basePath, entry.name), rest));
  }
  return matches;
}

/** `**` -- zero or more directory levels, then `rest`. Only real
 * directories are descended into: a Dirent for a symlink or junction
 * reports isDirectory() false, so a junction loop can't recurse forever.
 * A trailing `**` is just its base path -- collectFiles already walks a
 * directory recursively, and expanding it here would list every file twice.
 * A subfolder that refuses listing is skipped silently (same as the `*`
 * branch -- not recorded as denied), and a folder whose name matches the
 * final pattern is taken whole by collectFiles. */
function resolveRecursive(basePath, rest) {
  if (rest.length === 0) return [basePath];
  // `**\**` is the same set as `**`; without collapsing it every directory
  // would be visited once per `**` combination.
  if (rest[0] === '**') return resolveRecursive(basePath, rest.slice(1));
  const matches = resolveGlob(basePath, rest);
  let entries;
  try {
    entries = readdirSync(basePath, { withFileTypes: true });
  } catch {
    return matches;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) matches.push(...resolveRecursive(join(basePath, entry.name), rest));
  }
  return matches;
}

/** Splits an expanded absolute Windows path into segments for resolveGlob.
 * The drive letter ("C:") is its own first segment and never contains a
 * `*`, so it always resolves through the literal (non-glob) branch above. */
export function pathToSegments(expandedPath) {
  return expandedPath.split(/[\\/]+/).filter(Boolean);
}

function isAccessDenied(err) {
  return err && (err.code === 'EPERM' || err.code === 'EACCES');
}

/** Recursively collects every real FILE under `targetPath` -- if it's a
 * file itself, that's the one result; if it's a directory, every file
 * inside it (recursively); if it doesn't exist or can't be read
 * (permission error, gone by the time it's visited), it contributes
 * nothing -- same partial-over-total-failure convention cleanup.js's own
 * dirSize/leftoverScan.js already use. */
export function collectFiles(targetPath, out, denied, excludeBasenames = null) {
  let st;
  try {
    st = statSync(targetPath);
  } catch (err) {
    if (isAccessDenied(err)) denied.push(targetPath);
    return;
  }
  if (st.isFile()) {
    out.push({ path: targetPath, sizeBytes: st.size, mtimeMs: st.mtimeMs });
    return;
  }
  if (!st.isDirectory()) return;
  let entries;
  try {
    entries = readdirSync(targetPath, { withFileTypes: true });
  } catch (err) {
    // A directory that exists but refuses to be listed is NOT an empty
    // one, and reporting it as 0 bytes is the same lie as inventing a
    // number. C:\Windows\Prefetch is the everyday case: it exists, it
    // often holds hundreds of MB, and enumerating it throws
    // UnauthorizedAccessException unless Prune is elevated.
    if (isAccessDenied(err)) denied.push(targetPath);
    return;
  }
  for (const entry of entries) {
    // A rule-authored exclusion (e.g. Explorer's own jump-list file,
    // whose AppID-named entry inside AutomaticDestinations also carries
    // Quick Access's pinned folders, not just "recently opened" traces).
    // Checked by basename only, case-insensitively, before the entry is
    // even stat'd -- it must never appear in a scan or a quarantine
    // batch, not just be re-excluded at execute time.
    if (excludeBasenames && excludeBasenames.has(entry.name.toLowerCase())) continue;
    const full = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out, denied, excludeBasenames);
    } else if (entry.isFile()) {
      try {
        // mtime as well as size: the "ignore anything touched in the
        // last N hours" guard needs it, and this stat is already being
        // paid for -- asking again later would be a second syscall per
        // file across tens of thousands of them.
        const stat = statSync(full);
        out.push({ path: full, sizeBytes: stat.size, mtimeMs: stat.mtimeMs });
      } catch (err) {
        if (isAccessDenied(err)) denied.push(full);
        /* otherwise gone between readdir and stat -- skip */
      }
    }
  }
}

/** Every real file a `delete` action's paths currently match, as
 * {path, sizeBytes} -- the single source of truth both scan and execute
 * build on, so a preview always shows exactly what Clean would actually
 * free. `paths` here are already environment-expanded by the caller
 * (cleanerRules.js's expandPath stays there -- it's shared by every
 * action type, not `delete`-specific). */
export function resolveActionFiles(expandedPaths, guards = {}, excludeNames = null) {
  const files = [];
  const denied = [];
  const excludeBasenames = excludeNames && excludeNames.length
    ? new Set(excludeNames.map((n) => n.toLowerCase()))
    : null;
  for (const expanded of expandedPaths) {
    // Real bug, found running this: path.join('', 'C:') on win32 does NOT
    // return 'C:' -- it returns 'C:.', and every join() after that
    // silently loses its path separators ('C:Users' instead of
    // 'C:\Users'), so nothing ever matched. Seeding basePath with the
    // drive-letter segment itself (never wildcarded) avoids ever calling
    // join() with an empty first argument.
    const [driveSegment, ...rest] = pathToSegments(expanded);
    if (!driveSegment) continue;
    for (const match of resolveGlob(driveSegment, rest)) {
      collectFiles(match, files, denied, excludeBasenames);
    }
  }

  // The guards apply HERE, in the one function both scan and execute are
  // built on, rather than in each of them separately. The preview
  // promising a number the removal then doesn't free is exactly the
  // drift this shared resolver exists to prevent.
  //
  // Deduplicated first (lower-cased: Windows paths are case-insensitive):
  // `**` can reach the same file through a matched directory (which
  // collectFiles walks whole) and again through its own descent into that
  // directory, and a file counted twice would inflate the scan and fail its
  // second rename on execute.
  const seen = new Set();
  const uniqueFiles = files.filter((f) => {
    const key = f.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const uniqueDenied = [...new Map(denied.map((p) => [p.toLowerCase(), p])).values()];
  const { cleanable, held } = partitionCleanableFiles(uniqueFiles, guards);
  return { files: cleanable, denied: uniqueDenied, held };
}

/** True if `filePath` can be opened for read+write right now -- Windows
 * enforces exclusive locks for a file another process has open, so this
 * doubles as a real "is this file free to move" check. Used as a
 * PRE-FILTER before handing files to quarantineAndDelete, whose own
 * per-file loop has no try/catch around rename() and would abort the
 * whole batch on the first locked file -- that service function is out of
 * scope for this feature (see cleaners.json's own scope manifest), so
 * locked files are kept out of its input entirely instead of trying to
 * make it tolerate them. */
async function isFileAccessible(filePath) {
  return (await lockError(filePath)) === null;
}

/** null when the file can be opened for read+write, else the error code
 * Windows gave (EBUSY for a sharing violation, EPERM for access denied). */
async function lockError(filePath) {
  try {
    const handle = await fs.promises.open(filePath, 'r+');
    await handle.close();
    return null;
  } catch (err) {
    return err?.code ?? 'UNKNOWN';
  }
}

/** The codes that mean "another program has this open", as opposed to a
 * file that is gone or a disk that failed. Only these are worth handing to
 * Windows to delete at the next boot. */
const LOCKED_CODES = new Set(['EBUSY', 'EPERM']);

/** Scans a `delete` action: how much it would free, without touching
 * anything. `action.expandedPaths` is pre-expanded (see
 * resolveActionFiles). */
export function scan(action, guards = {}) {
  const { files, denied, held } = resolveActionFiles(action.expandedPaths, guards, action.excludeNames);
  return {
    sizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    fileCount: files.length,
    // What the guards held back, so the panel can say "and 12 files left
    // alone" rather than quietly reporting a smaller number than the user
    // can see in Explorer.
    heldCount: held.length,
    // False means "this exists but Windows wouldn't let us look inside",
    // which the UI must show as needing admin rather than as 0 bytes.
    accessible: denied.length === 0
  };
}

/** Executes a `delete` action for real: pre-filters out any locked/
 * inaccessible file (reported in `skipped`, never thrown), then
 * quarantines everything left through the EXISTING quarantine system --
 * moved, not deleted outright, so a bad match is always recoverable the
 * same way an uninstall's own leftover removal already is. */
export async function execute(action, ruleName, guards = {}) {
  const { files, held } = resolveActionFiles(action.expandedPaths, guards, action.excludeNames);
  return executeFiles(files, held, ruleName, guards);
}

/** The removal half of `execute`, for any action that has already worked
 * out WHICH files (and which the guards held back). `delete` finds them
 * from paths; `deepscan` finds them by walking the profile; both then take
 * exactly the same road from here -- locked-file check, then Quarantine,
 * the Recycle Bin or a real delete depending on `guards`. */
export async function executeFiles(candidates, held, ruleName, guards = {}) {
  const accessible = [];
  // Seeded with what the guards refused, each carrying its own reason.
  // Reported rather than dropped: the only way a user ever discovers that
  // their own exclusion is what held a file back is being told.
  const skipped = [...held];
  // Files handed to Windows to delete at the next restart. Not `skipped`
  // (they will go) and not freed (they have not yet): reported on their own.
  const scheduledForRestart = [];
  // Set after the first scheduling failure that looks like missing
  // administrator rights -- the rest would fail the same way, slowly (two
  // reg.exe calls each), so they are skipped with the same honest reason.
  let scheduleBlocked = null;
  for (const file of candidates) {
    const code = await lockError(file.path);
    if (code === null) { accessible.push(file.path); continue; }

    if (guards.deleteLockedOnRestart === true && LOCKED_CODES.has(code) && !deleteRefusal(file.path)) {
      if (!scheduleBlocked) {
        try {
          await schedulePendingDelete(file.path);
          scheduledForRestart.push(file.path);
          continue;
        } catch (err) {
          scheduleBlocked = /denied|administrator|privilege|permission/i.test(err?.message ?? '')
            ? 'needs administrator'
            : (err?.message || 'failed');
        }
      }
      skipped.push({ path: file.path, reason: `locked, and could not be scheduled for deletion at restart (${scheduleBlocked})` });
      continue;
    }
    skipped.push({ path: file.path, reason: 'locked or inaccessible' });
  }
  const withScheduled = (result) => (scheduledForRestart.length > 0 ? { ...result, scheduledForRestart } : result);

  if (accessible.length === 0) return withScheduled({ freedBytes: 0, skipped });

  // 'Delete now' -- BleachBit's behaviour, chosen in Settings and read from
  // there by the route, never sent by a client. The same guards have already
  // run above (exclusions, recency, locked files); what is left is removed
  // through the one delete implementation the uninstall flow's "Delete
  // permanently" also uses. autoQuarantine is deliberately not consulted:
  // it chooses between Quarantine and the Recycle Bin, and this is neither.
  if (guards.removal === 'delete') return withScheduled(await deletePermanently(accessible, candidates, skipped, guards));

  // The other half of `autoQuarantine`, which used to be a switch in
  // Settings that decided nothing at all. Off means the Recycle Bin rather
  // than Prune's own quarantine -- Revo offers the same choice ("Delete to
  // bin") and the bin is the right alternative: the user gets the space
  // back from somewhere they already know how to empty, and a file taken
  // by mistake is still recoverable through a UI they already trust.
  if (guards.autoQuarantine === false) {
    const sizeOf = new Map(candidates.map((f) => [f.path, f.sizeBytes]));
    const { recycled, failed, error } = await sendToRecycleBin(accessible);
    for (const path of failed) skipped.push({ path, reason: error ? `could not be recycled: ${error}` : 'could not be recycled' });
    return withScheduled({
      // Summed from what actually went, not from what was asked for.
      freedBytes: recycled.reduce((sum, path) => sum + (sizeOf.get(path) || 0), 0),
      recycled: true,
      skipped
    });
  }

  try {
    const manifest = await quarantineAndDelete({
      programName: `Deep Clean: ${ruleName}`,
      files: accessible,
      registryKeys: []
    });
    return withScheduled({ freedBytes: manifest.totalSizeBytes, quarantineBatch: manifest.batchDir, skipped });
  } catch (err) {
    // Rare, given the accessibility pre-check above -- if it still
    // happens, nothing in this batch was safely quarantined, so report the
    // whole set as skipped rather than guessing at a partial freedBytes
    // the manifest never actually confirmed.
    return withScheduled({
      freedBytes: 0,
      skipped: [...skipped, ...accessible.map((p) => ({ path: p, reason: err.message }))]
    });
  }
}

/** What may never be deleted outright by a Deep Clean rule, whatever it
 * matched: a whole drive, a relative or climbing path, a user profile
 * folder, or Prune's own Quarantine.
 *
 * Deliberately NOT the uninstall path's fuller list: C:\Windows\Temp,
 * Prefetch and the logs are ordinary Deep Clean targets and sit under
 * Windows, and Program Files caches under Program Files. The rule set is
 * curated; this is only the backstop against a rule that matches too much. */
function deleteRefusal(path) {
  return protectionReason(path, { systemRoot: '', programFiles: '', programFilesX86: '' });
}

async function deletePermanently(accessible, candidates, skipped, guards = {}) {
  const sizeOf = new Map(candidates.map((f) => [f.path, f.sizeBytes]));
  const allowed = [];
  for (const path of accessible) {
    const refusal = deleteRefusal(path);
    if (refusal) skipped.push({ path, reason: refusal });
    else allowed.push({ path, sizeBytes: sizeOf.get(path) || 0 });
  }
  // `overwritePasses` is 0 unless "Overwrite files before deleting" is on
  // (settings.js). Only here, where the file is destroyed: Quarantine and
  // the Recycle Bin keep the file, and overwriting it first would wreck the
  // copy the user is being promised they can get back.
  const { removed, failed } = await removePermanently(allowed, { overwritePasses: guards.overwritePasses || 0 });
  for (const { path, reason } of failed) skipped.push({ path, reason });
  return {
    // Summed from what was actually removed, not from what was asked for.
    freedBytes: removed.reduce((sum, f) => sum + f.sizeBytes, 0),
    skipped
  };
}
