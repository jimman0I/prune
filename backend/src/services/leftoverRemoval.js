import { lstat, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quarantineAndDelete, quarantineRoot } from './quarantine.js';
import { sendToRecycleBin } from './recycleBin.js';
import { protectionReason } from './pathGuard.js';
import { shredPaths } from '../lib/shredFile.js';
import { removeScheduledTasks } from './scheduledTaskRemoval.js';
import { osComponentRefusal, buildFootprints, footprintRefusal } from './leftoverProtection.js';

/** Where an uninstall's leftover files go.
 *
 * Revo's "Delete files and folders: to the Backup folder / to the Recycle
 * Bin / Permanently", with Prune's Quarantine as the backup folder and the
 * default. The choice is about FILES. A registry key has no Recycle Bin,
 * so whichever destination is picked, keys go through quarantineAndDelete
 * -- exported to a .reg file, then deleted -- and can still be put back.
 *
 * The destination is passed in by the route, from the request, never read
 * from settings here: the dialog that shows the user where things will go
 * is the one that says so to the backend. */
export const DESTINATIONS = ['quarantine', 'recycle', 'permanent'];

// A location no real path is at or under, used to switch one of the
// Disk Map guard's rules off. See permanentDeletionRefusal.
const NOWHERE = '\u0000';

function norm(path) {
  return String(path).replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function defaultLocations() {
  const systemDrive = process.env.SystemDrive || 'C:';
  return {
    systemRoot: process.env.SystemRoot || process.env.windir || `${systemDrive}\\Windows`,
    programFiles: process.env.ProgramFiles || `${systemDrive}\\Program Files`,
    programFilesX86: process.env['ProgramFiles(x86)'] || `${systemDrive}\\Program Files (x86)`,
    programData: process.env.ProgramData || `${systemDrive}\\ProgramData`,
    usersRoot: `${systemDrive}\\Users`,
    quarantineRoot: quarantineRoot()
  };
}

/* Folders inside a user profile that belong to the user, not to any one
 * program. A program's leftovers live BELOW these -- AppData\Roaming\Vendor
 * -- and deleting one of these themselves would take every program's data,
 * or the user's documents, with it. Relative to the profile, lower-cased. */
const PROFILE_FOLDERS = new Set([
  'appdata', 'appdata\\local', 'appdata\\roaming', 'appdata\\locallow',
  'appdata\\local\\microsoft', 'appdata\\roaming\\microsoft',
  'appdata\\local\\programs', 'appdata\\local\\temp',
  'appdata\\roaming\\microsoft\\windows\\start menu',
  'appdata\\roaming\\microsoft\\windows\\start menu\\programs',
  'documents', 'desktop', 'downloads', 'pictures', 'music', 'videos',
  'favorites', 'onedrive', 'saved games', 'contacts', 'links', 'searches'
]);

/** Why a path must not be deleted outright, or null when it may be.
 *
 * Starts from the Disk Map's guard -- Windows, whole drives, user
 * profiles, the quarantine, anything relative or climbing -- minus its rule
 * refusing everything under Program Files. That rule is right for a
 * right-click on a picture of the disk and wrong here: the folder an
 * uninstaller leaves in Program Files is the most common leftover of all.
 * So a program's own folder is allowed, and the folders that hold
 * everyone's are refused by name. */
export function permanentDeletionRefusal(path, options = {}) {
  const where = { ...defaultLocations(), ...options };

  const base = protectionReason(path, {
    systemRoot: where.systemRoot,
    programFiles: NOWHERE,
    programFilesX86: NOWHERE,
    usersRoot: where.usersRoot,
    quarantineRoot: where.quarantineRoot
  });
  if (base) return base;

  const target = norm(path);
  for (const root of [where.programFiles, where.programFilesX86]) {
    if (target === norm(root)) return 'That is where every installed program lives.';
    if (target === norm(`${root}\\Common Files`)) return 'Common Files is shared by many programs.';
  }
  if (target === norm(where.programData) || target === norm(`${where.programData}\\Microsoft`)) {
    return 'That folder holds data for every program on this machine.';
  }

  const users = norm(where.usersRoot);
  if (target.startsWith(`${users}\\`)) {
    const inProfile = target.slice(users.length + 1).split('\\').slice(1).join('\\');
    if (PROFILE_FOLDERS.has(inProfile)) return "That is one of your profile's own folders, not a program's.";
  }
  return null;
}

/** Bytes under a path, not following links. A junction in AppData can
 * point anywhere, and its target is not what is being removed. */
async function pathSize(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) return 0;
  if (!info.isDirectory()) return info.size;
  let total = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    total += await pathSize(join(path, entry.name)).catch(() => 0);
  }
  return total;
}

/** Deletes each candidate outright -- the one place in the app that does.
 * Uninstall's "Delete permanently" and Deep Clean's "Delete now" both come
 * through here, so there is a single implementation of what "gone" means.
 * Each caller decides what it may hand over; this only removes, and reports
 * a file it could not remove (locked, permission) rather than throwing. */
