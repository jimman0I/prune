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
