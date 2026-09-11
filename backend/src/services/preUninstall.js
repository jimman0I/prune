import { mkdir, rm, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { quarantineRoot } from './quarantine.js';
import { tryCreateRestorePoint } from './restorePoint.js';

const execFileAsync = promisify(execFile);

/** What runs before a program's own uninstaller: Revo's "Create a System
 * Restore Point before uninstall" and "Create a full Registry Backup
 * before uninstall". Both are off unless the user turns them on.
 *
 * They fail differently, on purpose. A restore point needs admin and
 * Windows allows one a day, so it fails routinely; stopping the uninstall
 * over it would make the option useless for anyone running Prune
 * normally. A registry backup is what the user asked to have before
 * anything changes, so when it cannot be made the uninstall does not run.
 */

/* Measured on the dev machine (2026-09-11): HKLM\SOFTWARE exported in 0.9s
 * to 11 MB, HKCU\Software in 1.5s to 130 MB. Between them they hold every
 * uninstall entry and every program's own settings, which is what an
 * uninstaller changes. */
export const REGISTRY_BACKUP_KEYS = ['HKLM\\SOFTWARE', 'HKCU\\Software'];

/** About 140 MB each, so a handful, not a history. The newest three cover
 * "the last thing I uninstalled broke something" without a folder that
 * grows by a gigabyte a week. */
export const KEEP_BACKUPS = 3;

/** Beside the quarantine, under the same app-data root, so an app upgrade
 * never touches it -- see electron/main.cjs. */
export function registryBackupRoot() {
  return join(dirname(quarantineRoot()), 'registry-backups');
}

function safeSegment(text) {
  return String(text).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'unknown';
}

async function regExport(key, file) {
  await execFileAsync('reg', ['export', key, file, '/y'], { windowsHide: true });
}

/** Removes all but the newest KEEP_BACKUPS backup folders. Only folders
 * this code names -- "<timestamp>-<program>" -- are ever considered, and
 * the one just made is never among the ones removed. */
async function pruneOldBackups(root, justMade) {
  const backups = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d+-/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]));
  const doomed = backups.slice(KEEP_BACKUPS).filter((name) => name !== justMade);
  for (const name of doomed) await rm(join(root, name), { recursive: true, force: true });
  return doomed;
}

/** Exports REGISTRY_BACKUP_KEYS into a new folder. Reports rather than
 * throws; a backup that failed halfway is removed, because a folder that
 * looks like a backup and holds half of one is worse than none. */
export async function createRegistryBackup({ programName, root = registryBackupRoot(), exportKey = regExport, now = Date.now }) {
  const name = `${now()}-${safeSegment(programName)}`;
  const dir = join(root, name);
  try {
    await mkdir(dir, { recursive: true });
    let sizeBytes = 0;
    for (const [i, key] of REGISTRY_BACKUP_KEYS.entries()) {
      const file = join(dir, `${i + 1}-${key.replace(/\\/g, '_')}.reg`);
      await exportKey(key, file);
      sizeBytes += (await stat(file)).size;
    }
    const pruned = await pruneOldBackups(root, name);
    return { ok: true, dir, sizeBytes, pruned };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    return { ok: false, error: err.message };
  }
}

/** Runs whichever steps are turned on, reporting each through onEvent.
 * Only an explicit true turns a step on. Returns whether the uninstall may
 * go ahead, and why not when it may not. */
export async function runPreUninstall({
  programName,
  settings,
  onEvent = () => {},
  restorePoint = tryCreateRestorePoint,
  registryBackup = createRegistryBackup
}) {
  if (settings?.restorePointBeforeUninstall === true) {
    onEvent('preUninstall', { step: 'restorePoint' });
    onEvent('restorePoint', await restorePoint(`Prune: before uninstalling ${programName}`));
  }

  if (settings?.registryBackupBeforeUninstall === true) {
    onEvent('preUninstall', { step: 'registryBackup' });
    const backup = await registryBackup({ programName });
    onEvent('registryBackup', backup);
    if (!backup?.ok) {
      return {
        proceed: false,
        reason: `The registry backup failed, so the uninstall did not run: ${backup?.error || 'no reason given'}`
      };
    }
  }

  return { proceed: true };
}
