import { expandPath } from './expandPath.js';
import { protectionReason } from '../services/pathGuard.js';

/** "Custom locations": files, folders and patterns the user adds in Settings.
 *
 * They appear in Deep Clean as one rule of their own, never ticked by
 * default. Nobody curated these paths, so there are two lines of defence and
 * this file is the first: what may be SAVED at all. (The second is at scan
 * and clean time -- the rule's delete action is `userDefined`, which keeps
 * every file out of Windows, Program Files, a profile's own folders and
 * Prune's Quarantine, on top of the exclusions and recent-files guard every
 * rule has.)
 *
 * A location is a path with optional `*` wildcards and the same %VARIABLES%
 * and leading ~ the built-in rules use. */

export const CUSTOM_RULE_ID = 'custom_locations';
export const MAX_CUSTOM_LOCATIONS = 100;
const MAX_LENGTH = 500;

/** { ok: true, path } with the path tidied (trimmed, one kind of slash, no
 * trailing separator), or { ok: false, reason } where reason is one of
 * empty | long | climb | relative | protected | wildcard. */
export function validateCustomLocation(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'empty' };
  const path = raw.trim().replace(/\//g, '\\').replace(/(?<=.)\\+$/, '');
  if (path.length > MAX_LENGTH) return { ok: false, reason: 'long' };
  if (path.includes('..')) return { ok: false, reason: 'climb' };
  // A drive, a UNC share, a %VARIABLE% or ~ -- never something relative to
  // wherever this process happens to be running.
  if (!/^([A-Za-z]:|%|~|\\\\)/.test(path)) return { ok: false, reason: 'relative' };

  const expanded = expandPath(path);
  if (!/^([A-Za-z]:|\\\\[^\\])/.test(expanded)) return { ok: false, reason: 'relative' };

  if (protectionReason(expanded)) return { ok: false, reason: 'protected' };

  // A wildcard in the first folders (C:\*, D:\Games\*) matches a whole
  // drive's worth: almost certainly a slip, and never worth the chance.
  const segments = expanded.split('\\').filter(Boolean);
  const firstWild = segments.findIndex((s) => s.includes('*'));
  if (firstWild !== -1 && firstWild < 3) return { ok: false, reason: 'wildcard' };

  return { ok: true, path };
}

/** The saved list: valid entries only, in order, without duplicates (Windows
 * paths are case-insensitive), capped. Anything that is not a list is empty. */
export function normalizeCustomLocations(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const result = validateCustomLocation(raw);
    if (!result.ok) continue;
    const key = result.path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result.path);
    if (out.length >= MAX_CUSTOM_LOCATIONS) break;
  }
  return out;
}

/** The rule that stands for the list, or null when it is empty. `custom`
 * tells the screen to name and describe it in the user's language. */
export function customLocationsRule(locations) {
  if (!Array.isArray(locations) || locations.length === 0) return null;
  return {
    id: CUSTOM_RULE_ID,
    category: 'Custom',
    name: 'Custom locations',
    description: 'Files and folders you added yourself in Settings.',
    recommended: false,
    is_safe: false,
    custom: true,
    actions: [{ type: 'delete', paths: [...locations], userDefined: true }]
  };
}
