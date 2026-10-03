import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  RUN_KEY, APPROVED_RUN_KEY, parseRegQuery, isPruneExecutable, getRunAsAdminStatus
} from './runAsAdmin.js';
import { isStartupEnabled } from './startupApproved.js';

const execFileAsync = promisify(execFile);

/** "Start Prune when I sign in to Windows", as an opt-in.
 *
 * One value in the per-user Run key:
 *
 *   HKCU\Software\Microsoft\Windows\CurrentVersion\Run   Prune = "<Prune.exe>" [--start-minimized]
 *
 * Starting a program at sign-in is persistence by nature, and persistence is
 * exactly what malware does, so the rules are the strict ones (each has a test):
 *  - Only an explicit switch in Settings writes it; it is never a side effect,
 *    and nothing about it is on by default.
 *  - It is the running, packaged Prune.exe and nothing else. A development
 *    build (electron.exe), another platform, or any other path is refused.
 *  - The data is the quoted path, plus `--start-minimized` if asked. Nothing
 *    else can be in it, and a value that has anything else in it is not one
 *    Prune wrote (parseRunValue).
 *  - The registry is read for the real state; nothing is remembered in
 *    settings.json. If Task Manager's Startup tab has switched the entry off
 *    (StartupApproved), the switch shows off and says so.
 *  - Turning it off deletes the value and Windows' mark for it, and only a
 *    value that has Prune's shape: it never deletes what it did not write.
 *  - reg.exe is run by full path with an argv array and no shell.
 *  - The uninstaller removes it too (electron/build/installer.nsh).
 *
 * `exec`, `execPath`, `platform` and `runAsAdminEnabled` are injectable; no
 * test writes the real registry. */

export const VALUE_NAME = 'Prune';
export const MINIMIZED_FLAG = '--start-minimized';

/** The data to write: the quoted path, and the flag only if wanted. */
export function runValueFor(execPath, minimized) {
  return `"${execPath}"${minimized ? ` ${MINIMIZED_FLAG}` : ''}`;
}

/** What a Run value written by Prune holds, or null if it is not one:
 * `"<...\Prune.exe>"` optionally followed by exactly `--start-minimized`. */
export function parseRunValue(data) {
  const match = /^"([^"]+)"(?:[ ](--start-minimized))?$/.exec(String(data ?? '').trim());
  if (!match || !isPruneExecutable(match[1], 'win32')) return null;
  return { exe: match[1], minimized: match[2] === MINIMIZED_FLAG };
}

export function createStartWithWindows({
  exec = execFileAsync,
  execPath = process.execPath,
  platform = process.platform,
  systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows',
  runAsAdminEnabled = async () => (await getRunAsAdminStatus()).enabled === true
} = {}) {
  const reg = `${systemRoot}\\System32\\reg.exe`;
  const supported = isPruneExecutable(execPath, platform);
  const run = (args) => exec(reg, args, { windowsHide: true, timeout: 15_000 });

  /** Output of a read, or '' when the key or value is not there (reg.exe
   * answers exit code 1 for both, in the machine's language). Anything else
   * that goes wrong is a real error. */
  async function read(args) {
    try {
      return String((await run(args)).stdout ?? '');
    } catch (err) {
      if (err?.code === 1) return '';
      throw err;
    }
  }

  /** The Run value and Windows' view of it. */
  async function inspect() {
    const own = parseRegQuery(await read(['query', RUN_KEY, '/v', VALUE_NAME]))
      .find((v) => v.name.toLowerCase() === VALUE_NAME.toLowerCase());
    const mark = parseRegQuery(await read(['query', APPROVED_RUN_KEY, '/v', VALUE_NAME]))
      .find((v) => v.name.toLowerCase() === VALUE_NAME.toLowerCase());
    const byte = mark ? Number.parseInt(mark.data.slice(0, 2), 16) : null;
    const approved = isStartupEnabled(Number.isFinite(byte) ? byte : null);
    const present = own !== undefined;
    const parsed = present ? parseRunValue(own.data) : null;
    return {
      present,
      ours: parsed !== null,
      foreign: present && parsed === null,
      minimized: parsed?.minimized === true,
      stale: parsed !== null && parsed.exe.toLowerCase() !== execPath.toLowerCase(),
      approved,
      marked: mark !== undefined
    };
  }

  async function status() {
    if (!supported) {
      return { supported: false, enabled: false, minimized: false, stale: false, foreign: false, disabledByWindows: false, runAsAdmin: false };
    }
    const [state, admin] = await Promise.all([
      inspect(),
      Promise.resolve().then(() => runAsAdminEnabled()).catch(() => false)
    ]);
    return {
      supported: true,
      enabled: state.ours && state.approved,
      minimized: state.minimized,
      stale: state.stale,
      foreign: state.foreign,
      disabledByWindows: state.ours && !state.approved,
      runAsAdmin: admin === true
    };
  }

  /** Windows' own "disabled" mark for the entry goes with it. A mark that is not
   * there is not an error. */
  async function clearMark() {
    try {
      await run(['delete', APPROVED_RUN_KEY, '/v', VALUE_NAME, '/f']);
    } catch (err) {
      if (err?.code !== 1) throw err;
    }
  }

  async function write(minimized) {
    await run(['add', RUN_KEY, '/v', VALUE_NAME, '/t', 'REG_SZ', '/d', runValueFor(execPath, minimized), '/f']);
  }

  async function apply({ enabled, minimized }) {
    const current = await inspect();
    if (enabled) {
      const wanted = minimized ?? (current.ours ? current.minimized : true);
      if (!current.ours || current.stale || current.minimized !== wanted) await write(wanted);
      if (!current.approved) await clearMark();
      return;
    }
    // Only a value with Prune's shape is Prune's to delete.
    if (!current.ours) return;
    await run(['delete', RUN_KEY, '/v', VALUE_NAME, '/f']);
    if (current.marked) await clearMark();
  }

  // Changes are applied one after another: each reads what the previous one
  // left, so two quick toggles cannot undo each other half-way.
  let queue = Promise.resolve();
  const serialised = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };

  function set(request) {
    const enabled = request?.enabled;
    const minimized = request?.minimized;
    if ((enabled !== true && enabled !== false) || (minimized !== undefined && minimized !== true && minimized !== false)) {
      return Promise.reject(new Error('enabled and minimized must be true or false.'));
    }
    if (!supported) {
      return Promise.reject(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true }));
    }
    return serialised(async () => { await apply({ enabled, minimized }); return status(); });
  }

  /** Re-points an EXISTING Prune entry at the running Prune.exe, for an update
   * that installed into another folder. Never creates one and never touches a
   * value that is not Prune's. */
  function repair() {
    if (!supported) return Promise.resolve({ action: 'none' });
    return serialised(async () => {
      const current = await inspect();
      if (!current.ours || !current.stale) return { action: 'none' };
      await write(current.minimized);
      return { action: 'updated' };
    });
  }

  return { status, set, repair };
}

const service = createStartWithWindows();
export const getStartWithWindows = () => service.status();
export const setStartWithWindows = (request) => service.set(request);
export const repairStartWithWindows = () => service.repair();
