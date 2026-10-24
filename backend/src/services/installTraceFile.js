import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { installTraceRoot, getTrace, saveTrace, newTraceId, isTraceId } from './installTraces.js';
import { appVersion } from './updateCheck.js';
import { listInstalledPrograms } from './programs.js';

/** Install traces as a portable file: export one or all, import them back.
 *
 * A trace is only worth anything while its program is installed, and it is
 * only on this PC. Reinstall Windows, move to a new PC, or reset Prune's data
 * and every monitored install is gone, with its programs still there. So the
 * traces can be written to one `.prunetraces` file and read back -- here, or
 * on another PC that has the same programs.
 *
 * The file is JSON: a header that says what it is (`format`), which shape of
 * the file it is (`version`), when it was written and by which Prune, then
 * the traces themselves, each exactly as saveTrace writes it minus its id.
 *
 * An imported file is somebody else's text, whoever wrote it, so nothing in
 * it is trusted:
 *   - the header must be this format, and a version this Prune can read;
 *   - the file has a size cap, checked before it is parsed, and a cap on how
 *     many traces it can hold;
 *   - each trace is rebuilt field by field from what buildTrace writes. A
 *     field of the wrong type rejects that trace, a field nobody writes is
 *     left behind, every string has a length cap, and a path must be a local
 *     absolute path that does not climb (`..`) -- it is a path to check for
 *     later, never one to open, run or delete now;
 *   - the id in the file is never used. Ids become file names, so each
 *     imported trace gets a fresh one from newTraceId, and an id like
 *     `..\..\x` names nothing at all.
 * A trace that is the same program with the same content as one already
 * here (or earlier in the same file) is skipped, so importing a backup twice
 * changes nothing.
 *
 * Imported traces are linked to this PC's programs the same way a new one is:
 * by the program's own Add/Remove key. Another PC can have filed the same
 * program under a different key (per-user rather than per-machine, the
 * 32-bit hive, a different product code), so a trace whose key is not here is
 * matched once more by the program's name -- and its publisher, if the name
 * alone is ambiguous -- and, if exactly one program matches, its key is
 * rewritten to this PC's. A trace whose program is not installed here is
 * still kept: installing the program later is exactly when it is needed. */

export const TRACE_FILE_FORMAT = 'prune-install-traces';
export const TRACE_FILE_VERSION = 1;
export const TRACE_FILE_EXTENSION = '.prunetraces';
/** The biggest file an import reads. One trace holds at most 5000 new files
 * and folders (installSnapshot's maxAdded), a few hundred KB of JSON; this is
 * room for dozens of the biggest, and still parses in well under a second. */
export const MAX_TRACE_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_TRACES_PER_FILE = 1000;

/** The shape of one trace this Prune writes (installMonitor's buildTrace). */
const TRACE_VERSION = 1;
const MAX_FILES = 5000;
const MAX_REGISTRY = 5000;
const MAX_SERVICES = 1000;
const MAX_TASKS = 1000;
const MAX_ALSO_INSTALLED = 200;
const MAX_PATH_CHARS = 4096;
const MAX_TEXT_CHARS = 1024;
const MAX_COMMAND_CHARS = 8192;

export class TraceFileError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/* ------------------------------------------------------------- validation */

/** Thrown inside sanitizeTrace and turned into a rejected trace. */
class Reject extends Error {}
const reject = () => { throw new Reject(); };

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const CONTROL = /[\u0000-\u001f\u007f]/;

function text(value, max, { nullable = false, allowEmpty = false } = {}) {
  if (value === null || value === undefined) return nullable ? null : reject();
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) reject();
  if (!allowEmpty && value.length === 0) reject();
  return value;
}

function count(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) reject();
  return value;
}

function list(value, max) {
  if (!Array.isArray(value) || value.length > max) reject();
  return value;
}

/** A local absolute path such as `C:\Program Files\Acme`: a drive letter, then
 * segments with none of the characters Windows refuses in a name, none of them
 * `.` or `..`, none empty. Not a drive root, not UNC, not a device path, not a
 * relative one. */
