import { mkdir, rename, readFile, writeFile, stat, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isProtectedKey } from './registryLeftovers.js';

const execFileAsync = promisify(execFile);

/** Root directory quarantine operations write into. A function, not a
 * constant — read at call time, not import time — so tests can point it
 * at a scratch temp dir via UNREVO_QUARANTINE_ROOT without touching the
 * real %LOCALAPPDATA%\Prune\quarantine on the dev machine. Same
 * env-var-override pattern Re:Route's REROUTE_DATA_DIR uses. Packaged
 * mode never hits this fallback -- electron/main.cjs sets
 * UNREVO_QUARANTINE_ROOT from app.getPath('userData') instead, which
 * resolves to %APPDATA%\Prune since the "unrevo" -> "Prune" rebrand. */
export function quarantineRoot() {
  return process.env.UNREVO_QUARANTINE_ROOT
    || join(process.env.LOCALAPPDATA || process.cwd(), 'Prune', 'quarantine');
}

function safeSegment(text) {
  return text.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'unknown';
}

/** `HKCU:\Software\Foo` (PowerShell provider syntax) -> `HKCU\Software\Foo`
 * (reg.exe syntax) — the two tools disagree on both the drive-colon and
 * path-separator convention for the registry root. */
function toRegExeKeyPath(psPath) {
  return psPath.replace(/^HKCU:\\?/i, 'HKCU\\').replace(/^HKLM:\\?/i, 'HKLM\\');
}

/** A registry target, however the caller spelled it.
 *
 * A leftover is usually a whole key, and callers have always passed those
 * as a bare string. A startup entry is not: Run and RunOnce are keys that
 * every program starting with Windows shares, so those leftovers name one
 * value inside a key, `{ path, valueName }`, and only that value comes
 * out. Both spellings are accepted so the older callers keep working
 * unchanged and the manifest keeps recording exactly what it was asked
 * for. */
function toRegistryTarget(entry) {
  if (typeof entry === 'string') return { path: entry, valueName: null };
  return { path: entry?.path, valueName: entry?.valueName || null };
}

/** Creates one quarantine batch: moves every listed file into it (atomic
 * rename, not copy-then-delete — no window where a file exists in both
 * places), exports every listed registry key BEFORE deleting any of them.
 *
 * Real bug, found dogfooding (2026-08-29): this originally tried to export
 * to `-` and capture stdout, on the (wrong) assumption `reg.exe` supports
 * the Unix "-" convention for stdout output. It doesn't — `reg export`
 * requires a real disk FileName (confirmed via `reg export /?`: "FileName
 * The name of the disk file to export"); passing `-` just creates a
 * literal file named `-` in the current directory, while stdout captures
 * only "The operation completed successfully." — confirmed live, this
 * produced a real, reproducible test failure (`regContent` was the success
 * message, not the exported key). Fixed by exporting each key to its OWN
 * real file in the batch dir instead of trying to combine them into one —
 * simpler than concatenating raw `.reg` exports would have been anyway
 * (each has its own `Windows Registry Editor Version 5.00` header; naively
 * joining them would produce an invalid combined file). Restoring means
 * re-importing each of a batch's `.reg` files, not double-clicking one.
 *
 * A key that fails to export/delete (already gone, access denied) is
 * skipped rather than aborting the whole batch — same
 * partial-results-over-total-failure philosophy as the leftover scanner. */
