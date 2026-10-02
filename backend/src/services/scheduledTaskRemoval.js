import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { runPowerShellJson } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';
import { quarantineRoot } from './quarantine.js';
import { psQuote } from './leftoverPattern.js';

/** Removing a program's scheduled tasks, and putting them back.
 *
 * A scheduled task has no Recycle Bin, so the rule is the registry's: its
 * definition is exported to a file BEFORE it is unregistered, and the file
 * is what the Backup Manager restores from. The script checks the file is
 * on disk and non-empty before it unregisters anything, so a task is never
 * removed without a copy.
 *
 * Tasks Windows ships and schedules for itself (\Microsoft\Windows\...) are
 * refused here as well as in the scan.
 *
 * Tasks a standard user cannot touch -- registered by an administrator or by
 * SYSTEM, which is how most updaters install themselves -- are retried in ONE
 * elevated pass, a single UAC prompt for the whole batch. It only ever runs
 * as part of a removal the person just confirmed. */

/** Beside the quarantine, under the same app-data root, so an upgrade never
 * touches it -- the same placement preUninstall.js gives the registry backups. */
export function taskBackupRoot() {
  return join(dirname(quarantineRoot()), 'task-backups');
}

function safeSegment(text) {
  return String(text).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'unknown';
}

/** Why this task must not be removed, or null. */
export function taskRefusal(task) {
  const name = task?.name;
  const path = task?.path;
  if (typeof name !== 'string' || name === '' || name.length > 260 || /[\u0000-\u001f]/.test(name)) {
    return 'That is not a task name.';
  }
  if (typeof path !== 'string' || !path.startsWith('\\') || path.length > 260 || /[\u0000-\u001f]/.test(path)) {
    return 'That is not a task path.';
  }
  if (/^\\microsoft\\windows(\\|$)/i.test(path)) return 'That task belongs to Windows.';
  return null;
}

/** The script that exports-then-removes ('remove') or re-registers
 * ('restore') a list of tasks. The list travels as JSON in a single-quoted
 * literal and is read back with ConvertFrom-Json, so a task called
 * `Bob's "sync"` is data and never syntax. The last thing it prints is one
 * JSON array, one entry per task, which is also what the elevated wrapper
 * writes back to its caller. */
export function buildTaskScript(items, mode) {
  const json = psQuote(JSON.stringify(items.map(({ name, path, file }) => ({ name, path, file }))));
  const body = mode === 'restore'
    ? `
    $xml = [System.IO.File]::ReadAllText($item.file)
    Register-ScheduledTask -Xml $xml -TaskName $item.name -TaskPath $item.path -Force -ErrorAction Stop | Out-Null
    $r.restored = $true`
    : `
    $xml = Export-ScheduledTask -TaskName $item.name -TaskPath $item.path -ErrorAction Stop
    [System.IO.File]::WriteAllText($item.file, [string]$xml, [System.Text.Encoding]::Unicode)
    if ((Get-Item -LiteralPath $item.file).Length -lt 20) { throw 'The task definition could not be saved.' }
    $r.exported = $true
    Unregister-ScheduledTask -TaskName $item.name -TaskPath $item.path -Confirm:$false -ErrorAction Stop
    $r.removed = $true`;
  const flags = mode === 'restore' ? 'restored = $false' : 'exported = $false; removed = $false';
  return `
$ErrorActionPreference = 'Stop'
$items = @('${json}' | ConvertFrom-Json)
$results = New-Object System.Collections.ArrayList
foreach ($item in $items) {
  $r = [ordered]@{ name = $item.name; path = $item.path; ${flags}; denied = $false; error = $null }
  try {${body}
  } catch {
    $r.error = $_.Exception.Message
    $r.denied = ($_.Exception -is [System.UnauthorizedAccessException]) -or ($_.Exception.Message -match 'denied|0x80070005')
  }
  [void]$results.Add([pscustomobject]$r)
}
ConvertTo-Json -Compress -InputObject @($results)
`;
}

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

async function defaultRun(items, mode = 'remove') {
  return asArray(await runPowerShellJson(buildTaskScript(items, mode), { timeoutMs: 90000, retries: 0 }));
}

async function defaultRunElevated(items, mode = 'remove') {
  const result = await runElevatedPowerShellJson(buildTaskScript(items, mode));
  if (result.ok) return asArray(result.data);
  const error = new Error(result.cancelled ? 'The administrator prompt was declined.' : (result.error || 'The elevated step failed.'));
  error.cancelled = Boolean(result.cancelled);
  throw error;
}

