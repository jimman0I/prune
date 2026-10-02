import { appendFile, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';

/** Path to the history file. A function, not a constant -- read at call
 * time so tests can point it at a scratch file via UNREVO_HISTORY_FILE,
 * matching quarantine.js's own UNREVO_QUARANTINE_ROOT override pattern. */
function historyFilePath() {
  return process.env.UNREVO_HISTORY_FILE
    || join(process.env.LOCALAPPDATA || process.cwd(), 'Prune', 'uninstall-history.jsonl');
}

/** What an entry may carry. The log started as { programName, publisher,
 * sizeBytes, timestamp }; it now records what happened too -- the scan mode,
 * how many leftovers were found and removed, where they went, and which
 * safety nets existed -- so the History view can say more than a name.
 * Everything arrives from a request body, so only these fields, only of the
 * right type, are ever written. */
const STRING_FIELDS = [
  'programName', 'publisher', 'version', 'scanMode', 'destination', 'outcome', 'kind',
  'quarantineBatch', 'registryBackup'
];
const NUMBER_FIELDS = ['sizeBytes', 'leftoversFound', 'leftoversRemoved', 'bytesFreed', 'tasksRemoved', 'failedCount'];
const MAX_TEXT = 500;

export function cleanEntryFields(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const field of STRING_FIELDS) {
    if (typeof input[field] === 'string') out[field] = input[field].slice(0, MAX_TEXT);
  }
  for (const field of NUMBER_FIELDS) {
    if (typeof input[field] === 'number' && Number.isFinite(input[field])) out[field] = input[field];
  }
  const restore = input.restorePoint;
  if (restore && typeof restore === 'object' && typeof restore.created === 'boolean') {
    out.restorePoint = { created: restore.created };
    if (typeof restore.reason === 'string') out.restorePoint.reason = restore.reason.slice(0, MAX_TEXT);
  }
  return out;
}

const newId = () => randomBytes(6).toString('hex');

/** Appends one record as a JSON line and returns it, id included. A flat
 * append-only file, not a database -- one line per uninstall a person ran. */
export async function appendHistoryEntry(fields) {
  const path = historyFilePath();
  await mkdir(dirname(path), { recursive: true });
  const entry = { id: newId(), ...cleanEntryFields(fields), timestamp: Date.now() };
  await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

/** Every entry, newest first. A line that does not parse is skipped, and an
 * entry written before ids existed is given a stable one made from its
 * position, so it can be shown and selected like any other. */
export async function getAllHistory() {
  const path = historyFilePath();
  if (!existsSync(path)) return [];
  const lines = (await readFile(path, 'utf8')).split('\n').filter(Boolean);
  const entries = [];
  lines.forEach((line, index) => {
    try {
      const entry = JSON.parse(line);
      if (entry && typeof entry === 'object') entries.push(entry.id ? entry : { ...entry, id: `legacy-${index}` });
    } catch { /* a damaged line must not hide the rest */ }
  });
  return entries.reverse();
}

/** Last `limit` entries, newest first. */
export async function getRecentHistory(limit = 5) {
  return (await getAllHistory()).slice(0, limit);
}

/** Adds what became known after the entry was written -- how the leftover
 * review went. Rewrites the file beside itself and renames it over, like the
 * settings, so a crash leaves the old log or the new one and never half. A
 * missing id is not an error: the history may have been turned off or
 * cleared in between. */
export async function updateHistoryEntry(id, fields) {
  const path = historyFilePath();
  if (typeof id !== 'string' || !existsSync(path)) return false;
  const patch = cleanEntryFields(fields);
  const lines = (await readFile(path, 'utf8')).split('\n').filter(Boolean);
  let found = false;
  const rewritten = lines.map((line, index) => {
    try {
      const entry = JSON.parse(line);
      const entryId = entry.id || `legacy-${index}`;
      if (entryId !== id) return line;
      found = true;
      return JSON.stringify({ ...entry, id: entryId, ...patch });
    } catch {
      return line;
    }
  });
  if (!found) return false;
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, rewritten.join('\n') + '\n', 'utf8');
  await rename(temp, path);
  return true;
}

/** Deletes the whole log. Returns how many entries there were. */
export async function clearHistory() {
  const path = historyFilePath();
  if (!existsSync(path)) return 0;
  const count = (await getAllHistory()).length;
  await rm(path, { force: true });
  return count;
}