export async function quarantineAndDelete({ programName, files, registryKeys }) {
  const batchDir = join(quarantineRoot(), `${Date.now()}-${safeSegment(programName)}`);
  await mkdir(batchDir, { recursive: true });

  const movedFiles = [];
  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    // Stat BEFORE the rename -- same file either side of a same-volume move
    // (rename never changes size), but stat-ing after would be one more
    // opportunity to race a file that vanishes between the two calls.
    const sizeBytes = (await stat(filePath)).size;
    const dest = join(batchDir, `file-${movedFiles.length}-${basename(filePath)}`);
    await rename(filePath, dest);
    movedFiles.push({ originalPath: filePath, quarantinedPath: dest, sizeBytes });
  }

  const exportedKeys = [];
  const failedKeys = [];
  const regFiles = [];
  for (const entry of registryKeys) {
    const { path: keyPath, valueName } = toRegistryTarget(entry);
    // Before reg.exe is touched at all. The scanner already refuses to
    // offer these, so a protected key arriving here means the list was
    // built some other way -- a stale scan result, a hand-made request to
    // the route -- and this is the last thing between that and a machine
    // that no longer boots. Running unelevated is not the protection it
    // looks like: Prune can relaunch itself elevated, and then
    // `reg delete HKLM\Software\Microsoft /f` would simply succeed.
    if (!valueName && isProtectedKey(keyPath)) {
      failedKeys.push(entry);
      continue;
    }

    const regFilePath = join(batchDir, `registry-${regFiles.length}.reg`);
    try {
      // The export is always of the whole key, even when only one value is
      // being removed: `reg export` has no per-value form, and re-importing
      // the key is what puts the value back. Import merges rather than
      // replaces, so restoring one of these cannot clobber a value some
      // other program has added to the same key since.
      await execFileAsync('reg', ['export', toRegExeKeyPath(keyPath), regFilePath, '/y']);
      await execFileAsync('reg', valueName
        ? ['delete', toRegExeKeyPath(keyPath), '/v', valueName, '/f']
        : ['delete', toRegExeKeyPath(keyPath), '/f']);
      exportedKeys.push(entry);
      regFiles.push(regFilePath);
    } catch {
      // Still skipped rather than thrown — one unremovable key must not
      // abort the batch — but RECORDED, not swallowed. HKLM keys need
      // admin and quietly fail without it, so a caller that only reads
      // `registryKeys` would report a clean removal while the entry is
      // still there. Callers can now say which ones didn't go.
      failedKeys.push(entry);
    }
  }

  const manifest = {
    programName, createdAt: Date.now(), batchDir,
    files: movedFiles, registryKeys: exportedKeys, failedRegistryKeys: failedKeys, regFiles,
    totalSizeBytes: movedFiles.reduce((sum, f) => sum + f.sizeBytes, 0)
  };
  await writeFile(join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

/** Reverses one quarantine batch: moves every file back to its original
 * path and re-imports every one of the batch's `.reg` backups. Reads the
 * manifest written by quarantineAndDelete rather than taking a file list
 * as a caller-supplied argument, so a restore always operates on exactly
 * what was actually quarantined.
 *
 * Real bug, found dogfooding Phase 4 (2026-09-01): this used to leave the
 * batch directory (and its manifest.json) sitting under quarantineRoot()
 * after a successful restore -- nothing was actually left IN it (every
 * file/key was moved/re-imported out), but GET /api/quarantine still
 * listed it forever afterward, since it only reads whatever manifest.json
 * files exist on disk. Confirmed live: restoring a real batch through the
 * UI, the batch never left the Quarantine screen -- indistinguishable from
 * "Restore did nothing" even though the file WAS back. Once every file/key
 * is out, there is nothing left to restore a second time (same
 * "successfully restored" contract deletePermanently already has for
 * "successfully deleted") -- so this now removes the now-empty batch
 * directory before returning, same as deletePermanently's own cleanup. */
/** Every quarantine batch, newest first.
 *
 * Lifted out of the route it used to live inside when the retention purge
 * needed the same list. It is real logic, not plumbing: a batch is a
 * directory holding a manifest, a directory without one is not a batch,
 * and a manifest that will not parse is skipped rather than failing the
 * whole listing -- one corrupted file must not hide the other nine
 * batches the user might want to restore. */
export async function listQuarantineBatches() {
  const root = quarantineRoot();
  if (!existsSync(root)) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const batches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(root, entry.name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      batches.push(JSON.parse(await readFile(manifestPath, 'utf8')));
    } catch { /* skip a corrupted manifest rather than failing the whole list */ }
  }

  batches.sort((a, b) => b.createdAt - a.createdAt);
  return batches;
}

export async function restoreQuarantine(batchDir) {
  const manifestPath = join(batchDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  for (const { originalPath, quarantinedPath } of manifest.files) {
    if (existsSync(quarantinedPath)) await rename(quarantinedPath, originalPath);
  }
  for (const regFilePath of manifest.regFiles ?? []) {
    if (existsSync(regFilePath)) await execFileAsync('reg', ['import', regFilePath]);
  }
  await rm(batchDir, { recursive: true, force: true });
  return manifest;
}

/** Really, permanently deletes one quarantine batch -- the quarantined file
 * copies, the .reg backups, and the manifest itself, all gone. This is NOT
 * another quarantine step; there is nothing left to restore afterward.
 * Reads totalSizeBytes from the manifest for the freedBytes it reports
 * rather than re-stat-ing every file on the way out, matching
 * quarantineAndDelete's own "compute once, trust it" convention. A batch
 * that's already gone (bad batchDir, already deleted) returns
 * `{ deleted: false, freedBytes: 0 }` rather than throwing -- same
 * partial-results-over-total-failure philosophy the rest of this file
 * already uses. */
export async function deletePermanently(batchDir) {
  const manifestPath = join(batchDir, 'manifest.json');
  if (!existsSync(manifestPath)) return { deleted: false, freedBytes: 0 };
  let freedBytes = 0;
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    freedBytes = manifest.totalSizeBytes ?? 0;
  } catch {
    // A corrupted manifest still gets its directory removed below --
    // freedBytes just can't be reported accurately for it.
  }
  await rm(batchDir, { recursive: true, force: true });
  return { deleted: true, freedBytes };
}

/** Permanently deletes EVERY batch currently under quarantineRoot() --
 * deletePermanently applied to the whole quarantine folder at once. Missing
 * quarantineRoot() itself (nothing has ever been quarantined) is the same
 * as an empty one: zero batches, zero bytes, no error. */
export async function emptyQuarantine() {
  const root = quarantineRoot();
  if (!existsSync(root)) return { deletedCount: 0, freedBytes: 0 };
  const entries = await readdir(root, { withFileTypes: true });
  let deletedCount = 0;
  let freedBytes = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const result = await deletePermanently(join(root, entry.name));
    if (result.deleted) {
      deletedCount++;
      freedBytes += result.freedBytes;
    }
  }
  return { deletedCount, freedBytes };
}