/** Exports and unregisters each task. Reports rather than throws. */
export async function removeScheduledTasks({
  programName, tasks = [], root = taskBackupRoot(), run = defaultRun, runElevated = defaultRunElevated, now = Date.now
}) {
  const removed = [];
  const failed = [];
  const candidates = [];
  for (const task of tasks) {
    const refusal = taskRefusal(task);
    if (refusal) failed.push({ name: task?.name, path: task?.path, reason: refusal });
    else candidates.push({ name: task.name, path: task.path });
  }
  if (candidates.length === 0) return { removed, failed, backupDir: null, elevated: false };

  const backupDir = join(root, `${now()}-${safeSegment(programName)}`);
  await mkdir(backupDir, { recursive: true });
  const items = candidates.map((task, index) => ({ ...task, file: join(backupDir, `task-${index}.xml`) }));
  const byKey = new Map(items.map((item) => [`${item.name}\u0000${item.path}`, item]));
  const done = new Set();
  const keyOf = (r) => `${r.name}\u0000${r.path}`;

  const settle = (results, { final }) => {
    const denied = [];
    for (const r of results) {
      const item = byKey.get(keyOf(r));
      if (!item) continue;
      if (r.removed) { removed.push({ name: item.name, path: item.path }); done.add(keyOf(r)); continue; }
      if (r.denied && !final) { denied.push(item); continue; }
      failed.push({ name: item.name, path: item.path, reason: r.error || 'It could not be removed.' });
      done.add(keyOf(r));
    }
    return denied;
  };

  let denied = [];
  try {
    denied = settle(await run(items, 'remove'), { final: false });
  } catch (err) {
    for (const item of items) failed.push({ name: item.name, path: item.path, reason: err.message });
    done.add('*');
  }
  // A task the script never mentioned is not silently dropped.
  if (!done.has('*')) {
    for (const item of items) {
      if (!done.has(keyOf(item)) && !denied.includes(item)) {
        failed.push({ name: item.name, path: item.path, reason: 'It could not be removed.' });
      }
    }
  }

  let elevated = false;
  if (denied.length > 0) {
    elevated = true;
    try {
      settle(await runElevated(denied, 'remove'), { final: true });
      for (const item of denied) {
        if (!done.has(keyOf(item))) failed.push({ name: item.name, path: item.path, reason: 'It could not be removed.' });
      }
    } catch (err) {
      for (const item of denied) {
        failed.push({
          name: item.name, path: item.path,
          reason: err.cancelled ? 'Removing it needs administrator approval, which was declined.' : `Removing it needs administrator approval: ${err.message}`,
          ...(err.cancelled ? { cancelled: true } : {})
        });
      }
    }
  }

  // The manifest lists only the tasks whose definition really is on disk.
  const saved = [];
  for (const [index, item] of items.entries()) {
    const info = await stat(item.file).catch(() => null);
    if (info && info.size > 0) saved.push({ name: item.name, path: item.path, file: `task-${index}.xml` });
  }
  if (saved.length === 0) {
    await rm(backupDir, { recursive: true, force: true });
    return { removed, failed, backupDir: null, elevated };
  }
  await writeFile(join(backupDir, 'backup.json'), JSON.stringify({
    kind: 'scheduled-task', programName, createdAt: now(), tasks: saved
  }, null, 2), 'utf8');
  return { removed, failed, backupDir, elevated };
}

/** Re-registers the tasks saved in one backup folder. The folder is read for
 * the list; each file named in it must lie inside the folder, so a manifest
 * cannot point the restore at some other file on the machine. */
export async function restoreScheduledTask(dir, { run = defaultRun, runElevated = defaultRunElevated } = {}) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, 'backup.json'), 'utf8'));
  } catch {
    throw new Error('That backup has no readable list of scheduled tasks.');
  }
  if (manifest?.kind !== 'scheduled-task' || !Array.isArray(manifest.tasks)) {
    throw new Error('That backup does not hold scheduled tasks.');
  }

  const restored = [];
  const failed = [];
  const items = [];
  const base = resolve(dir) + sep;
  for (const task of manifest.tasks) {
    const file = typeof task?.file === 'string' ? resolve(dir, task.file) : null;
    if (taskRefusal(task) || !file || !file.startsWith(base)) {
      failed.push({ name: task?.name, path: task?.path, reason: 'The backup entry is not valid.' });
      continue;
    }
    items.push({ name: task.name, path: task.path, file });
  }
  if (items.length === 0) return { restored, failed, elevated: false };

  const key = (r) => `${r.name}\u0000${r.path}`;
  const byKey = new Map(items.map((item) => [key(item), item]));
  let denied = [];
  try {
    for (const r of await run(items, 'restore')) {
      const item = byKey.get(key(r));
      if (!item) continue;
      if (r.restored) restored.push({ name: item.name, path: item.path });
      else if (r.denied) denied.push(item);
      else failed.push({ name: item.name, path: item.path, reason: r.error || 'It could not be restored.' });
    }
  } catch (err) {
    for (const item of items) failed.push({ name: item.name, path: item.path, reason: err.message });
    return { restored, failed, elevated: false };
  }

  let elevated = false;
  if (denied.length > 0) {
    elevated = true;
    try {
      for (const r of await runElevated(denied, 'restore')) {
        const item = byKey.get(key(r));
        if (!item) continue;
        if (r.restored) restored.push({ name: item.name, path: item.path });
        else failed.push({ name: item.name, path: item.path, reason: r.error || 'It could not be restored.' });
      }
    } catch (err) {
      for (const item of denied) {
        failed.push({
          name: item.name, path: item.path,
          reason: err.cancelled ? 'Restoring it needs administrator approval, which was declined.' : `Restoring it needs administrator approval: ${err.message}`,
          ...(err.cancelled ? { cancelled: true } : {})
        });
      }
    }
  }
  return { restored, failed, elevated };
}