export async function removePermanently(candidates, { overwritePasses = 0 } = {}) {
  const removed = [];
  const failed = [];
  for (const { path, sizeBytes } of candidates) {
    try {
      if (overwritePasses > 0) {
        // "Overwrite files before deleting" is on: every byte is written
        // over first (see lib/shredFile.js, including what it cannot
        // promise on an SSD). A file that cannot be overwritten is left in
        // place and reported -- quietly falling back to a plain delete
        // would be doing less than was asked for while saying it was done.
        const result = await shredPaths([path], overwritePasses);
        if (result.failed.length > 0) {
          failed.push(...result.failed);
          continue;
        }
      } else {
        await rm(path, { recursive: true, force: false });
      }
      removed.push({ originalPath: path, sizeBytes });
    } catch (err) {
      failed.push({ path, reason: err.message });
    }
  }
  return { removed, failed };
}

/** Removes an uninstall's leftovers to the chosen destination. Reports
 * rather than throws, like quarantineAndDelete: one locked file is a
 * partial success with a name attached, not a failure of the whole run.
 *
 * `deleteLockedFilesOnRestart` only ever reaches the `quarantine`
 * destination's own `quarantineAndDelete` call below -- the `recycle`/
 * `permanent` branches' own registry-only `quarantineAndDelete` call
 * further down never passes `files` at all (it removes files through
 * `sendToRecycleBin`/`rm` instead), so there is no locked FILE for that
 * call to ever need to schedule. A no-op for those two destinations,
 * not a bug. */
export async function removeLeftovers({ scheduledTasks = [], ...rest }) {
  const result = await removeFilesAndKeys(rest);
  if (!Array.isArray(scheduledTasks) || scheduledTasks.length === 0) return result;
  // Independent of the destination: a task has no Recycle Bin, so its
  // definition is always exported to the Backup Manager first. A failure
  // here is reported in the result and never undoes the files and keys.
  const tasks = await removeScheduledTasks({ programName: rest.programName, tasks: scheduledTasks })
    .catch((err) => ({
      removed: [], backupDir: null, elevated: false,
      failed: scheduledTasks.map((t) => ({ name: t?.name, path: t?.path, reason: err.message }))
    }));
  return { ...result, scheduledTasks: tasks };
}

async function removeFilesAndKeys({
  programName, files = [], registryKeys = [], destination = 'quarantine', deleteLockedFilesOnRestart = false,
  overwritePasses = 0, installedPrograms = []
}) {
  /* The same protections the scan applies, applied again here because this is
   * the last step before the disk and the route can be called with a list the
   * scan never produced: Windows and its components, drive roots and profile
   * folders, and any other installed program's folder. They hold for every
   * destination, the reversible one included -- a Quarantine restore puts a
   * deleted program back, it does not make deleting it right. */
  const footprints = buildFootprints(installedPrograms);
  const refusedFiles = [];
  const allowed = [];
  for (const path of files) {
    if (typeof path !== 'string') continue;
    // Something already gone is nothing to refuse; the removal below skips it.
    if (!existsSync(path)) { allowed.push(path); continue; }
    const refusal = permanentDeletionRefusal(path) || osComponentRefusal(path) || footprintRefusal(path, footprints);
    if (refusal) refusedFiles.push({ path, reason: refusal });
    else allowed.push(path);
  }

  if (destination === 'quarantine') {
    const manifest = await quarantineAndDelete({ programName, files: allowed, registryKeys, deleteLockedFilesOnRestart });
    return { ...manifest, failedFiles: [...refusedFiles, ...(manifest.failedFiles || [])], destination };
  }

  const removed = [];
  const failedFiles = [...refusedFiles];
  const candidates = [];

  // Sized only after the guards, never before. Sizing C:\Windows on the way
  // to refusing it would take minutes.
  for (const path of allowed) {
    if (!existsSync(path)) continue;
    candidates.push({ path, sizeBytes: await pathSize(path).catch(() => 0) });
  }

  if (destination === 'recycle') {
    if (candidates.length > 0) {
      const sizeOf = new Map(candidates.map((c) => [c.path, c.sizeBytes]));
      const { recycled, failed, error } = await sendToRecycleBin(candidates.map((c) => c.path));
      for (const path of recycled) removed.push({ originalPath: path, sizeBytes: sizeOf.get(path) ?? 0 });
      for (const path of failed) {
        failedFiles.push({ path, reason: error ? `could not be recycled: ${error}` : 'could not be recycled' });
      }
      // A path the recycler put in neither list was not removed, whatever
      // else is true. Found live: folders came back in neither list and
      // stayed on the disk, and a report built only from those two lists
      // simply left them out. Never counted as gone without a yes.
      const answered = new Set([...recycled, ...failed]);
      for (const { path } of candidates) {
        if (!answered.has(path)) {
          failedFiles.push({ path, reason: 'It was not moved to the Recycle Bin, and Windows did not say why.' });
        }
      }
    }
  } else {
    const result = await removePermanently(candidates, { overwritePasses });
    removed.push(...result.removed);
    failedFiles.push(...result.failed);
  }

  let registry = { registryKeys: [], failedRegistryKeys: [], batchDir: null };
  if (registryKeys.length > 0) {
    const manifest = await quarantineAndDelete({ programName, files: [], registryKeys });
    registry = {
      registryKeys: manifest.registryKeys,
      failedRegistryKeys: manifest.failedRegistryKeys,
      batchDir: manifest.batchDir
    };
  }

  return {
    programName,
    destination,
    files: removed,
    failedFiles,
    ...registry,
    totalSizeBytes: removed.reduce((sum, f) => sum + f.sizeBytes, 0)
  };
}
