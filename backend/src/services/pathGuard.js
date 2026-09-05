import { join } from 'node:path';
import { quarantineRoot } from './quarantine.js';

/** What must never be deleted, however it is asked for.
 *
 * This exists because the Disk Map's context menu can offer to remove the
 * folder under the cursor, and the folder under the cursor might be
 * C:\Windows. Every other removal in this app acts on a curated target --
 * a cleaner rule written by hand, an uninstaller's own leftovers, a
 * registry value found by a scan. This one acts on whatever the user
 * happened to right-click in a picture of their disk, which is a
 * different kind of dangerous.
 *
 * The registry already has this shape of guard (isProtectedKey in
 * registryLeftovers.js) and for the same reason. Nothing had it for
 * paths, because until now nothing could delete an arbitrary one.
 *
 * The rule is deny-by-suspicion: anything unparseable, relative, or
 * capable of climbing is refused rather than analysed. A path containing
 * `..` cannot be reasoned about by prefix matching at all --
 * "C:\Users\jim\..\..\Windows" IS C:\Windows -- so it never gets that far.
 */

/** Comparable form: forward slashes folded to backslashes, trailing
 * separators dropped, lower-cased. Windows paths are case-insensitive and
 * the disk map builds them by joining, so both spellings arrive here. */
function normalize(path) {
  return String(path).replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

/** Whether `path` is `parent` or sits underneath it.
 *
 * The separator in the comparison is what makes this correct.
 * "C:\Windows Update Logs" starts with "C:\Windows" as a STRING and is
 * not inside it as a PATH, and a bare startsWith refuses it -- or, with
 * the operands the other way round, lets something through. */
function isAtOrUnder(path, parent) {
  if (!parent) return false;
  const target = normalize(path);
  const root = normalize(parent);
  return target === root || target.startsWith(`${root}\\`);
}

/** Exactly one level below a parent -- a whole user profile under
 * C:\Users, which is as catastrophic to delete as C:\Users itself. */
function isImmediateChildOf(path, parent) {
  if (!isAtOrUnder(path, parent)) return false;
  const rest = normalize(path).slice(normalize(parent).length + 1);
  return rest.length > 0 && !rest.includes('\\');
}

function defaults() {
  const systemDrive = process.env.SystemDrive || 'C:';
  return {
    systemRoot: process.env.SystemRoot || process.env.windir || `${systemDrive}\\Windows`,
    programFiles: process.env.ProgramFiles || `${systemDrive}\\Program Files`,
    programFilesX86: process.env['ProgramFiles(x86)'] || `${systemDrive}\\Program Files (x86)`,
    usersRoot: `${systemDrive}\\Users`,
    quarantineRoot: quarantineRoot()
  };
}

/** Why this path is protected, or null when it is not.
 *
 * A reason rather than a boolean because the UI has to say it. "That
 * cannot be deleted" with no explanation reads as the app being broken;
 * "Windows itself" reads as the app being careful. */
export function protectionReason(path, options = {}) {
  const o = { ...defaults(), ...options };

  if (typeof path !== 'string' || !path.trim()) return 'That is not a path.';

  const raw = path.trim();
  if (raw.includes('..')) return 'Paths that climb out of themselves are refused.';

  // Absolute, and either a drive letter or a UNC share. Anything else is
  // relative to a working directory this process should never rely on.
  const isAbsolute = /^[a-z]:[\\/]/i.test(raw) || /^[\\/]{2}[^\\/]/.test(raw);
  if (!isAbsolute) return 'Only a full path can be removed.';

  const normalized = normalize(raw);
  if (/^[a-z]:$/.test(normalized)) return 'That is a whole drive.';

  if (isAtOrUnder(raw, o.systemRoot)) return 'That is Windows itself.';
  if (isAtOrUnder(raw, o.programFiles) || isAtOrUnder(raw, o.programFilesX86)) {
    return 'Installed programs are removed by uninstalling them, not by deleting their folder.';
  }

  // Ordered most-specific-first, because the REASON is shown to the user
  // and several of these overlap. The quarantine lives inside the user
  // profile, so an ancestor check placed above these two answered
  // "C:\Users" with "that holds Prune's own quarantine" -- true, and not
  // the fact anybody needed. Refusing correctly for a confusing reason is
  // still a bug when the reason is the feature.
  if (normalize(raw) === normalize(o.usersRoot)) return 'That is every user account on this machine.';
  if (isImmediateChildOf(raw, o.usersRoot)) return 'That is a whole user profile.';

  // The quarantine, and anything containing it. Moving it into itself, or
  // deleting the folder that holds every undo the app has.
  if (isAtOrUnder(raw, o.quarantineRoot) || isAtOrUnder(o.quarantineRoot, raw)) {
    return "That holds Prune's own quarantine.";
  }

  return null;
}

export function isProtectedPath(path, options = {}) {
  return protectionReason(path, options) !== null;
}
