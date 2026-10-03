import { execFile } from 'node:child_process';
import { stat as fsStat } from 'node:fs/promises';
import { matchHunted } from './hunterMatch.js';
import { osComponentRefusal } from './leftoverProtection.js';

/** From a program file or a shortcut to the installed program it belongs to.
 *
 * Two doors lead here, both in the Applications screen: the "Find in Prune
 * (uninstall)" entry in File Explorer's right-click menu (services/
 * explorerMenu.js), and dropping a .exe or .lnk onto the screen. Both hand over
 * a path; this says which installed program owns it, with the same folder
 * matching Hunter uses (hunterMatch.js), so the two cannot disagree.
 *
 * It only LOOKS. Nothing is changed, and the answer is a suggestion the screen
 * turns into the ordinary uninstall dialog (which asks before it removes
 * anything) or into Forced uninstall (which scans and asks).
 *
 * A shortcut is read for its target with a short fixed PowerShell script
 * (WScript.Shell's CreateShortcut, as startupIcons.js reads Startup shortcuts).
 * The path reaches it through an environment variable, never spliced into the
 * script text, so a name full of quotes or `$(...)` is still only a name.
 *
 * Answers:
 *   matched     { exePath, via, shortcutPath?, program }
 *   unmatched   { exePath, via, name, folder }   no installed program owns it
 *   windows     { exePath, via }                 part of Windows: nothing offered
 *   unresolved  { reason: 'missing' | 'noTarget' | 'notProgram' }
 * where `via` is 'program' or 'shortcut'. */

/** Far beyond any real path, low enough to refuse an enormous one. */
const MAX_PATH_LENGTH = 4096;

/** Same rule as electron/explorerRequests.cjs isAcceptablePath: an absolute path
 * on a drive letter, no `..`, no control characters, none of the characters
 * Windows forbids in a name, a sane length. Written again here because the
 * Electron files and the backend are separate packages. */
function isDrivePath(value) {
  if (typeof value !== 'string' || value.length < 3 || value.length > MAX_PATH_LENGTH) return false;
  if (!/^[A-Za-z]:\\/.test(value)) return false;
  if (/[\u0000-\u001f\u007f<>"|?*]/.test(value)) return false;
  if (value.indexOf(':', 2) !== -1) return false;
  return !value.split('\\').some((segment) => segment === '..');
}

/** Why this cannot be looked up (a message for a 400), or null when it can: a
 * drive path that ends in .exe or .lnk. */
export function validateProgramFilePath(path) {
  if (!isDrivePath(path)) return 'Give the full path of a program (.exe) or a shortcut (.lnk) on a drive.';
  if (!/\.(exe|lnk)$/i.test(path)) return 'Only a program (.exe) or a shortcut (.lnk) can be looked up.';
  return null;
}

const SHORTCUT_SCRIPT = `
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($env:PRUNE_LNK)
[Console]::Out.Write([string]$link.TargetPath)
`;

function defaultRun(exec) {
  return (script, env) => new Promise((resolve, reject) => {
    exec(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 15_000, windowsHide: true, maxBuffer: 64 * 1024, env },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout ?? '')))
    );
  });
}

/** The target path a .lnk points at, or null if it has none or cannot be read. */
export async function resolveShortcutTarget(path, { exec = execFile, run = defaultRun(exec) } = {}) {
  try {
    const out = await run(SHORTCUT_SCRIPT, { ...process.env, PRUNE_LNK: path });
    return out.trim() || null;
  } catch {
    return null;
  }
}

const norm = (path) => String(path).replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();

async function isFile(stat, path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Looks a program file or shortcut up. Throws an error with `invalid: true`
 * for a path that is not one; everything else is an answer. `loadContext`
 * returns { programs, storeApps } and is only called once the path is known to
 * be worth looking up, since reading the lists takes seconds. */
export async function findProgramForFile(path, {
  stat = fsStat,
  resolveShortcut = resolveShortcutTarget,
  loadContext,
  env = process.env
} = {}) {
  const problem = validateProgramFilePath(path);
  if (problem) throw Object.assign(new Error(problem), { invalid: true });
  if (!(await isFile(stat, path))) return { status: 'unresolved', reason: 'missing' };

  let exePath = path;
  let via = 'program';
  let shortcutPath;
  if (/\.lnk$/i.test(path)) {
    const target = await resolveShortcut(path);
    if (!target) return { status: 'unresolved', reason: 'noTarget' };
    // Only a program on a drive: a folder, a document, a URL, an unexpanded
    // %variable% or a network path is not something this can match.
    if (!isDrivePath(target) || !/\.exe$/i.test(target)) return { status: 'unresolved', reason: 'notProgram' };
    exePath = target;
    via = 'shortcut';
    shortcutPath = path;
  }
  const origin = { exePath, via, ...(shortcutPath ? { shortcutPath } : {}) };

  const systemRoot = env?.SystemRoot || env?.windir;
  if (systemRoot && (norm(exePath) === norm(systemRoot) || norm(exePath).startsWith(`${norm(systemRoot)}\\`))) {
    return { status: 'windows', ...origin };
  }

  const { programs = [], storeApps = [] } = (await loadContext?.()) ?? {};
  const { program } = matchHunted({ exePath }, { programs, storeApps, startupItems: [], env });
  if (program) return { status: 'matched', ...origin, program };
  // A Windows component outside the Windows folder (WindowsApps, the shared
  // runtimes) that no program claims is not something to offer a removal for.
  if (osComponentRefusal(exePath, { env })) return { status: 'windows', ...origin };

  const slash = exePath.lastIndexOf('\\');
  return {
    status: 'unmatched',
    ...origin,
    name: exePath.slice(slash + 1).replace(/\.exe$/i, ''),
    folder: exePath.slice(0, slash)
  };
}
