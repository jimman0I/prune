import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as deleteAction from './cleanerActions/delete.js';
import { resolveGlob, pathToSegments } from './cleanerActions/delete.js';
import * as shellAction from './cleanerActions/shell.js';
import * as sqliteVacuumAction from './cleanerActions/sqliteVacuum.js';
import * as winregAction from './cleanerActions/winreg.js';
import * as jsonAction from './cleanerActions/json.js';
import * as cookieAction from './cleanerActions/cookie.js';
import * as chromeAutofillAction from './cleanerActions/chromeAutofill.js';
import * as chromeKeywordsAction from './cleanerActions/chromeKeywords.js';
import * as chromeHistoryAction from './cleanerActions/chromeHistory.js';
import * as mozillaUrlHistoryAction from './cleanerActions/mozillaUrlHistory.js';
import * as mozillaFaviconsAction from './cleanerActions/mozillaFavicons.js';

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

/** Resolves one bespoke action's `path` (already environment-expanded)
 * into every REAL concrete path it currently matches -- a `*` wildcard
 * (e.g. matching every Chrome profile folder) expands the same way
 * `delete.js`'s own action already does, via the exact same resolver.
 * A path with no `*` resolves to exactly itself (resolveGlob's own
 * documented behavior for the non-wildcard case), so every existing
 * single-profile rule is unaffected. Returns an array -- callers loop
 * over it and merge results, since a wildcard can now genuinely match
 * zero, one, or several real files where the bespoke action types
 * previously only ever saw one. */
export function resolveBespokeActionPaths(expandedPath) {
  const [driveSegment, ...rest] = pathToSegments(expandedPath);
  if (!driveSegment) return [];
  return resolveGlob(driveSegment, rest);
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
 * rule can be written directly in the richer shape. `scanRule`/`executeRule`
 * below both call this and iterate `normalized.actions`, never `rule.paths`/
 * `rule.command` directly -- that's what makes adding a new action type
 * (sqlite.vacuum, winreg, and eventually json/cookie) a matter of adding a
 * new case to their dispatch, not touching every rule already written.
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
 * Mode. Normalizes the rule to its `actions` array (normalizeRule) and
 * dispatches each action to its own module's `scan()` by `type` --
 * `shell`, `delete`, `sqlite.vacuum`, `winreg`, `json` (does the rule's
 * BleachBit-style `address` currently resolve inside the target JSON
 * file?), `cookie` (does the target cookie database exist, and how big is
 * it?), `chrome.autofill` (Chrome/Chromium Web Data file's saved
 * form-field values), `chrome.keywords` (the same Web Data file's
 * user-added search engines), `chrome.history` (Chrome/Chromium History
 * file), `mozilla.url.history` (Firefox-family places.sqlite),
 * `mozilla.favicons` (Firefox-family favicons.sqlite) -- merging their
 * results into one summary: `sizeBytes`/
 * `fileCount` summed, `heldCount` summed,
 * `accessible` ANDed together, `present` true if ANY action reports
 * something there. A rule with only a `shell` action (nothing to size)
 * keeps `sizeBytes`/`fileCount` at null, not 0 -- 0 would falsely claim
 * "there is nothing to free", null honestly says "there is nothing to
 * preview". A rule mixing action types (e.g. a `delete` action and a
 * `sqlite.vacuum` action under one id) is summed across all of them, not
 * just the first. */
/** Whether a rule's `requiresProgram` names a program that isn't in
 * `guards.installedProgramNames` -- case-insensitively on BOTH sides,
 * since neither a rule author's spelling in cleaners.json nor whatever
 * case Windows' own registry happens to report a display name in is
 * guaranteed to match the other. A rule with no `requiresProgram` is
 * never gated (returns false unconditionally). */
function isRequiredProgramMissing(rule, guards) {
  if (!rule?.requiresProgram) return false;
  const required = rule.requiresProgram.toLowerCase();
  for (const installed of guards.installedProgramNames || []) {
    if (String(installed).toLowerCase() === required) return false;
  }
  return true;
}

