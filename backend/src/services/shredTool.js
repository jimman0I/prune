import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { shredPaths, normalizePasses } from '../lib/shredFile.js';
import { isExcluded } from '../lib/cleanGuards.js';
import { matchesExtension } from '../lib/exclusionInput.js';
import { protectionReason } from './pathGuard.js';

/** BleachBit's "Shred files" / "Shred folders", as a tool.
 *
 * Everything else Prune deletes is chosen by a rule someone wrote. This is
 * chosen by the user, one path at a time, and destroyed for good -- so the
 * guard against a slip matters more here than anywhere: Windows, whole
 * drives, user profiles and Prune's own Quarantine are refused (pathGuard),
 * and so is everything the cleaner itself is never allowed to take
 * (cleanGuards' protected folders, plus the user's own exclusions). A
 * folder is checked file by file, not just at the top: a chosen folder can
 * contain an antivirus's Quarantine folder three levels down. */

/** More than this many targets at once is not a person choosing -- it is a
 * script, or a mistake. */
export const MAX_PATHS = 2000;

/** Why this path must not be shredded, or null when it may be. */
export function refusalFor(path, guards = {}) {
  const protectedByPrune = protectionReason(path);
  if (protectedByPrune) return protectedByPrune;

  const excludeFolders = Array.isArray(guards.excludeFolders) ? guards.excludeFolders : [];
  const excludeExtensions = Array.isArray(guards.excludeExtensions) ? guards.excludeExtensions : [];

  // Prune's own protected folders first (no user input), so the reason
  // names the right setting: a user's exclusion is fixed in Settings, the
  // built-in list is not something they can edit.
  if (isExcluded(path, [], [])) return 'That is a protected folder Prune never touches.';
  if (isExcluded(path, excludeFolders, [])) return 'That is in an excluded folder.';
  if (matchesExtension(path, excludeExtensions)) return 'That is an excluded file type.';
  return null;
}

/** Throws a plain message for input that is not a list of paths. */
export function validate(paths) {
  if (!Array.isArray(paths)) throw new TypeError('paths must be a list of file or folder paths.');
  if (paths.length === 0) throw new TypeError('Give at least one file or folder to shred.');
  if (paths.length > MAX_PATHS) throw new TypeError(`Give at most ${MAX_PATHS} paths at once.`);
  if (paths.some((p) => typeof p !== 'string' || p.length === 0 || p.length > 32000)) {
    throw new TypeError('Every path must be text.');
  }
  return [...new Map(paths.map((p) => [p.toLowerCase(), p])).values()];
}

/** What shredding these would destroy, counted without touching anything:
 * the files, their bytes, and every path that would be left alone with the
 * reason. `entryLimit` caps the walk (a chosen drive-sized folder must not
 * hang the confirmation); past it the counts are a floor and `truncated`
 * says so. */
export async function previewShred(paths, guards = {}, { entryLimit = 250000 } = {}) {
  const targets = validate(paths);
  const refused = [];
  let files = 0;
  let bytes = 0;
  let entries = 0;
  let truncated = false;

  async function walk(path) {
    if (truncated) return;
    const reason = refusalFor(path, guards);
    if (reason) { refused.push({ path, reason }); return; }
    if (entries >= entryLimit) { truncated = true; return; }
    entries += 1;
    let info;
    try {
      info = await lstat(path);
    } catch (err) {
      refused.push({ path, reason: err.code === 'ENOENT' ? 'It does not exist.' : err.message });
      return;
    }
    if (info.isSymbolicLink() || !info.isDirectory()) {
      files += 1;
      bytes += info.isSymbolicLink() ? 0 : info.size;
      return;
    }
    let names;
    try {
      names = await readdir(path);
    } catch (err) {
      refused.push({ path, reason: err.message });
      return;
    }
    for (const name of names) await walk(join(path, name));
  }

  for (const path of targets) await walk(path);
  return { files, bytes, refused, truncated };
}

/** Shreds the chosen paths. Resolves { shreddedFiles, bytes, failed, held,
 * aborted }: `held` is what the guards refused, `failed` what could not be
 * overwritten (in use, no permission). Nothing in either is a throw -- one
 * locked file does not stop the rest. `extra` is for tests and progress:
 * { signal, onProgress, onBytes, onStage }. */
export async function shredRequested(paths, passes, guards = {}, extra = {}) {
  const targets = validate(paths);
  const result = await shredPaths(targets, normalizePasses(passes), {
    ...extra,
    refuse: (path) => refusalFor(path, guards)
  });
  return {
    shreddedFiles: result.shredded.length,
    bytes: result.bytes,
    failed: result.failed,
    held: result.held,
    aborted: result.aborted
  };
}
