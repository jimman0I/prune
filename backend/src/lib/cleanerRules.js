import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as deleteAction from './cleanerActions/delete.js';
import * as shellAction from './cleanerActions/shell.js';

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

/** Gives every rule an `actions` array, synthesizing one from the legacy
 * `paths`/`command` shape when a rule doesn't already have one -- so every
 * rule in cleaners.json keeps working with ZERO data migration, and a new
 * rule can be written directly in the richer shape. This is additive only:
 * nothing reads `rule.actions` yet. Once a later task (Task 7) wires this
 * into `scanRule`/`executeRule` so THEY read `rule.actions` instead of
 * `rule.paths`/`rule.command` directly, adding a new action type
 * (sqlite.vacuum, winreg) becomes a matter of adding a new case to a
 * dispatcher, not touching every rule already written.
 *
 * A rule with none of `actions`/`command`/`paths` is malformed -- throwing
 * here, naming the rule, is deliberate: better a clear failure at the one
 * rule that's broken than a confusing TypeError several files away, inside
 * whatever action module eventually tries to act on an undefined target. */
export function normalizeRule(rule) {
  if (rule.actions) return rule;
  if (rule.command) return { ...rule, actions: [{ type: 'shell', command: rule.command }] };
  if (rule.paths) return { ...rule, actions: [{ type: 'delete', paths: rule.paths }] };
  throw new Error(`normalizeRule: rule "${rule?.id}" has none of actions/command/paths`);
}

/** Computes one rule's current size without touching anything -- Preview
 * Mode. A command-based rule (nothing to size) returns null, not 0 --
 * 0 would falsely claim "there is nothing to free", null honestly says
 * "there is nothing to preview". */
export function scanRule(rule, guards = {}) {
  // A command rule has nothing to look for on disk, so it's always
  // applicable -- `ipconfig /flushdns` works whether or not anything is
  // cached.
  if (rule.command) return { id: rule.id, ...shellAction.scan(), present: true };
  const expandedPaths = rule.paths.map(expandPath);
  const result = deleteAction.scan({ expandedPaths }, guards);
  return {
    id: rule.id,
    sizeBytes: result.sizeBytes,
    fileCount: result.fileCount,
    heldCount: result.heldCount,
    present: rulePathsExist(rule),
    accessible: result.accessible
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
export function rulePathsExist(rule) {
  // A command rule has no paths to look for, and is always applicable:
  // `ipconfig /flushdns` works whether or not anything is cached. scanRule
  // returns present:true for these BEFORE it gets here, which is why this
  // function never had to know -- until /deep-clean/rules started calling
  // it on its own and threw "rule.paths is not iterable" on the one
  // command rule in the set. The guard belongs with the function rather
  // than with each caller.
  if (rule?.command) return true;

  for (const rawPath of rule?.paths || []) {
    const [driveSegment, ...rest] = deleteAction.pathToSegments(expandPath(rawPath));
    if (!driveSegment) continue;
    for (const match of deleteAction.resolveGlob(driveSegment, rest)) {
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

/** Executes one rule for real. A `paths` rule pre-filters out any locked/
 * inaccessible file (reported in `skipped`, never thrown), then quarantines
 * everything left through the EXISTING quarantine system -- moved, not
 * deleted outright, so a bad match is always recoverable the same way an
 * uninstall's own leftover removal already is. A `command` rule (DNS
 * flush) just runs the command; there is no file to quarantine. */
export async function executeRule(rule, guards = {}) {
  if (rule.command) {
    const result = await shellAction.execute({ command: rule.command });
    return { id: rule.id, ...result };
  }

  const expandedPaths = rule.paths.map(expandPath);
  const result = await deleteAction.execute({ expandedPaths }, rule.name, guards);
  return { id: rule.id, ...result };
}

/** Executes every requested rule id in turn, handing each result to
 * `onItem` -- carrying the rule's own name and category, not just its id
 * -- as soon as it's known, rather than only at the end.
 *
 * This is what a clean actually does under the "Clean" button: quarantine
 * or delete real files, one rule at a time, sometimes a large one (a game's
 * shader cache can take several seconds on its own). The one-shot
 * `executeRules` below returns nothing until every rule is done, which is
 * BleachBit's own "please wait, doing nothing visible" problem, just moved
 * from the scan to the clean -- and the clean is the step that actually
 * touches the disk, so silence here is worse, not better.
 *
 * Same interruptible-between-rules shape as scanRulesProgressively: an
 * `await` after each result hands control back so a response can flush,
 * and `signal` lets a caller stop before the next rule starts. A rule
 * already in progress still runs to completion -- quarantining a batch
 * half-deleted is a worse state than finishing the one rule already
 * underway. */
export async function executeRulesProgressively(ruleIds, onItem, { signal, ...guards } = {}) {
  const rules = loadCleanerRules();
  const results = [];
  let freedBytes = 0;
  let executed = 0;

  for (const id of ruleIds) {
    if (signal?.aborted) return { aborted: true, total: ruleIds.length, executed, freedBytes, results };

    const rule = rules.find((r) => r.id === id);
    if (!rule) {
      const result = { id, error: `Unknown rule id "${id}"` };
      results.push(result);
      onItem(result);
      executed++;
      continue;
    }

    const result = await executeRule(rule, guards);
    freedBytes += result.freedBytes || 0;
    results.push(result);
    onItem({ ...result, name: rule.name, category: rule.category });
    executed++;
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { aborted: false, total: ruleIds.length, executed, freedBytes, results };
}

/** Executes every requested rule id in turn, summing freed bytes into one
 * summary. An id that doesn't match any loaded rule is reported as an
 * error entry rather than thrown -- same "don't trust a caller-supplied
 * id blindly, but don't blow up on it either" posture cleanup.js's own
 * executeCleanup already uses for its category ids.
 *
 * A thin wrapper over executeRulesProgressively now, kept for callers (and
 * tests) that just want the final summary and have no stream to write
 * progress to. */
export async function executeRules(ruleIds, guards = {}) {
  const { freedBytes, results } = await executeRulesProgressively(ruleIds, () => {}, guards);
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
