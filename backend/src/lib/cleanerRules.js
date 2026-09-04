import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import * as fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quarantineAndDelete } from '../services/quarantine.js';
import { partitionCleanableFiles } from './cleanGuards.js';
import { sendToRecycleBin } from '../services/recycleBin.js';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const CLEANERS_JSON_PATH = join(here, '..', 'data', 'cleaners.json');

/** Expands the environment-variable tokens and leading `~` a cleaners.json
 * path may contain. Deliberately supports only the handful of tokens the
 * rule set actually uses -- APPDATA/LOCALAPPDATA/SYSTEMROOT/PROGRAMFILES
 * variants are always real Windows env vars, never something a rule
 * author needs to invent. A token whose env var isn't set expands to ''
 * (matches non-Windows/misconfigured environments gracefully -- the
 * resulting path just won't exist, which scanRule already treats as 0
 * bytes, not an error). Exported and independently testable. */
export function expandPath(rawPath) {
  let expanded = rawPath
    .replace(/%APPDATA%/gi, process.env.APPDATA || '')
    .replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA || '')
    .replace(/%SYSTEMROOT%/gi, process.env.SYSTEMROOT || process.env.WINDIR || '')
    // %WINDIR% is the same folder under its other name, and Windows
    // accepts both everywhere. Left out originally, which made a rule
    // written with it fail silently: the token stayed in the string, the
    // path never matched, and the rule reported itself as "not installed"
    // rather than as broken.
    .replace(/%WINDIR%/gi, process.env.WINDIR || process.env.SYSTEMROOT || '')
    .replace(/%PROGRAMDATA%/gi, process.env.ProgramData || '')
    // "C:" with no trailing separator, which is how Windows itself sets it.
    // The Recycle Bin is the only rule that needs it, and it needs it
    // because the bin lives at the root of each volume rather than
    // anywhere under a profile.
    .replace(/%SYSTEMDRIVE%/gi, process.env.SystemDrive || (process.env.SYSTEMROOT || 'C:').slice(0, 2))
    .replace(/%PROGRAMFILES\(X86\)%/gi, process.env['ProgramFiles(x86)'] || '')
    .replace(/%PROGRAMFILES%/gi, process.env.ProgramFiles || '');
  if (expanded.startsWith('~')) {
    expanded = join(homedir(), expanded.slice(1).replace(/^[\\/]/, ''));
  }
  return expanded;
}

/** Reads and parses cleaners.json fresh every call -- the rule set is
 * small and this is never a hot path, so there's no reason to cache it
 * and risk serving a stale copy after an edit. */
export function loadCleanerRules() {
  return JSON.parse(readFileSync(CLEANERS_JSON_PATH, 'utf8'));
}

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
 * overwhelmingly common case. */
