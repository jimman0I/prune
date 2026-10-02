import { readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { settingsPath } from '../services/settings.js';
import { normalizeCustomLocations, customLocationsRule } from './customLocations.js';

/** The rules that belong to the user rather than to Prune: the Custom
 * locations rule, and every imported BleachBit cleaner.
 *
 * Imported cleaners are one JSON file each in a folder beside the settings
 * (so under userData, surviving upgrades): { id, label, description,
 * importedAt, source, rules, report }. They are read back synchronously and
 * on every load, like cleaners.json itself, so an import or a removal shows
 * on the next scan without a restart.
 *
 * The folder is not trusted when it is read, even though Prune wrote it:
 * it is a plain file anyone can edit. Whatever is on disk, a loaded rule
 * has only `delete` actions, every one `userDefined` (kept out of the
 * protected places), is never ticked by default, and has an `imp_` id that
 * cannot shadow a built-in rule. */

export function importedDir() {
  return join(dirname(settingsPath()), 'imported-cleaners');
}

const ID_PATTERN = /^[a-z0-9_]{1,40}$/;

/** Writes (or replaces) one imported cleaner. */
export async function saveImported(cleaner, report, { dir = importedDir(), source = '', now = Date.now() } = {}) {
  if (!ID_PATTERN.test(cleaner?.id ?? '')) throw new Error('A cleaner needs a plain id to be stored.');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${cleaner.id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({
    id: cleaner.id, label: cleaner.label, description: cleaner.description ?? '',
    importedAt: now, source: String(source).slice(0, 200), rules: cleaner.rules, report
  }, null, 2), 'utf8');
  await rename(tmp, file);
}

/** Deletes one imported cleaner. False when there was none, or the id is not
 * a plain id -- an id is never allowed to name a path. */
export async function removeImported(id, { dir = importedDir() } = {}) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return false;
  const names = (() => { try { return readdirSync(dir); } catch { return []; } })();
  if (!names.includes(`${id}.json`)) return false;
  await rm(join(dir, `${id}.json`), { force: true });
  return true;
}

function readStored(dir) {
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  const stored = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    try {
      const data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (data && typeof data.id === 'string' && ID_PATTERN.test(data.id) && Array.isArray(data.rules)) stored.push(data);
    } catch { /* an unreadable file is skipped, never fatal */ }
  }
  return stored;
}

/** The imported cleaners, for the Settings list. */
export function listImported({ dir = importedDir() } = {}) {
  return readStored(dir).map((data) => ({
    id: data.id,
    label: String(data.label ?? data.id),
    source: String(data.source ?? ''),
    importedAt: Number(data.importedAt) || 0,
    ruleCount: data.rules.length,
    report: data.report ?? null
  }));
}

/** A stored rule, made safe: delete actions only, all userDefined, with
 * string paths, never recommended. Null when nothing usable remains. */
function sanitizeRule(rule) {
  if (!rule || typeof rule.id !== 'string' || !rule.id.startsWith('imp_') || !Array.isArray(rule.actions)) return null;
  const actions = [];
  for (const action of rule.actions) {
    if (action?.type !== 'delete' || !Array.isArray(action.paths)) continue;
    const paths = action.paths.filter((p) => typeof p === 'string' && p.trim() !== '');
    if (paths.length === 0) continue;
    actions.push({ type: 'delete', paths, ...(action.filesOnly === true ? { filesOnly: true } : {}), userDefined: true });
  }
  if (actions.length === 0) return null;
  return {
    id: rule.id,
    category: String(rule.category ?? 'Imported'),
    name: String(rule.name ?? rule.id),
    description: String(rule.description ?? ''),
    recommended: false,
    is_safe: false,
    ...(rule.risky === true ? { risky: true } : {}),
    imported: true,
    importedFrom: String(rule.importedFrom ?? ''),
    actions
  };
}

/** Everything user-owned that Deep Clean should list, custom locations first. */
export function loadUserRules({ settingsFile = settingsPath(), dir = importedDir() } = {}) {
  const rules = [];
  let locations = [];
  try {
    locations = normalizeCustomLocations(JSON.parse(readFileSync(settingsFile, 'utf8')).customLocations);
  } catch { /* no settings file, or an unreadable one: no custom locations */ }
  const custom = customLocationsRule(locations);
  if (custom) rules.push(custom);

  const taken = new Set(rules.map((r) => r.id));
  for (const data of readStored(dir)) {
    for (const raw of data.rules) {
      const rule = sanitizeRule(raw);
      if (rule && !taken.has(rule.id)) { taken.add(rule.id); rules.push(rule); }
    }
  }
  return rules;
}
