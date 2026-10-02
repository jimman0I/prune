import { existsSync } from 'node:fs';
import { permanentDeletionRefusal } from './leftoverRemoval.js';

/** The folders a program itself says are its own.
 *
 * A name match is a guess; the install location the program registered is a
 * statement. Everything under it is that program's, which is why the Safe
 * scan reports nothing else and why the other modes tier it as certain.
 *
 * The values arrive from the registry (via the program list) and from the
 * request body, so they are treated as untrusted: only a full path, never
 * somewhere permanentDeletionRefusal would not let be deleted -- Windows, a
 * whole drive, Program Files itself, the profile folders. A registry value
 * (or a request) naming C:\Windows therefore anchors nothing. */
function cleanDirectory(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^"+|"+$/g, '').replace(/[\\/]+$/, '');
  if (!/^[a-z]:[\\/]/i.test(trimmed) && !/^[\\/]{2}[^\\/]/.test(trimmed)) return null;
  if (permanentDeletionRefusal(trimmed)) return null;
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
  return found;
}