export function scanRule(rule, guards = {}) {
  // A game/launcher rule's requiresProgram gate wins over everything
  // below -- checked before normalizeRule/the action loop even runs, so
  // a launcher's own scaffolded placeholder folder (confirmed real,
  // e.g. "Install League of Legends eune" under Riot Games' own
  // %LOCALAPPDATA% tree) can never be mistaken for a completed install
  // just because something exists on disk at the expected path.
  if (isRequiredProgramMissing(rule, guards)) {
    return { id: rule.id, sizeBytes: 0, fileCount: 0, heldCount: 0, present: false, accessible: true };
  }

  const normalized = normalizeRule(rule);
  // `accessible` here specifically means "no `delete` action reported a
  // permission problem listing its files" -- it says nothing about a
  // `sqlite.vacuum` or `winreg` action in the same rule, neither of which
  // has an equivalent "can't even look" failure mode this flag tracks.
  // A mixed delete+winreg rule reporting accessible:true is only a
  // promise about the delete half; don't read it as "everything in this
  // rule, registry key included, is reachable."
  let sizeBytes = null, fileCount = null, heldCount = 0, accessible = true, present = false;

  for (const action of normalized.actions) {
    if (action.type === 'shell') {
      present = true;
      // sizeBytes/fileCount stay null -- a shell action has nothing to measure.
    } else if (action.type === 'delete') {
      const expandedPaths = action.paths.map(expandPath);
      const result = deleteAction.scan({ expandedPaths }, guards);
      sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
      fileCount = (fileCount ?? 0) + result.fileCount;
      heldCount += result.heldCount;
      accessible = accessible && result.accessible;
      if (expandedPaths.some((p) => rulePathsExistFor(p))) present = true;
    } else if (action.type === 'sqlite.vacuum') {
      const result = sqliteVacuumAction.scan({ expandedPath: expandPath(action.path) });
      sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
      if (result.present) present = true;
    } else if (action.type === 'winreg') {
      // Presence is checked asynchronously by winreg's own scan(), which
      // this synchronous function can't await -- reported via `present`
      // best-effort as true (registry actions don't gate `present` the
      // way a missing cache folder does; executeRule's own winreg branch
      // is what actually determines whether anything happens). Revisit
      // if a future rule needs an accurate pre-scan presence check for a
      // registry-only rule.
      //
      // User-visible consequence: a winreg-only rule always shows as
      // "present"/applicable in a pre-clean scan, even on a machine where
      // the registry key doesn't exist at all -- the opposite of the
      // "grey out cleaners that don't apply" behavior rulePathsExist's own
      // doc comment calls out as a feature for path-based rules.
      present = true;
    } else if (action.type === 'json') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = jsonAction.scan({ expandedPath: concretePath, address: action.address });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    } else if (action.type === 'cookie') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = cookieAction.scan({ expandedPath: concretePath });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    } else if (action.type === 'chrome.autofill') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = chromeAutofillAction.scan({ expandedPath: concretePath });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    } else if (action.type === 'chrome.keywords') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = chromeKeywordsAction.scan({ expandedPath: concretePath });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    } else if (action.type === 'chrome.history') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = chromeHistoryAction.scan({ expandedPath: concretePath });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    } else if (action.type === 'mozilla.url.history') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = mozillaUrlHistoryAction.scan({ expandedPath: concretePath });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    } else if (action.type === 'mozilla.favicons') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = mozillaFaviconsAction.scan({ expandedPath: concretePath });
        sizeBytes = (sizeBytes ?? 0) + result.sizeBytes;
        if (result.present) present = true;
      }
    }
  }

  return { id: rule.id, sizeBytes, fileCount, heldCount, present, accessible };
}

/** Whether ONE already-expanded path (from a delete action) exists --
 * used by scanRule's per-action loop above so a rule mixing action types
 * can still answer "present" correctly without calling the whole-rule
 * rulePathsExist(), which expects raw (unexpanded) rule.paths. */
function rulePathsExistFor(expandedPath) {
  const [driveSegment, ...rest] = deleteAction.pathToSegments(expandedPath);
  if (!driveSegment) return false;
  return deleteAction.resolveGlob(driveSegment, rest).some(pathExistsOrDenied);
}

/** Whether a resolved path is there, counting "access denied" as there.
 * existsSync() returns false on EPERM, but Windows only answers "access
 * denied" for something that exists to deny -- Defender's scan-history
 * folders stat as EPERM to an unelevated process, and reading that as
 * "not installed" dimmed the row and let "hide cleaners that don't apply"
 * hide it, instead of showing "needs admin". Same EPERM/EACCES rule
 * collectFiles already uses for `accessible`. */
