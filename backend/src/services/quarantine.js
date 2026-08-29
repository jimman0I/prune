import { mkdir, rename, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Root directory quarantine operations write into. A function, not a
 * constant — read at call time, not import time — so tests can point it
 * at a scratch temp dir via UNREVO_QUARANTINE_ROOT without touching the
 * real %LOCALAPPDATA%\unrevo\quarantine on the dev machine. Same
 * env-var-override pattern Re:Route's REROUTE_DATA_DIR uses. */
export function quarantineRoot() {
  return process.env.UNREVO_QUARANTINE_ROOT
    || join(process.env.LOCALAPPDATA || process.cwd(), 'unrevo', 'quarantine');
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
    const dest = join(batchDir, `file-${movedFiles.length}-${basename(filePath)}`);
    await rename(filePath, dest);
    movedFiles.push({ originalPath: filePath, quarantinedPath: dest });
  }

  const exportedKeys = [];
  const regFiles = [];
  for (const keyPath of registryKeys) {
    const regFilePath = join(batchDir, `registry-${regFiles.length}.reg`);
    try {
      await execFileAsync('reg', ['export', toRegExeKeyPath(keyPath), regFilePath, '/y']);
      await execFileAsync('reg', ['delete', toRegExeKeyPath(keyPath), '/f']);
      exportedKeys.push(keyPath);
      regFiles.push(regFilePath);
    } catch {
      // skipped — see doc comment above
    }
  }

  const manifest = {
    programName, createdAt: Date.now(), batchDir,
    files: movedFiles, registryKeys: exportedKeys, regFiles
  };
  await writeFile(join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

/** Reverses one quarantine batch: moves every file back to its original
 * path and re-imports every one of the batch's `.reg` backups. Reads the
 * manifest written by quarantineAndDelete rather than taking a file list
 * as a caller-supplied argument, so a restore always operates on exactly
 * what was actually quarantined. */
export async function restoreQuarantine(batchDir) {
  const manifestPath = join(batchDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  for (const { originalPath, quarantinedPath } of manifest.files) {
    if (existsSync(quarantinedPath)) await rename(quarantinedPath, originalPath);
  }
  for (const regFilePath of manifest.regFiles ?? []) {
    if (existsSync(regFilePath)) await execFileAsync('reg', ['import', regFilePath]);
  }
  return manifest;
}
