import { lstat, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { findFiles } from '../lib/cleanerActions/deepscan.js';
import { executeFiles } from '../lib/cleanerActions/delete.js';
import { isExcluded, isTooRecent } from '../lib/cleanGuards.js';
import { matchesExtension } from '../lib/exclusionInput.js';
import { compileJunkPatterns, matchJunkName, fileNameRefusal } from '../lib/junkPatterns.js';
import { osComponentRefusal } from './leftoverProtection.js';
import { quarantineRoot } from './quarantine.js';
import { settingsPath } from './settings.js';

/** The Junk files scan: files whose NAME is on the person's junk list
 * (lib/junkPatterns.js), looked for on the drives and folders they pick, then
 * offered in a list for them to tick -- never removed by the scan itself.
 *
 * It walks with the same walker Deep Clean's profile-wide "Deep scan" rules
 * use (cleanerActions/deepscan.js: asynchronous, capped, cancellable, never
 * through a junction), and removes through the same road every Deep Clean
 * file takes (cleanerActions/delete.js's executeFiles: locked-file check,
 * then Quarantine, the Recycle Bin or Delete now, as Settings says). In the
 * app both halves run on Deep Clean's worker thread (lib/cleanJobs.js), so a
 * walk of a whole drive never stops the window answering.
 *
 * What is different is how much it refuses, because a pattern list the
 * person can edit, run over whole drives, meets everything a curated rule
 * never would:
 *
 *   - never inside Windows, Program Files, Prune's own data, the cleaner's
 *     protected system folders (System Volume Information, the Recycle Bin,
 *     antivirus quarantines -- cleanGuards.js), the folders an earlier
 *     Windows or a reset keeps for rolling back, anything belonging to
 *     Windows or a shared runtime by its folder names
 *     (leftoverProtection.js), or another installed program's own folder;
 *   - never a program, library, driver or desktop.ini, whatever the pattern;
 *   - and the person's own guards, as everywhere: excluded folders and file
 *     types, and "modified in the last N hours".
 *
 * Every refusal is counted, by kind, so the screen can say "and 214 files left
 * alone" rather than quietly showing a smaller number than Explorer would.
 * And every check runs AGAIN at removal, on the paths the window sends back:
 * the removal route can be called with a list this scan never produced. */

/** What one scan may spend: more than a profile walk, because it may be a
 * whole drive; finite, because a scan that never ends looks hung. Matches are
 * capped well below what Deep scan allows because each one becomes a row the
 * person reads -- twenty thousand rows is already more than anyone will tick
 * through. Hitting any of these is reported as a partial result. */
export const JUNK_LIMITS = Object.freeze({
  maxEntries: 5_000_000,
  maxMatches: 20_000,
  maxDepth: 64,
  maxMs: 600_000
});

/** Results go to the window in batches of at most this many, or every
 * FLUSH_MS, whichever comes first: one message per file would cost more than
 * finding it. */
const FLUSH_FILES = 200;
const FLUSH_MS = 250;

export const JUNK_RULE_ID = 'junk_files';

/* ------------------------------------------------------------ paths */

function norm(path) {
  return String(path).replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function isAtOrUnder(path, parent) {
  if (!parent) return false;
  const target = norm(path);
  const root = norm(parent);
  return root !== '' && (target === root || target.startsWith(`${root}\\`));
}

/** Folders a Windows upgrade or reset keeps to roll back with, by name. They
 * are full of .tmp and .old that are not junk: removing pieces of one is how
 * "Go back to the previous version" stops working. Disk Cleanup, which knows
 * how to remove them whole, is the right tool. `recovery` only at a drive's
 * root, where Windows puts its recovery environment. */
const ROLLBACK_FOLDERS = new Set(['windows.old', '$windows.~bt', '$windows.~ws', '$winreagent', '$sysreset', '$getcurrent']);

/** The places this scan never looks inside, from the environment it runs in.
 * Built once per scan. */
export function protectedRoots(env = process.env) {
  const systemDrive = env?.SystemDrive || 'C:';
  const roots = [
    { dir: env?.SystemRoot || env?.windir || `${systemDrive}\\Windows`, code: 'windows' },
    { dir: env?.ProgramFiles || `${systemDrive}\\Program Files`, code: 'programs' },
    { dir: env?.['ProgramFiles(x86)'] || `${systemDrive}\\Program Files (x86)`, code: 'programs' },
    { dir: quarantineRoot(), code: 'prune' }
  ];
  try { roots.push({ dir: dirname(settingsPath()), code: 'prune' }); } catch { /* no settings path */ }
  if (env?.ProgramW6432) roots.push({ dir: env.ProgramW6432, code: 'programs' });
  return roots.filter((r) => typeof r.dir === 'string' && r.dir !== '');
}

/** An installed program's folders are its own business, the same as Program
 * Files: a .tmp a game keeps beside its executable is the game's to delete.
 * But a program's own claim about where it lives is only a registry value,
 * and some claim far too much -- an InstallLocation of "C:\", or of the
 * person's whole AppData. A footprint that broad would hide half the drive,
 * so it is ignored: what is left is only folders that could plausibly be one
 * program's. */
export function usableFootprints(footprints, env = process.env) {
  const profile = env?.USERPROFILE;
  const tooBroad = [
    env?.APPDATA, env?.LOCALAPPDATA, env?.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Programs` : null,
    env?.ProgramData, env?.PUBLIC, env?.SystemDrive ? `${env.SystemDrive}\\Users` : null
  ].filter(Boolean).map(norm);
  return (Array.isArray(footprints) ? footprints : []).filter((fp) => {
    if (typeof fp?.dir !== 'string' || !/^[a-z]:\\./i.test(fp.dir.trim())) return false;
    const dir = norm(fp.dir.trim());
    if (/^[a-z]:$/.test(dir)) return false;
    if (tooBroad.includes(dir)) return false;
    // The profile itself, anything above it, and its own top-level folders
    // (Documents, Downloads, AppData ...).
    if (profile && (isAtOrUnder(profile, dir) || norm(dirname(dir)) === norm(profile))) return false;
    // A whole user profile under Users.
    if (/^[a-z]:\\users\\[^\\]+$/.test(dir)) return false;
    return true;
  });
}

/** The guards a scan or removal runs with, built once: where never to look
 * and the person's own exclusions. */
export function junkContext({ guards = {}, footprints = [], env = process.env, now = Date.now() } = {}) {
  return {
    roots: protectedRoots(env),
    footprints: usableFootprints(footprints, env),
    excludeFolders: Array.isArray(guards.excludeFolders) ? guards.excludeFolders : [],
    excludeExtensions: Array.isArray(guards.excludeExtensions) ? guards.excludeExtensions : [],
    skipRecentHours: Number(guards.skipRecentHours) || 0,
    env,
    now
  };
}

/** Why nothing under this path may be offered, or null.
 *
 * { kind: 'protected' | 'excluded', code } -- kind decides which count it
 * lands in, code says which rule (for a reason sentence). Works on a folder
 * (during the walk, so the walk never enters it) and on a file (for a root
 * the person picked inside one of these places, and again at removal). */
export function pathRefusal(path, ctx) {
  for (const { dir, code } of ctx.roots) {
    if (isAtOrUnder(path, dir)) return { kind: 'protected', code };
  }
  // The cleaner's own always-protected folders, by name at any depth.
  if (isExcluded(path)) return { kind: 'protected', code: 'system' };
  const segments = norm(path).split('\\');
  if (segments.some((s) => ROLLBACK_FOLDERS.has(s))) return { kind: 'protected', code: 'rollback' };
  if (segments[1] === 'recovery') return { kind: 'protected', code: 'rollback' };
  if (osComponentRefusal(path, { env: ctx.env })) return { kind: 'protected', code: 'system' };
  for (const fp of ctx.footprints) {
    if (isAtOrUnder(path, fp.dir)) return { kind: 'protected', code: 'program', program: fp.program };
  }
  // Last, so a folder that is both is counted as the protection it is.
  if (ctx.excludeFolders.length > 0 && isExcluded(path, ctx.excludeFolders)) return { kind: 'excluded', code: 'folder' };
  return null;
}

/** Why this one matched file may not be offered, as the count it goes in:
 * 'executable' | 'protected' | 'excluded' | 'recent', or null to offer it. */
export function fileRefusal(file, ctx) {
  if (fileNameRefusal(basename(file.path))) return 'executable';
  const where = pathRefusal(file.path, ctx);
  if (where) return where.kind;
  if (matchesExtension(file.path, ctx.excludeExtensions)) return 'excluded';
  if (isTooRecent(file.mtimeMs, ctx.skipRecentHours, ctx.now)) return 'recent';
  return null;
}

/** The pattern a path's name matches, using the folder facts the Check Disk
 * pattern needs. */
function patternFor(path, compiled) {
  const parent = dirname(path);
  const parentName = basename(parent);
  // "X:\FOUND.000": its own parent is the drive root.
  const parentIsDriveChild = /^[a-z]:[\\/]?$/i.test(dirname(parent));
  return matchJunkName(basename(path), compiled, { parentName, parentIsDriveChild });
}

/* ------------------------------------------------------------ roots */

/** The drives and folders to scan, tidied, with the ones that cannot be.
 *
 * { roots: ['C:\\', 'D:\\Downloads'], refused: [{ path, reason }] } where
 * reason is one of relative | climb | missing | protected. A drive is given as
 * "C:" or "C:\"; a folder as a full path. A root inside another root is
 * dropped (its files would be found twice). A root inside a place the scan
 * never looks is refused up front rather than walked to find nothing. */
export async function prepareRoots(list, ctx) {
  const roots = [];
  const refused = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    let path = raw.trim().replace(/\//g, '\\');
    if (/^[a-z]:\\?$/i.test(path)) path = `${path.slice(0, 2).toUpperCase()}\\`;
    else path = path.replace(/\\+$/, '');
    if (path.includes('..')) { refused.push({ path, reason: 'climb' }); continue; }
    if (!/^[a-z]:\\/i.test(path)) { refused.push({ path, reason: 'relative' }); continue; }
    const drive = /^[a-z]:\\$/i.test(path);
    if (!drive && pathRefusal(path, ctx)?.kind === 'protected') { refused.push({ path, reason: 'protected' }); continue; }
    try {
      if (!(await stat(path)).isDirectory()) { refused.push({ path, reason: 'missing' }); continue; }
    } catch {
      refused.push({ path, reason: 'missing' });
      continue;
    }
    roots.push(path);
  }
  // Shortest first, so a drive is kept and the folders inside it dropped.
  const kept = [];
  for (const root of [...new Set(roots)].sort((a, b) => a.length - b.length)) {
    if (!kept.some((k) => isAtOrUnder(root, k))) kept.push(root);
  }
  return { roots: kept, refused };
}

/* ------------------------------------------------------------ scan */

function emptySkipped() {
  return { protectedFolders: 0, excludedFolders: 0, protected: 0, excluded: 0, recent: 0, executable: 0 };
}

/** Walks `roots` for files matching the ENABLED `patterns`.
 *
 * `onFiles(batch)` receives the offered files as they are found, each
 * { path, sizeBytes, mtimeMs, pattern }; `onProgress({ dirs, entries,
 * matches })` how far the walk has got. Resolves to the summary:
 * { offered, offeredBytes, dirs, entries, truncated, skipped, unreadable }
 * where `truncated` is null for a complete walk or why it stopped ('entries'
 * | 'matches' | 'time' | 'aborted' | 'depth'), and `unreadable` lists roots
 * Windows would not list. Roots are expected already prepared (prepareRoots).
 * Removes nothing. */
export async function scanJunkFiles({
  roots = [], patterns = [], guards = {}, footprints = [], signal, onFiles, onProgress,
  limits = {}, env = process.env, now = Date.now()
} = {}) {
  const cap = { ...JUNK_LIMITS, ...limits };
  const compiled = compileJunkPatterns(patterns);
  const ctx = junkContext({ guards, footprints, env, now });
  const skipped = emptySkipped();
  const unreadable = [];
  const started = Date.now();
  let offered = 0;
  let offeredBytes = 0;
  let dirs = 0;
  let entries = 0;
  let matches = 0;
  let truncated = null;

  let batch = [];
  let lastFlush = Date.now();
  const flush = (force = false) => {
    if (batch.length === 0) return;
    if (!force && batch.length < FLUSH_FILES && Date.now() - lastFlush < FLUSH_MS) return;
    onFiles?.(batch);
    batch = [];
    lastFlush = Date.now();
  };

  if (compiled.length === 0) {
    return { offered, offeredBytes, dirs, entries, truncated, skipped, unreadable };
  }

  const skipDir = (dir) => {
    const refusal = pathRefusal(dir, ctx);
    if (!refusal) return false;
    if (refusal.kind === 'excluded') skipped.excludedFolders += 1; else skipped.protectedFolders += 1;
    return true;
  };

  const onMatch = (file) => {
    const match = patternFor(file.path, compiled);
    // A name the walker's regex took that the full rule does not -- a .chk
    // outside FOUND.### -- is not a match at all, so it is not counted.
    if (!match) return;
    matches += 1;
    const refusal = fileRefusal(file, ctx);
    if (refusal) { skipped[refusal] += 1; return; }
    offered += 1;
    offeredBytes += file.sizeBytes;
    batch.push({ path: file.path, sizeBytes: file.sizeBytes, mtimeMs: file.mtimeMs, pattern: match.pattern });
    flush();
  };

  for (const root of roots) {
    if (signal?.aborted) { truncated = 'aborted'; break; }
    const elapsed = Date.now() - started;
    if (elapsed >= cap.maxMs) { truncated = 'time'; break; }
    const found = await findFiles(root, {
      patterns: compiled.map((c) => c.regex.source),
      flags: 'iu',
      signal,
      // What is left of the one budget all the roots share.
      limits: {
        maxEntries: Math.max(1, cap.maxEntries - entries),
        maxMatches: Math.max(1, cap.maxMatches - matches),
        maxDepth: cap.maxDepth,
        maxMs: Math.max(1, cap.maxMs - elapsed)
      },
      skipDir,
      onMatch,
      onProgress: (p) => {
        flush();
        onProgress?.({ dirs: dirs + p.dirs, entries: entries + p.entries, matches: offered });
      }
    });
    dirs += found.dirs;
    entries += found.entries;
    if (!found.rootReadable) unreadable.push(root);
    // 'depth' is a note, not a stop: the rest of the walk went on.
    if (found.truncated && found.truncated !== 'depth') { truncated = found.truncated; break; }
    if (found.truncated === 'depth') truncated = truncated ?? 'depth';
  }

  flush(true);
  onProgress?.({ dirs, entries, matches: offered });
  return { offered, offeredBytes, dirs, entries, truncated, skipped, unreadable };
}

/* ------------------------------------------------------------ removal */

/** Removes the ticked files, judging every one again first.
 *
 * `paths` came from the window and is treated as a request, not a fact: each
 * must still exist as a plain file, still match a pattern that is turned on,
 * and still pass every guard the scan applied (a file modified since the scan
 * is now too recent; an exclusion added since is honoured). What fails is
 * reported with its reason and left alone. What passes goes through
 * executeFiles -- the same road a Deep Clean rule's files take, as ONE batch:
 * one Quarantine batch, one Undo, or the Recycle Bin or Delete now if that is
 * what Settings says (`guards.removal` / `guards.autoQuarantine`).
 *
 * Resolves to the shape a Deep Clean run has, so the window can describe it
 * with the same words: { freedBytes, movedBytes, removedCount, results: [one
 * rule-like result] }. */
export async function removeJunkFiles(paths, { patterns = [], guards = {}, footprints = [], env = process.env, now = Date.now() } = {}) {
  const compiled = compileJunkPatterns(patterns);
  const ctx = junkContext({ guards, footprints, env, now });
  const candidates = [];
  const held = [];
  const seen = new Set();

  for (const raw of Array.isArray(paths) ? paths : []) {
    if (typeof raw !== 'string') continue;
    const path = raw.trim();
    const key = path.toLowerCase();
    if (!path || seen.has(key)) continue;
    seen.add(key);

    if (path.includes('..') || !/^[a-z]:\\./i.test(path)) { held.push({ path, reason: 'not a full path' }); continue; }
    let info;
    try {
      info = await lstat(path);
    } catch {
      held.push({ path, reason: 'no longer there' });
      continue;
    }
    if (!info.isFile()) { held.push({ path, reason: 'not a file' }); continue; }
    if (!patternFor(path, compiled)) { held.push({ path, reason: 'does not match a junk pattern that is turned on' }); continue; }
    const file = { path, sizeBytes: info.size, mtimeMs: info.mtimeMs };
    const refusal = fileRefusal(file, ctx);
    if (refusal) { held.push({ path, reason: REMOVAL_REASONS[refusal] }); continue; }
    candidates.push(file);
  }

  const result = candidates.length > 0
    ? await executeFiles(candidates, held, 'Junk files', guards)
    : { freedBytes: 0, skipped: held };

  const scheduled = Array.isArray(result.scheduledForRestart) ? result.scheduledForRestart.length : 0;
  const moved = Boolean(result.quarantineBatch || result.recycled);
  const notRemoved = (result.skipped?.length ?? 0) - held.length;
  return {
    freedBytes: moved ? 0 : result.freedBytes || 0,
    movedBytes: moved ? result.freedBytes || 0 : 0,
    removedCount: Math.max(0, candidates.length - notRemoved - scheduled),
    results: [{
      id: JUNK_RULE_ID,
      freedBytes: result.freedBytes || 0,
      ...(result.quarantineBatch ? { quarantineBatch: result.quarantineBatch } : {}),
      ...(result.recycled ? { recycled: true } : {}),
      ...(scheduled > 0 ? { scheduledForRestart: scheduled } : {}),
      skipped: result.skipped ?? []
    }]
  };
}

/** The reasons a removal gives back, in the words every other skip uses. */
const REMOVAL_REASONS = {
  executable: 'a program or system file, never removed as junk',
  protected: 'in a protected location',
  excluded: 'excluded in Settings',
  recent: 'modified too recently'
};