function resolveGlob(basePath, segments) {
  if (segments.length === 0) return [basePath];
  const [segment, ...rest] = segments;
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

/** Splits an expanded absolute Windows path into segments for resolveGlob.
 * The drive letter ("C:") is its own first segment and never contains a
 * `*`, so it always resolves through the literal (non-glob) branch above. */
function pathToSegments(expandedPath) {
  return expandedPath.split(/[\\/]+/).filter(Boolean);
}

/** Recursively collects every real FILE under `targetPath` -- if it's a
 * file itself, that's the one result; if it's a directory, every file
 * inside it (recursively); if it doesn't exist or can't be read
 * (permission error, gone by the time it's visited), it contributes
 * nothing -- same partial-over-total-failure convention cleanup.js's own
 * dirSize/leftoverScan.js already use. */
function collectFiles(targetPath, out, denied) {
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
    const full = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out, denied);
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

function isAccessDenied(err) {
  return err && (err.code === 'EPERM' || err.code === 'EACCES');
}

/** Every real file a `paths`-based rule currently matches, as
 * {path, sizeBytes} -- the single source of truth both scanRule (sums it)
 * and executeRule (quarantines it) build on, so a preview always shows
 * exactly what Clean would actually free. */
function resolveRuleFiles(rule, guards = {}) {
  const files = [];
  const denied = [];
  for (const rawPath of rule.paths) {
    const expanded = expandPath(rawPath);
    // Real bug, found running this: path.join('', 'C:') on win32 does NOT
    // return 'C:' -- it returns 'C:.', and every join() after that
    // silently loses its path separators ('C:Users' instead of
    // 'C:\Users'), so nothing ever matched. Seeding basePath with the
    // drive-letter segment itself (never wildcarded) avoids ever calling
    // join() with an empty first argument.
    const [driveSegment, ...rest] = pathToSegments(expanded);
    if (!driveSegment) continue;
    for (const match of resolveGlob(driveSegment, rest)) {
      collectFiles(match, files, denied);
    }
  }

  // The guards apply HERE, in the one function both the preview and the
  // removal are built on, rather than in each of them separately. The
  // preview promising a number the removal then doesn't free is exactly
  // the drift this shared resolver exists to prevent.
  const { cleanable, held } = partitionCleanableFiles(files, guards);
  return { files: cleanable, denied, held };
}

/** Computes one rule's current size without touching anything -- Preview
 * Mode. A command-based rule (nothing to size) returns null, not 0 --
 * 0 would falsely claim "there is nothing to free", null honestly says
 * "there is nothing to preview". */
export function scanRule(rule, guards = {}) {
  // A command rule has nothing to look for on disk, so it's always
  // applicable -- `ipconfig /flushdns` works whether or not anything is
  // cached.
  if (rule.command) return { id: rule.id, sizeBytes: null, fileCount: null, present: true, accessible: true };
  const { files, denied, held } = resolveRuleFiles(rule, guards);
  return {
    id: rule.id,
    sizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    fileCount: files.length,
    // What the guards held back, so the panel can say "and 12 files left
    // alone" rather than quietly reporting a smaller number than the user
    // can see in Explorer.
    heldCount: held.length,
    present: rulePathsExist(rule),
    // False means "this exists but Windows wouldn't let us look inside",
    // which the UI must show as needing admin rather than as 0 bytes.
    accessible: denied.length === 0
  };
}

/** Whether any of a rule's target paths exists at all -- which is a
 * genuinely different question from whether it has anything in it.
 *
 * "Discord isn't installed" and "Discord's cache is already empty" both
 * scan to 0 bytes, and showing both as a flat "0 B" tells the user
 * nothing. BleachBit's own UI makes the same distinction (it greys out
 * cleaners that don't apply to the machine), and with a rule set this
 * size most rules won't apply to any given user -- so the difference
 * carries most of the list's signal. */
function rulePathsExist(rule) {
  for (const rawPath of rule.paths) {
    const [driveSegment, ...rest] = pathToSegments(expandPath(rawPath));
    if (!driveSegment) continue;
    for (const match of resolveGlob(driveSegment, rest)) {
      if (existsSync(match)) return true;
    }
  }
  return false;
}

/** Every rule from cleaners.json, scanned and grouped by category -- the
 * shape GET /api/deep-clean/scan hands straight to the frontend tree. */
export function scanAllRules(guards = {}) {
  const rules = loadCleanerRules();
  const byCategory = new Map();
  for (const rule of rules) {
    const scanned = scanRule(rule, guards);
    const item = { ...rule, ...scanned };
    if (!byCategory.has(rule.category)) byCategory.set(rule.category, []);
    byCategory.get(rule.category).push(item);
  }
  return [...byCategory.entries()].map(([category, items]) => ({ category, items }));
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
  try {
    const handle = await fs.promises.open(filePath, 'r+');
    await handle.close();
    return true;
  } catch {
    return false;
  }
}

/** Executes one rule for real. A `paths` rule pre-filters out any locked/
 * inaccessible file (reported in `skipped`, never thrown), then quarantines
 * everything left through the EXISTING quarantine system -- moved, not
 * deleted outright, so a bad match is always recoverable the same way an
 * uninstall's own leftover removal already is. A `command` rule (DNS
 * flush) just runs the command; there is no file to quarantine. */
export async function executeRule(rule, guards = {}) {
  if (rule.command) {
    try {
      await execFileAsync(rule.command.split(' ')[0], rule.command.split(' ').slice(1));
      return { id: rule.id, ranCommand: true, freedBytes: 0, skipped: [] };
    } catch (err) {
      return { id: rule.id, ranCommand: true, freedBytes: 0, skipped: [], error: err.message };
    }
  }

  const { files: candidates, held } = resolveRuleFiles(rule, guards);
  const accessible = [];
  // Seeded with what the guards refused, each carrying its own reason.
  // Reported rather than dropped: the only way a user ever discovers that
  // their own exclusion is what held a file back is being told.
  const skipped = [...held];
  for (const file of candidates) {
    if (await isFileAccessible(file.path)) accessible.push(file.path);
    else skipped.push({ path: file.path, reason: 'locked or inaccessible' });
  }

  if (accessible.length === 0) return { id: rule.id, freedBytes: 0, skipped };

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
    return {
      id: rule.id,
      // Summed from what actually went, not from what was asked for.
      freedBytes: recycled.reduce((sum, path) => sum + (sizeOf.get(path) || 0), 0),
      recycled: true,
      skipped
    };
  }

  try {
    const manifest = await quarantineAndDelete({
      programName: `Deep Clean: ${rule.name}`,
      files: accessible,
      registryKeys: []
    });
    return { id: rule.id, freedBytes: manifest.totalSizeBytes, quarantineBatch: manifest.batchDir, skipped };
  } catch (err) {
    // Rare, given the accessibility pre-check above -- if it still
    // happens, nothing in this rule's batch was safely quarantined, so
    // report the whole set as skipped rather than guessing at a partial
    // freedBytes the manifest never actually confirmed.
    return {
      id: rule.id,
      freedBytes: 0,
      skipped: [...skipped, ...accessible.map(p => ({ path: p, reason: err.message }))]
    };
  }
}