export function isLocalPath(value) {
  if (typeof value !== 'string' || value.length > MAX_PATH_CHARS) return false;
  if (!/^[A-Za-z]:\\/.test(value)) return false;
  const rest = value.slice(3).replace(/\\$/, '');
  if (rest === '' || CONTROL.test(rest) || /[<>:"|?*/]/.test(rest)) return false;
  return rest.split('\\').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** A key in the spelling the scans use: HKEY_LOCAL_MACHINE\... or
 * HKEY_CURRENT_USER\..., the two hives an installer writes to. */
const isRegistryPath = (value) => typeof value === 'string' && value.length <= MAX_PATH_CHARS
  && !CONTROL.test(value) && /^HKEY_(LOCAL_MACHINE|CURRENT_USER)\\[^\\]/i.test(value);

/** The `HKLM:\...` spelling the program list uses for registryKey. */
const isPsRegistryPath = (value) => typeof value === 'string' && value.length <= MAX_PATH_CHARS
  && !CONTROL.test(value) && /^HK(LM|CU):\\[^\\]/i.test(value);

function sanitizeProgram(raw) {
  if (raw === null) return null;
  if (!isObject(raw)) reject();
  if (!isRegistryPath(raw.key)) reject();
  if (raw.registryKey != null && !isPsRegistryPath(raw.registryKey)) reject();
  return {
    name: text(raw.name, MAX_TEXT_CHARS),
    publisher: text(raw.publisher, MAX_TEXT_CHARS, { nullable: true }),
    version: text(raw.version, MAX_TEXT_CHARS, { nullable: true }),
    installLocation: text(raw.installLocation, MAX_PATH_CHARS, { nullable: true }),
    uninstallString: text(raw.uninstallString, MAX_COMMAND_CHARS, { nullable: true }),
    key: raw.key,
    registryKey: raw.registryKey ?? null
  };
}

function sanitizeFile(raw) {
  if (!isObject(raw) || !isLocalPath(raw.path) || typeof raw.isDirectory !== 'boolean') reject();
  return { path: raw.path, isDirectory: raw.isDirectory, sizeBytes: raw.sizeBytes === null ? null : count(raw.sizeBytes) };
}

function sanitizeRegistry(raw) {
  if (!isObject(raw) || !isRegistryPath(raw.path)) reject();
  if (raw.valueName === undefined) return { path: raw.path };
  return { path: raw.path, valueName: text(raw.valueName, MAX_TEXT_CHARS, { allowEmpty: true }) };
}

function sanitizeService(raw) {
  if (!isObject(raw)) reject();
  return { name: text(raw.name, MAX_TEXT_CHARS), pathName: text(raw.pathName, MAX_COMMAND_CHARS, { nullable: true }) };
}

function sanitizeTask(raw) {
  if (!isObject(raw)) reject();
  const path = text(raw.path, MAX_PATH_CHARS);
  if (!path.startsWith('\\')) reject();
  return { name: text(raw.name, MAX_TEXT_CHARS), path };
}

/** One trace from a file, rebuilt from the fields buildTrace writes, without
 * its id; null if anything in it is not what Prune would have written. */
export function sanitizeTrace(raw) {
  try {
    if (!isObject(raw) || raw.version !== TRACE_VERSION) reject();
    if (typeof raw.partial !== 'boolean') reject();
    return {
      version: TRACE_VERSION,
      createdAt: count(raw.createdAt),
      durationMs: count(raw.durationMs),
      installer: text(raw.installer, MAX_PATH_CHARS),
      program: sanitizeProgram(raw.program),
      alsoInstalled: list(raw.alsoInstalled, MAX_ALSO_INSTALLED).map((name) => text(name, MAX_TEXT_CHARS)),
      files: list(raw.files, MAX_FILES).map(sanitizeFile),
      modifiedFileCount: count(raw.modifiedFileCount),
      registry: list(raw.registry, MAX_REGISTRY).map(sanitizeRegistry),
      services: list(raw.services, MAX_SERVICES).map(sanitizeService),
      tasks: list(raw.tasks, MAX_TASKS).map(sanitizeTask),
      partial: raw.partial
    };
  } catch (err) {
    if (err instanceof Reject) return null;
    throw err;
  }
}

/** The header and the trace list of a file's text. Throws a TraceFileError
 * whose code says what is wrong with the file as a whole; what is wrong with
 * one trace is sanitizeTrace's business. */
export function parseTraceFile(content) {
  if (typeof content !== 'string' || content.trim() === '') throw new TraceFileError('notTraceFile', 'The file is empty.');
  if (Buffer.byteLength(content, 'utf8') > MAX_TRACE_FILE_BYTES) {
    throw new TraceFileError('tooLarge', 'The file is too large to be an install trace file.');
  }
  let parsed;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new TraceFileError('notJson', 'The file is not an install trace file (it is not JSON).');
  }
  if (!isObject(parsed) || parsed.format !== TRACE_FILE_FORMAT) {
    throw new TraceFileError('notTraceFile', 'The file is not an install trace file.');
  }
  if (!Number.isInteger(parsed.version) || parsed.version < 1) {
    throw new TraceFileError('notTraceFile', 'The file is not an install trace file.');
  }
  if (parsed.version > TRACE_FILE_VERSION) {
    throw new TraceFileError('newerVersion', 'The file was written by a newer Prune. Update Prune to import it.');
  }
  if (!Array.isArray(parsed.traces)) throw new TraceFileError('notTraceFile', 'The file is not an install trace file.');
  if (parsed.traces.length > MAX_TRACES_PER_FILE) {
    throw new TraceFileError('tooMany', `The file holds more than ${MAX_TRACES_PER_FILE} install traces.`);
  }
  return { traces: parsed.traces };
}

/* ---------------------------------------------------------------- linking */

/** A registry key compared however it is spelled: HKEY_LOCAL_MACHINE or HKLM:,
 * any case, any run of slashes, no trailing one. The same rule the screen
 * links by (frontend/src/lib/installTraces.js). */
export const canonicalKey = (key) => String(key || '')
  .toLowerCase()
  .replace(/^hkey_local_machine/, 'hklm').replace(/^hkey_current_user/, 'hkcu')
  .replace(/^(hklm|hkcu):/, '$1')
  .replace(/[\\/]+/g, '\\')
  .replace(/\\+$/, '');

/** HKLM:\X -> HKEY_LOCAL_MACHINE\X, the spelling a trace's own key uses. */
const toHiveSpelling = (psKey) => psKey.replace(/^HKLM:\\/i, 'HKEY_LOCAL_MACHINE\\').replace(/^HKCU:\\/i, 'HKEY_CURRENT_USER\\');

const sameText = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** Links a trace to one of this PC's programs. Returns { trace, installed }:
 * installed is null for a trace that names no program (a portable install),
 * true when a program here is the one it recorded, false when none is. A trace
 * matched by name gets that program's key, in its own entry and wherever its
 * registry list named the old one; nothing else in it changes. */
export function relinkTrace(trace, programs) {
  if (!trace.program) return { trace, installed: null };
  const wanted = canonicalKey(trace.program.registryKey || trace.program.key);
  const keyed = programs.filter((program) => program?.registryKey);
  if (keyed.some((program) => canonicalKey(program.registryKey) === wanted)) return { trace, installed: true };

  let matches = keyed.filter((program) => sameText(program.name, trace.program.name));
  if (matches.length > 1 && trace.program.publisher) matches = matches.filter((program) => sameText(program.publisher, trace.program.publisher));
  if (matches.length !== 1 || !isPsRegistryPath(matches[0].registryKey)) return { trace, installed: false };

  const registryKey = matches[0].registryKey;
  const key = toHiveSpelling(registryKey);
  const oldKey = canonicalKey(trace.program.key);
  return {
    installed: true,
    trace: {
      ...trace,
      program: { ...trace.program, registryKey, key },
      registry: trace.registry.map((entry) => (entry.valueName === undefined && canonicalKey(entry.path) === oldKey ? { path: key } : entry))
    }
  };
}

/* ------------------------------------------------------------- duplicates */

/** What makes two traces the same install: the program (name, publisher,
 * version) and what it recorded, in any order and any case. Not the id, not
 * when it was recorded, and not the program's own key -- linking rewrites
 * that, and a backup imported on a second PC must still match itself. */
export function traceFingerprint(trace) {
  const programKey = canonicalKey(trace.program?.key);
  const lower = (value) => String(value ?? '').toLowerCase();
  const sorted = (items) => [...items].sort();
  const content = {
    program: trace.program ? [lower(trace.program.name).trim(), lower(trace.program.publisher).trim(), lower(trace.program.version).trim()] : null,
    files: sorted((trace.files || []).map((f) => `${lower(f.path)}|${f.isDirectory ? 'd' : 'f'}`)),
    registry: sorted((trace.registry || [])
      .filter((r) => !(r.valueName === undefined && programKey && canonicalKey(r.path) === programKey))
      .map((r) => `${canonicalKey(r.path)}|${r.valueName === undefined ? '' : lower(r.valueName)}`)),
    services: sorted((trace.services || []).map((s) => lower(s.name))),
    tasks: sorted((trace.tasks || []).map((t) => `${lower(t.path)}${lower(t.name)}`))
  };
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/* --------------------------------------------------------- export, import */

async function storedTraces(root) {
  if (!existsSync(root)) return [];
  const traces = [];
  for (const name of await readdir(root)) {
    const match = /^([a-f0-9]{16})\.json$/.exec(name);
    if (!match) continue;
    const trace = await getTrace(match[1], { root });
    if (trace) traces.push(trace);
  }
  return traces.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** The file for one trace (`id`) or for all of them. Each goes through the
 * same sanitizeTrace an import does, so what is written is exactly what can
 * be read back; one that would not pass is left out rather than exported
 * broken. Null for an id that names no trace. */
export async function buildTraceFile({ id, root = installTraceRoot(), now = Date.now, version = appVersion } = {}) {
  let traces;
  if (id !== undefined) {
    const one = isTraceId(id) ? await getTrace(id, { root }) : null;
    if (!one) return null;
    traces = [one];
  } else {
    traces = await storedTraces(root);
  }
  return {
    format: TRACE_FILE_FORMAT,
    version: TRACE_FILE_VERSION,
    exportedAt: new Date(now()).toISOString(),
    pruneVersion: version(),
    traces: traces.map(sanitizeTrace).filter(Boolean)
  };
}

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

/** Reads a file's text and saves every trace in it that passes and is not
 * already here. Resolves { imported, skipped, rejected, notInstalled }:
 * notInstalled is how many of the imported ones name a program this PC does
 * not have (null when the program list could not be read). Throws a
 * TraceFileError for a file that is not one at all.
 *
 * The backend runs inside Electron's main process, so the work gives the
 * event loop a turn between traces rather than holding it for the whole file. */
export async function importTraceFile(content, {
  root = installTraceRoot(),
  listPrograms = listInstalledPrograms,
  now = Date.now,
  save = saveTrace
} = {}) {
  const { traces } = parseTraceFile(content);
  const programs = await Promise.resolve().then(listPrograms).then((rows) => (Array.isArray(rows) ? rows : null)).catch(() => null);
  const seen = new Set((await storedTraces(root)).map((trace) => sanitizeTrace(trace)).filter(Boolean).map(traceFingerprint));

  const summary = { imported: 0, skipped: 0, rejected: 0, notInstalled: programs ? 0 : null };
  for (const raw of traces) {
    await nextTurn();
    const clean = sanitizeTrace(raw);
    if (!clean) { summary.rejected += 1; continue; }
    const fingerprint = traceFingerprint(clean);
    if (seen.has(fingerprint)) { summary.skipped += 1; continue; }
    seen.add(fingerprint);

    const { trace, installed } = programs ? relinkTrace(clean, programs) : { trace: clean, installed: null };
    let id = newTraceId();
    while (existsSync(join(root, `${id}.json`))) id = newTraceId();
    await save({ id, ...trace, importedAt: now() }, { root });
    summary.imported += 1;
    if (installed === false) summary.notInstalled += 1;
  }
  return summary;
}
