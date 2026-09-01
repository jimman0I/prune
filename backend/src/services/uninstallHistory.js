import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Path to the history file. A function, not a constant -- read at call
 * time so tests can point it at a scratch file via UNREVO_HISTORY_FILE,
 * matching quarantine.js's own UNREVO_QUARANTINE_ROOT override pattern. */
function historyFilePath() {
  return process.env.UNREVO_HISTORY_FILE
    || join(process.env.LOCALAPPDATA || process.cwd(), 'unrevo', 'uninstall-history.jsonl');
}

/** Appends one completed-uninstall record as a JSON line. A flat
 * append-only file, not a database -- Recent Activity only ever reads the
 * last few entries, and an append is the only write this ever needs. */
export async function appendHistoryEntry({ programName, publisher, sizeBytes }) {
  const path = historyFilePath();
  await mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify({ programName, publisher, sizeBytes, timestamp: Date.now() });
  await appendFile(path, line + '\n', 'utf8');
}

/** Last `limit` entries, newest first. A full-file read is fine at this
 * scale (this file only ever grows by real uninstalls a person actually
 * runs -- hundreds of lines at most over the life of an install, not
 * millions) -- no need for a tail-seeking read. */
export async function getRecentHistory(limit = 5) {
  const path = historyFilePath();
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  return lines.slice(-limit).reverse().map(line => JSON.parse(line));
}