import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { quarantineRoot } from './quarantine.js';
import { runPowerShellJson } from './powershell.js';
import { psQuote } from './leftoverPattern.js';
import { measureDirectory } from './leftoverWalk.js';

/** What the install monitor recorded, one JSON file per install:
 * userData/install-traces/<id>.json, beside the quarantine so an upgrade
 * never touches it. A trace is linked to the program whose Add/Remove entry
 * the installer created; when that program is uninstalled later, what the
 * trace lists that is still on the machine comes back as certain leftovers.
 *
 * The id is random hex and nothing else is accepted: it becomes a file name,
 * and it arrives in a URL. */
export function installTraceRoot() {
  return join(dirname(quarantineRoot()), 'install-traces');
}

export function newTraceId() {
  return randomBytes(8).toString('hex');
}

export function isTraceId(value) {
  return typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
}

export async function saveTrace(trace, { root = installTraceRoot() } = {}) {
  if (!isTraceId(trace?.id)) throw new Error('A trace needs a valid id.');
  await mkdir(root, { recursive: true });
  // Written beside the real file and renamed over it, so a crash never leaves
  // a half-written trace that parses as nothing.
  const target = join(root, `${trace.id}.json`);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(trace), 'utf8');
  await rename(temp, target);
  return trace;
}

export async function getTrace(id, { root = installTraceRoot() } = {}) {
  if (!isTraceId(id)) return null;
  try {
    return JSON.parse(await readFile(join(root, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/** One line per trace, without the file lists. */
export async function listTraces({ root = installTraceRoot() } = {}) {
  if (!existsSync(root)) return [];
  const summaries = [];
  for (const name of await readdir(root)) {
    const match = /^([a-f0-9]{16})\.json$/.exec(name);
    if (!match) continue;
    const trace = await getTrace(match[1], { root });
    if (!trace) continue;
    summaries.push({
      id: trace.id,
      createdAt: trace.createdAt,
      installer: trace.installer,
      programName: trace.program?.name ?? null,
      publisher: trace.program?.publisher ?? null,
      version: trace.program?.version ?? null,
      registryKey: trace.program?.registryKey ?? null,
      alsoInstalled: trace.alsoInstalled ?? [],
      fileCount: trace.files?.length ?? 0,
      registryCount: trace.registry?.length ?? 0,
      taskCount: trace.tasks?.length ?? 0,
      serviceCount: trace.services?.length ?? 0,
      partial: trace.partial === true
    });
  }
  return summaries.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteTrace(id, { root = installTraceRoot() } = {}) {
  if (!isTraceId(id)) return false;
  const file = join(root, `${id}.json`);
  if (!existsSync(file)) return false;
  await rm(file, { force: true });
  return true;
}

/** Checks the registry keys and scheduled tasks a trace lists, in one call.
 * Registry paths are the HKEY_... spelling the scans use; the provider needs
 * a `Registry::` prefix. The list travels as JSON, never as script text. */
function buildVerifyScript(registry, tasks) {
  const payload = psQuote(JSON.stringify({
    registry: registry.map(({ path, valueName }) => ({ path, valueName: valueName ?? null })),
    tasks: tasks.map(({ name, path }) => ({ name, path }))
  }));
  return `
$ErrorActionPreference = 'SilentlyContinue'
$wanted = '${payload}' | ConvertFrom-Json
$registry = New-Object System.Collections.ArrayList
foreach ($item in @($wanted.registry)) {
  $key = Get-Item -LiteralPath ('Registry::' + $item.path)
  if (-not $key) { continue }
  if ($item.valueName) {
    if ($null -eq $key.GetValue($item.valueName)) { continue }
    [void]$registry.Add([pscustomobject]@{ path = $item.path; valueName = $item.valueName })
  } else {
    [void]$registry.Add([pscustomobject]@{ path = $item.path })
  }
}
$tasks = New-Object System.Collections.ArrayList
foreach ($item in @($wanted.tasks)) {
  if (Get-ScheduledTask -TaskName $item.name -TaskPath $item.path) { [void]$tasks.Add([pscustomobject]@{ name = $item.name; path = $item.path }) }
}
[pscustomobject]@{ registry = @($registry); tasks = @($tasks) } | ConvertTo-Json -Compress -Depth 4
`;
}

export { buildVerifyScript };

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/** What a trace lists that is still there. The files are checked on disk, the
 * registry keys and tasks with one PowerShell call (skipped when there are
 * none). A failed check loses the registry and task findings, never the
 * files. */
export async function loadTraceFindings(trace, { runPs = (script) => runPowerShellJson(script, { timeoutMs: 60000, retries: 0 }) } = {}) {
  const empty = { files: [], registry: [], tasks: [], services: [] };
  if (!trace) return empty;

  const files = [];
  for (const entry of trace.files || []) {
    if (typeof entry?.path !== 'string' || !existsSync(entry.path)) continue;
    const sizeBytes = entry.isDirectory ? await measureDirectory(entry.path) : (entry.sizeBytes ?? 0);
    files.push({ path: entry.path, sizeBytes });
  }

  let registry = [];
  let tasks = [];
  const wantedRegistry = (trace.registry || []).filter((r) => typeof r?.path === 'string');
  const wantedTasks = (trace.tasks || []).filter((t) => typeof t?.name === 'string' && typeof t?.path === 'string');
  if (wantedRegistry.length > 0 || wantedTasks.length > 0) {
    try {
      const raw = await runPs(buildVerifyScript(wantedRegistry, wantedTasks));
      registry = asArray(raw?.registry);
      tasks = asArray(raw?.tasks);
    } catch {
      // The files are still worth returning.
    }
  }

  const services = (trace.services || []).map((s) => ({ name: s.name, displayName: s.displayName || s.name, pathName: s.pathName }));
  return { files, registry, tasks, services };
}
