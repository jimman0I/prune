import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** What a clean started by Windows Task Scheduler tells the app afterwards.
 *
 * That run is a separate process -- `prune-cli.cmd clean --preset recommended
 * --report`, started while Prune is closed -- so it can only leave a file. The
 * file is `scheduled-clean-report.json`, beside settings.json in the same
 * userData folder, and holds the last few runs: when, which rules, how many
 * bytes were moved and how many really freed, and what failed.
 *
 * Two writers, two files, so neither ever overwrites the other:
 *  - the command line only ever appends to the report;
 *  - the app only ever writes the marker `scheduled-clean-counted.json`, which
 *    says how far it has added the report's runs to the lifetime total.
 * A run is added to the total exactly once: after the marker has moved past it.
 * The marker is written FIRST, so a crash between the two can lose a count but
 * can never make one twice -- the safer way round for a number on a caption.
 * Only space that is really back counts (stats.js's own rule): a run that moved
 * files into Quarantine adds nothing here, because the batch is counted when it
 * is finally deleted. */

export const MAX_RUNS = 30;
const MAX_ERRORS = 10;
const MAX_ERROR_LENGTH = 300;

/** Read at call time, so a test (or the CLI's --settings) can point it
 * elsewhere. Beside settings.json by default, exactly as stats.js does. */
export function reportPath() {
  if (process.env.UNREVO_REPORT_PATH) return process.env.UNREVO_REPORT_PATH;
  const settings = process.env.UNREVO_SETTINGS_PATH
    || join(process.env.LOCALAPPDATA || process.cwd(), 'Prune', 'settings.json');
  return join(dirname(settings), 'scheduled-clean-report.json');
}

export function countedPath() {
  return join(dirname(reportPath()), 'scheduled-clean-counted.json');
}

const whole = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** One run, from the rows `prune-cli clean` produced. */
export function buildRun({ startedAt, finishedAt, mode, rows = [] }) {
  const failed = rows.filter((r) => r.error);
  return {
    id: finishedAt,
    at: finishedAt,
    startedAt,
    mode: mode === 'delete' ? 'delete' : 'quarantine',
    ok: failed.length === 0,
    rulesRun: rows.length,
    rulesCleaned: rows.filter((r) => !r.error && (whole(r.freedBytes) > 0 || whole(r.movedBytes) > 0)).length,
    rulesFailed: failed.length,
    freedBytes: rows.reduce((sum, r) => sum + whole(r.freedBytes), 0),
    movedBytes: rows.reduce((sum, r) => sum + whole(r.movedBytes), 0),
    skippedCount: rows.reduce((sum, r) => sum + whole(r.skippedCount), 0),
    errors: failed.slice(0, MAX_ERRORS).map((r) => ({ id: String(r.id), error: String(r.error).slice(0, MAX_ERROR_LENGTH) }))
  };
}

/** A run as the file holds it, or null if it is not one. Nothing in the file is
 * trusted: it sits in a user folder and anything can edit it. */
function normalizeRun(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = whole(raw.id);
  if (id === 0) return null;
  const errors = Array.isArray(raw.errors)
    ? raw.errors.filter((e) => e && typeof e === 'object').slice(0, MAX_ERRORS)
      .map((e) => ({ id: String(e.id ?? '').slice(0, 80), error: String(e.error ?? '').slice(0, MAX_ERROR_LENGTH) }))
    : [];
  return {
    id,
    at: whole(raw.at) || id,
    startedAt: whole(raw.startedAt) || id,
    mode: raw.mode === 'delete' ? 'delete' : 'quarantine',
    ok: raw.ok !== false && errors.length === 0 && whole(raw.rulesFailed) === 0,
    rulesRun: whole(raw.rulesRun),
    rulesCleaned: whole(raw.rulesCleaned),
    rulesFailed: whole(raw.rulesFailed),
    freedBytes: whole(raw.freedBytes),
    movedBytes: whole(raw.movedBytes),
    skippedCount: whole(raw.skippedCount),
    errors
  };
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Every run the report holds, oldest first. A missing or damaged file is
 * simply no runs. */
export async function readRuns() {
  const file = await readJson(reportPath());
  if (!file || !Array.isArray(file.runs)) return [];
  return file.runs.map(normalizeRun).filter(Boolean).sort((a, b) => a.id - b.id);
}

export async function latestRun() {
  const runs = await readRuns();
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

async function writeAtomically(path, data) {
  await mkdir(dirname(path), { recursive: true });
  // Beside the real file, then renamed over it: the app reading while the
  // command line writes sees the old report or the new one, never half of one.
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(data), 'utf8');
    await rename(tmp, path);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

/** Adds one run to the report, keeping the most recent MAX_RUNS. Called by the
 * command line only. */
export async function appendRun(run) {
  const runs = [...(await readRuns()), normalizeRun(run)].filter(Boolean).slice(-MAX_RUNS);
  await writeAtomically(reportPath(), { version: 1, runs });
}

// One at a time, so two checks arriving together cannot both find the same
// run uncounted.
let queue = Promise.resolve();

async function ingest(recordFreed) {
  const counted = await readJson(countedPath());
  const through = whole(counted?.through);
  const fresh = (await readRuns()).filter((r) => r.id > through);
  if (fresh.length === 0) return { countedBytes: 0, runs: 0 };

  const countedBytes = fresh.reduce((sum, r) => sum + r.freedBytes, 0);
  await writeAtomically(countedPath(), { version: 1, through: fresh[fresh.length - 1].id });
  if (countedBytes > 0) await recordFreed(countedBytes);
  return { countedBytes, runs: fresh.length };
}

/** Adds what the unattended runs really freed to the lifetime total, once per
 * run. `recordFreed` is stats.js's, passed in so the app and a test use the
 * same door. Never throws: a note that cannot be read is no reason for a screen
 * to fail. */
export function ingestReport({ recordFreed }) {
  const run = queue.then(() => ingest(recordFreed)).catch(() => ({ countedBytes: 0, runs: 0 }));
  queue = run.then(() => {});
  return run;
}
