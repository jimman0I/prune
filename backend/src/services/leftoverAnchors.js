import { existsSync } from 'node:fs';
import { permanentDeletionRefusal } from './leftoverRemoval.js';
import { anchorRootFromCommand, osComponentRefusal } from './leftoverProtection.js';

/** The folders a program itself says are its own.
 *
 * A name match is a guess; the install location the program registered is a
 * statement. Everything under it is that program's, which is why the Safe
 * scan reports nothing else and why the other modes tier it as certain.
 *
 * Three things the program wrote down point at its folder: the
 * InstallLocation it registered, the folder its DisplayIcon lives in, and
 * the folder of its UninstallString. The last two matter because most
 * installers register no InstallLocation at all -- but they do register an
 * uninstaller and an icon, and those sit in the program's own folder.
 *
 * The values arrive from the registry (via the program list) and from the
 * request body, so they are treated as untrusted: only a full path, never
 * somewhere permanentDeletionRefusal would not let be deleted -- Windows, a
 * whole drive, Program Files itself, the profile folders -- and never a
 * Windows or Microsoft component. A registry value (or a request) naming
 * C:\Windows therefore anchors nothing. */
function cleanDirectory(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^"+|"+$/g, '').replace(/[\\/]+$/, '');
  if (!/^[a-z]:[\\/]/i.test(trimmed) && !/^[\\/]{2}[^\\/]/.test(trimmed)) return null;
  if (permanentDeletionRefusal(trimmed)) return null;
  if (osComponentRefusal(trimmed)) return null;
  return trimmed;
}

/** The authoritative folders for one program. `existing: true` keeps only
 * those that are still on disk -- what a scan wants, since a folder that is
 * gone is not a leftover. */
export function anchorDirectories(anchors, { existing = false } = {}) {
  const found = [];
  const add = (value) => {
    const dir = cleanDirectory(value);
    if (!dir) return;
    if (found.some((known) => known.toLowerCase() === dir.toLowerCase())) return;
    if (existing && !existsSync(dir)) return;
    found.push(dir);
  };
  add(anchors?.installLocation);
  add(anchorRootFromCommand(anchors?.displayIcon));
  add(anchorRootFromCommand(anchors?.uninstallString));
  return found;
}

/** Where UAC file virtualization would have put this program's writes.
 *
 * An unelevated program that writes into its own folder under Program Files
 * or ProgramData has the write silently redirected to a per-user copy under
 * LocalAppData\VirtualStore, mirroring the path without the drive. The
 * program's uninstaller works on the real folder and never sees the copy, so
 * it is left behind -- and, being a mirror of the program's own folder, it is
 * as certain a leftover as that folder. Only the system drive is virtualized,
 * and only a folder BELOW one of those roots: mirroring a root itself would
 * name the whole VirtualStore subtree. */
export function virtualStoreMirrors(dirs, env = process.env) {
  const local = env?.LOCALAPPDATA;
  if (!local) return [];
  const systemDrive = String(env?.SystemDrive || 'C:').toLowerCase();
  const roots = [env?.ProgramFiles, env?.['ProgramFiles(x86)'], env?.ProgramData]
    .filter(Boolean)
    .map((root) => String(root).replace(/[\\/]+$/, '').toLowerCase());
  const mirrors = [];
  for (const dir of dirs || []) {
    const clean = String(dir).replace(/[\\/]+$/, '');
    const lower = clean.toLowerCase();
    if (!lower.startsWith(`${systemDrive}\\`)) continue;
    if (!roots.some((root) => lower.startsWith(`${root}\\`))) continue;
    mirrors.push(`${local.replace(/[\\/]+$/, '')}\\VirtualStore\\${clean.slice(systemDrive.length + 1)}`);
  }
  return mirrors;
}