/** Executes every requested rule id in turn, summing freed bytes into one
 * summary. An id that doesn't match any loaded rule is reported as an
 * error entry rather than thrown -- same "don't trust a caller-supplied
 * id blindly, but don't blow up on it either" posture cleanup.js's own
 * executeCleanup already uses for its category ids. */
export async function executeRules(ruleIds, guards = {}) {
  const rules = loadCleanerRules();
  const results = [];
  let freedBytes = 0;
  for (const id of ruleIds) {
    const rule = rules.find(r => r.id === id);
    if (!rule) {
      results.push({ id, error: `Unknown rule id "${id}"` });
      continue;
    }
    const result = await executeRule(rule, guards);
    freedBytes += result.freedBytes || 0;
    results.push(result);
  }
  return { freedBytes, results };
}

/** Scans every rule, handing each result to `onItem` as soon as it's
 * known rather than returning the whole set at the end.
 *
 * scanAllRules above takes ~19 seconds on a real machine, and it does it
 * with synchronous fs calls -- so it holds the event loop for the whole
 * run. Anything written to a response during that time sits in a buffer
 * until the scan finishes, which is a progress report delivered only once
 * there is no longer any progress to report. The `await` between rules is
 * what makes streaming possible at all: it hands control back so the
 * socket can flush, and incidentally lets the rest of the backend answer
 * requests between rules instead of being frozen for the duration.
 *
 * It does NOT make an individual rule interruptible -- one large tree
 * (the 33 GB NVIDIA shader cache is the worst here) still blocks until
 * it's done. Per-rule granularity is the honest limit of this change.
 *
 * `signal` lets a caller stop early, which is what the UI's Abort button
 * and a client hanging up both come down to. Returns a summary rather
 * than throwing on abort -- a cancelled scan is an ordinary outcome. */
export async function scanRulesProgressively(onItem, { signal, ...guards } = {}) {
  const rules = loadCleanerRules();
  let scanned = 0;

  for (const rule of rules) {
    if (signal?.aborted) return { aborted: true, total: rules.length, scanned };
    onItem({ ...rule, ...scanRule(rule, guards) });
    scanned++;
    // setImmediate, not a 0ms timer: it runs after I/O callbacks in the
    // same loop iteration, so a pending socket write goes out before the
    // next rule starts hogging the thread again.
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { aborted: false, total: rules.length, scanned };
}
