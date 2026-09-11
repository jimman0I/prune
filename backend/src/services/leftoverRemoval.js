import { lstat, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quarantineAndDelete, quarantineRoot } from './quarantine.js';
import { sendToRecycleBin } from './recycleBin.js';
import { protectionReason } from './pathGuard.js';

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

/** Removes an uninstall's leftovers to the chosen destination. Reports
 * rather than throws, like quarantineAndDelete: one locked file is a
 * partial success with a name attached, not a failure of the whole run. */
export async function removeLeftovers({ programName, files = [], registryKeys = [], destination = 'quarantine' }) {
  if (destination === 'quarantine') {
    return { ...(await quarantineAndDelete({ programName, files, registryKeys })), destination };
  }

  const removed = [];
  const failedFiles = [];
  const candidates = [];

  // Guarded before anything is measured, let alone moved. Sizing C:\Windows
  // on the way to refusing it would take minutes.
  for (const path of files) {
    if (typeof path !== 'string' || !existsSync(path)) continue;
    const refusal = permanentDeletionRefusal(path);
    if (refusal) { failedFiles.push({ path, reason: refusal }); continue; }
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
    for (const { path, sizeBytes } of candidates) {
      try {
        await rm(path, { recursive: true, force: false });
        removed.push({ originalPath: path, sizeBytes });
      } catch (err) {
        failedFiles.push({ path, reason: err.message });
      }
    }
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
