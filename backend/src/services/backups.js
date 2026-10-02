import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, basename } from 'node:path';
import { registryBackupRoot } from './preUninstall.js';
import { taskBackupRoot, restoreScheduledTask } from './scheduledTaskRemoval.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';
import { psQuote } from './leftoverPattern.js';

const execFileAsync = promisify(execFile);

/** The Backup Manager's engine: everything Prune saved before it changed
 * something that has no Recycle Bin -- full registry exports made before an
 * uninstall (preUninstall.js) and the definitions of scheduled tasks it
 * removed (scheduledTaskRemoval.js). Quarantine batches are their own screen.
 *
 * A backup is a folder, named <timestamp>-<program>, under one of two roots.
 * It is addressed as `registry:<folder>` or `task:<folder>`; the id is parsed
 * strictly, because it arrives in a URL and becomes a path. */

const KINDS = { registry: 'registry', task: 'scheduled-task' };
const FOLDER = /^\d+-[A-Za-z0-9._-]*$/;

function rootFor(kind) {
  return kind === 'registry' ? registryBackupRoot() : taskBackupRoot();
}

/** { kind, name, dir } for a well-formed id, otherwise null. */
export function parseBackupId(id) {
  if (typeof id !== 'string') return null;
  const match = /^(registry|task):(.+)$/.exec(id);
  if (!match || !FOLDER.test(match[2])) return null;
  return { prefix: match[1], kind: KINDS[match[1]], name: match[2], dir: join(rootFor(match[1]), match[2]) };
}

async function readManifest(dir) {
  try { return JSON.parse(await readFile(join(dir, 'backup.json'), 'utf8')); } catch { return null; }
}

async function folderSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    // What was saved, not the small manifest beside it.
    if (!entry.isFile() || !/\.(reg|xml)$/i.test(entry.name)) continue;
    total += (await stat(join(dir, entry.name)).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

async function describe(prefix, name) {
  const dir = join(rootFor(prefix), name);
  const manifest = await readManifest(dir);
  const timestamp = Number(name.split('-')[0]);
  const base = { id: `${prefix}:${name}`, kind: KINDS[prefix], sizeBytes: await folderSize(dir) };

  if (prefix === 'task') {
    if (!manifest || manifest.kind !== 'scheduled-task') return null;
    const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : [];
    return {
      ...base, programName: manifest.programName || name.replace(/^\d+-/, ''), createdAt: manifest.createdAt || timestamp,
      itemCount: tasks.length, items: tasks.map((t) => `${t.path}${t.name}`)
    };
  }

  // A registry backup. Older ones have no manifest: the folder name carries
  // the date and the program, and the .reg files are what there is to restore.
  const files = (await readdir(dir).catch(() => [])).filter((f) => /\.reg$/i.test(f));
  if (files.length === 0) return null;
  return {
    ...base, programName: manifest?.programName || name.replace(/^\d+-/, ''), createdAt: manifest?.createdAt || timestamp,
    itemCount: files.length, items: files
  };
}

/** Every backup, newest first. */
export async function listBackups() {
  const found = [];
  for (const prefix of ['registry', 'task']) {
    const root = rootFor(prefix);
    if (!existsSync(root)) continue;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !FOLDER.test(entry.name)) continue;
      const backup = await describe(prefix, entry.name);
      if (backup) found.push(backup);
    }
  }
  return found.sort((a, b) => b.createdAt - a.createdAt);
}

async function defaultRunReg(file) {
  // A full export can be well over 100 MB; importing it takes a while.
  await execFileAsync('reg', ['import', file], { windowsHide: true, timeout: 10 * 60 * 1000 });
}

async function defaultRunElevatedReg(files) {
  const json = psQuote(JSON.stringify(files));
  const result = await runElevatedPowerShellJson(`
$files = @('${json}' | ConvertFrom-Json)
$out = foreach ($file in $files) {
  & reg.exe import $file 2>&1 | Out-Null
  [pscustomobject]@{ file = $file; ok = ($LASTEXITCODE -eq 0) }
}
ConvertTo-Json -Compress -InputObject @($out)
`, { timeoutMs: 10 * 60 * 1000 });
  if (result.ok) return Array.isArray(result.data) ? result.data : [result.data];
  const error = new Error(result.cancelled ? 'The administrator prompt was declined.' : (result.error || 'The elevated import failed.'));
  error.cancelled = Boolean(result.cancelled);
  throw error;
}

/** Puts a backup back. Registry exports are re-imported, which MERGES: keys
 * and values the backup holds are restored, and nothing added since is
 * removed. Machine-wide keys need administrator rights, so the files that
 * failed for lack of them are retried once, together, in one elevated pass. */
export async function restoreBackup(id, {
  runReg = defaultRunReg, runElevatedReg = defaultRunElevatedReg, restoreTasks = (dir) => restoreScheduledTask(dir)
} = {}) {
  const parsed = parseBackupId(id);
  if (!parsed || !existsSync(parsed.dir)) throw new Error('There is no such backup.');

  if (parsed.kind === 'scheduled-task') {
    const result = await restoreTasks(parsed.dir);
    return { kind: parsed.kind, restored: result.restored.length, failed: result.failed, elevated: result.elevated };
  }

  const files = (await readdir(parsed.dir)).filter((f) => /\.reg$/i.test(f)).sort();
  let restored = 0;
  const denied = [];
  for (const file of files) {
    try {
      await runReg(join(parsed.dir, file));
      restored += 1;
    } catch {
      denied.push(file);
    }
  }
  if (denied.length === 0) return { kind: parsed.kind, restored, failed: [], elevated: false };

  const failed = [];
  try {
    const results = await runElevatedReg(denied.map((f) => join(parsed.dir, f)));
    for (const file of denied) {
      const outcome = results.find((r) => basename(r.file) === file);
      if (outcome?.ok) restored += 1;
      else failed.push({ file, reason: 'The registry would not take it, even with administrator rights.' });
    }
  } catch (err) {
    for (const file of denied) {
      failed.push({
        file,
        reason: err.cancelled ? 'Restoring it needs administrator approval, which was declined.' : `Restoring it needs administrator approval: ${err.message}`,
        ...(err.cancelled ? { cancelled: true } : {})
      });
    }
  }
  return { kind: parsed.kind, restored, failed, elevated: true };
}

/** Deletes one backup folder for good. */
export async function deleteBackup(id) {
  const parsed = parseBackupId(id);
  if (!parsed || !existsSync(parsed.dir)) return { deleted: false, freedBytes: 0 };
  const freedBytes = await folderSize(parsed.dir);
  await rm(parsed.dir, { recursive: true, force: true });
  return { deleted: true, freedBytes };
}