function pathExistsOrDenied(path) {
  try {
    statSync(path);
    return true;
  } catch (err) {
    return err?.code === 'EPERM' || err?.code === 'EACCES';
  }
}

/** Whether any of a rule's target paths exists at all -- which is a
 * genuinely different question from whether it has anything in it.
 *
 * "Discord isn't installed" and "Discord's cache is already empty" both
 * scan to 0 bytes, and showing both as a flat "0 B" tells the user
 * nothing. BleachBit's own UI makes the same distinction (it greys out
 * cleaners that don't apply to the machine), and with a rule set this
 * size most rules won't apply to any given user -- so the difference
 * carries most of the list's signal.
 *
 * It used to read only `rule.paths`, so every actions-form rule (browser
 * history, cookies, autofill...) was reported absent before a scan and
 * hidden by "hide cleaners that don't apply". It now walks the normalized
 * actions: `delete` paths and the bespoke actions' single `path` are
 * checked on disk; `shell` and `winreg` can't be answered from the
 * filesystem and count as present. */
export function rulePathsExist(rule, guards = {}) {
  // A command rule has no paths to look for, and is always applicable:
  // `ipconfig /flushdns` works whether or not anything is cached. scanRule
  // returns present:true for these BEFORE it gets here, which is why this
  // function never had to know -- until /deep-clean/rules started calling
  // it on its own and threw "rule.paths is not iterable" on the one
  // command rule in the set. The guard belongs with the function rather
  // than with each caller.
  if (rule?.command) return true;
  if (isRequiredProgramMissing(rule, guards)) return false;

  // A malformed rule (none of actions/command/paths) is "nothing there",
  // not a throw -- normalizeRule's own throw is for scan/execute, where a
  // broken rule should fail loudly; here it would take down the whole list.
  if (!rule?.actions && !rule?.paths) return false;
  for (const action of normalizeRule(rule).actions) {
    // Neither can be answered from the filesystem, and the pre-scan list
    // keeps an unmeasured rule rather than hiding it (visibleRules.js).
    if (action.type === 'shell' || action.type === 'winreg') return true;
    const rawPaths = action.type === 'delete' ? action.paths : [action.path];
    for (const rawPath of rawPaths || []) {
      if (rawPath && rulePathsExistFor(expandPath(rawPath))) return true;
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

/** Executes one rule for real. Normalizes the rule to its `actions` array
 * (normalizeRule) and dispatches each action to its own module's
 * `execute()` by `type`, merging their results into one summary:
 * `freedBytes` summed across every action, `skipped` concatenated, and
 * `registryKeysRemoved`/`vacuumed`/`recycled`/`quarantineBatch`/
 * `ranCommand`/`error` each included only when an action of the matching
 * type actually produced one (never present-but-undefined).
 *
 * - `delete` pre-filters out any locked/inaccessible file (reported in
 *   `skipped`, never thrown), then quarantines everything left through
 *   the EXISTING quarantine system -- moved, not deleted outright, so a
 *   bad match is always recoverable the same way an uninstall's own
 *   leftover removal already is.
 * - `shell` (e.g. DNS flush) just runs the command; there is no file to
 *   quarantine.
 * - `sqlite.vacuum` rewrites the target database in place via VACUUM;
 *   again nothing to quarantine.
 * - `winreg` removes one registry key through the same quarantine-then-
 *   delete path `delete` uses, just for a key instead of a file.
 * - `json` deletes one key (BleachBit-style `address`) out of a parsed
 *   JSON file and rewrites it in place, quarantining the original --
 *   never a whole-file delete, since the rest of the file's data must
 *   survive.
 * - `cookie` either removes the whole cookie database (no keep list, or
 *   one that matches nothing in this specific file) through the same
 *   quarantine-then-delete path `delete` uses, or -- when a keep list
 *   matches at least one row in this file -- a surgical DELETE + VACUUM
 *   through the bundled sqlite3.exe CLI, quarantining the original first.
 * - `chrome.autofill` clears the Chrome/Chromium Web Data file's
 *   `autofill` table (saved form-field values) and VACUUMs, quarantining
 *   the original first.
 * - `chrome.keywords` deletes only user-added search engines from the
 *   same Web Data file's `keywords` (and, when present, `keywords_backup`)
 *   table and VACUUMs, quarantining the original first.
 * - `chrome.history` clears the Chrome/Chromium History file while
 *   preserving bookmarked URLs' own rows (read from the sibling
 *   Bookmarks JSON file) and VACUUMs, quarantining the original first.
 * - `mozilla.url.history` clears a Firefox-family places.sqlite's
 *   browsing history while preserving bookmarked places and VACUUMs,
 *   quarantining the original first.
 * - `mozilla.favicons` clears a Firefox-family favicons.sqlite's
 *   unbookmarked-page icons, cross-referencing a sibling places.sqlite
 *   (read-only, never quarantined) and VACUUMs, quarantining the
 *   favicons file first.
 *
 * A rule mixing action types (e.g. a `delete` action and a
 * `sqlite.vacuum` action under one id) runs every action and sums
 * `freedBytes` across all of them, not just the first. */
export async function executeRule(rule, guards = {}) {
  const normalized = normalizeRule(rule);
  let freedBytes = 0;
  let registryKeysRemoved;
  const skipped = [];
  let recycled, quarantineBatch, ranCommand, error, vacuumed, edited;

  for (const action of normalized.actions) {
    if (action.type === 'shell') {
      const result = await shellAction.execute(action);
      ranCommand = true;
      if (result.error) error = result.error;
    } else if (action.type === 'delete') {
      const expandedPaths = action.paths.map(expandPath);
      const result = await deleteAction.execute({ expandedPaths }, rule.name, guards);
      freedBytes += result.freedBytes;
      skipped.push(...result.skipped);
      if (result.recycled) recycled = true;
      if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
    } else if (action.type === 'sqlite.vacuum') {
      const result = await sqliteVacuumAction.execute({ expandedPath: expandPath(action.path) }, guards);
      freedBytes += result.freedBytes;
      skipped.push(...result.skipped);
      // The one discriminator a frontend has for "this result came from a
      // sqlite.vacuum action" -- freedBytes alone is indistinguishable
      // from a delete action's freedBytes (both are just a byte count),
      // and executeRule's result carries no fileCount (that's a
      // scan-time/preview concept scanRule tracks, never something
      // execute's dispatcher returns). Same conditional-only-when-true
      // shape as `recycled`/`registryKeysRemoved` below.
      vacuumed = true;
    } else if (action.type === 'winreg') {
      const result = await winregAction.execute({ expandedKey: expandPath(action.key) }, rule.name);
      freedBytes += result.freedBytes;
      registryKeysRemoved = (registryKeysRemoved || 0) + result.registryKeysRemoved;
      skipped.push(...result.skipped);
      if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
    } else if (action.type === 'json') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await jsonAction.execute({ expandedPath: concretePath, address: action.address }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.recycled) recycled = true;
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
        // The one discriminator a frontend has for "this result came from a
        // json action" -- same conditional-only-when-true shape as `vacuumed`
        // above, mirrored exactly: freedBytes alone can't tell a json key
        // removal apart from a delete action's freedBytes.
        edited = true;
      }
    } else if (action.type === 'cookie') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await cookieAction.execute({ expandedPath: concretePath }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.recycled) recycled = true;
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
      }
    } else if (action.type === 'chrome.autofill') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await chromeAutofillAction.execute({ expandedPath: concretePath }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
      }
    } else if (action.type === 'chrome.keywords') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await chromeKeywordsAction.execute({ expandedPath: concretePath }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
      }
    } else if (action.type === 'chrome.history') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await chromeHistoryAction.execute({ expandedPath: concretePath }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
      }
    } else if (action.type === 'mozilla.url.history') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await mozillaUrlHistoryAction.execute({ expandedPath: concretePath }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
      }
    } else if (action.type === 'mozilla.favicons') {
      for (const concretePath of resolveBespokeActionPaths(expandPath(action.path))) {
        const result = await mozillaFaviconsAction.execute({ expandedPath: concretePath }, rule.name, guards);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
        if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
      }
    }
  }

  return {
    id: rule.id,
    freedBytes,
    skipped,
    ...(registryKeysRemoved !== undefined ? { registryKeysRemoved } : {}),
    ...(vacuumed ? { vacuumed } : {}),
    ...(edited ? { edited } : {}),
    ...(recycled ? { recycled } : {}),
    ...(quarantineBatch ? { quarantineBatch } : {}),
    ...(ranCommand ? { ranCommand } : {}),
    ...(error ? { error } : {})
  };
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
