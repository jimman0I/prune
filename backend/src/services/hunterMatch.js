import { footprintsOf, osComponentRefusal } from './leftoverProtection.js';

/** Turning "the window the person clicked" into "the program it belongs to".
 *
 * Pure functions; the script that finds the window is hunter.js. */

const norm = (path) => String(path || '').replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();
const isUnder = (path, dir) => norm(path) === norm(dir) || norm(path).startsWith(`${norm(dir)}\\`);

/** The installed program the executable belongs to, and the startup entries
 * that launch it.
 *
 * A program owns an executable when the executable sits in a folder the
 * program says is its own (InstallLocation, or the folders of its icon and
 * uninstaller -- see footprintsOf). When programs nest, the deepest folder
 * wins. A Store app is matched by its package folder. Anything in Windows is
 * never matched to a program, however it is registered. */
export function matchHunted(target, { programs = [], storeApps = [], startupItems = [], env = process.env } = {}) {
  const exe = target?.exePath;
  const empty = { program: null, startupItems: [] };
  if (typeof exe !== 'string' || !/^[a-z]:[\\/]/i.test(exe)) return empty;

  const startup = startupItems
    .filter((item) => item.executable && norm(item.executable) === norm(exe))
    .map((item) => ({ id: item.id, name: item.name, enabled: item.enabled !== false, scope: item.scope, toggleBlockedReason: item.toggleBlockedReason }));

  const systemRoot = env?.SystemRoot || env?.windir;
  if (systemRoot && isUnder(exe, systemRoot)) return { program: null, startupItems: startup };

  let best = null;
  let bestLength = -1;
  for (const program of [...programs, ...storeApps]) {
    const dirs = program.source === 'store' && program.installLocation ? [program.installLocation] : footprintsOf(program, { env });
    for (const dir of dirs) {
      if (isUnder(exe, dir) && norm(dir).length > bestLength) {
        best = program;
        bestLength = norm(dir).length;
      }
    }
  }
  return { program: best, startupItems: startup };
}

/** Why this process must not be ended from Hunter, or null.
 *
 * Prune's own processes (the window, its helpers, this backend), Windows'
 * processes, and anything whose path is unknown. System, Idle and pid 0/4
 * are included by the last rule: they have no user-mode executable. */
export function endProcessRefusal(target, { self = { pid: process.pid, ppid: process.ppid, execPath: process.execPath }, env = process.env } = {}) {
  const pid = Number(target?.pid);
  if (!Number.isInteger(pid) || pid <= 4) return 'That process cannot be ended.';
  if (pid === self.pid || pid === self.ppid) return 'That is Prune itself.';
  const exe = target?.exePath;
  if (typeof exe !== 'string' || !/^[a-z]:[\\/]/i.test(exe)) return 'Its program file could not be identified.';
  if (norm(exe) === norm(self.execPath) || /\\prune\.exe$/i.test(exe)) return 'That is Prune itself.';
  const systemRoot = env?.SystemRoot || env?.windir;
  if (systemRoot && isUnder(exe, systemRoot)) return 'That is part of Windows.';
  if (osComponentRefusal(exe, { env })) return 'That is part of Windows.';
  return null;
}

/** What the Hunter script printed, as a result object. Anything that is not
 * one of the three outcomes it can produce is a failure, with no pid. */
export function parseHunterOutput(text) {
  let data;
  try { data = JSON.parse(String(text).trim()); } catch { return { status: 'failed' }; }
  if (data?.status === 'cancelled' || data?.status === 'timeout') return { status: data.status };
  if (data?.status === 'picked' && Number.isInteger(data.pid) && data.pid > 0) {
    return {
      status: 'picked', pid: data.pid,
      exePath: typeof data.exePath === 'string' && data.exePath ? data.exePath : null,
      name: typeof data.name === 'string' ? data.name : null,
      title: typeof data.title === 'string' ? data.title : ''
    };
  }
  return { status: 'failed' };
}
