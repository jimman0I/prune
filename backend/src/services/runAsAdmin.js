import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isElevated as processIsElevated } from '../lib/privilege.js';
import { isStartupEnabled } from './startupApproved.js';

const execFileAsync = promisify(execFile);

/** "Always run as administrator", as an opt-in.
 *
 * The mechanism is the one Windows already has for this: the per-user
 * compatibility flag for ONE executable, which is what ticking "Run this
 * program as administrator" in the file's Properties writes. The value lives
 * at
 *
 *   HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers
 *
 * its name is the full path of Prune.exe and its data is `~ RUNASADMIN`,
 * optionally beside flags other tools put there (WIN8RTM, HIGHDPIAWARE ...).
 *
 * Why this and not the manifest: the manifest's requestedExecutionLevel would
 * force a UAC prompt on every launch for everyone, and for the installer's own
 * "run Prune after install" step too. The flag is per user, per path, written
 * and removed without administrator rights, and shows up (and can be undone)
 * in the file's Properties, so it is reversible outside Prune as well.
 *
 * Rules this keeps, each with a test:
 *  - Only the packaged app's own Prune.exe is ever written. A development
 *    build (electron.exe), another platform, or any other path is refused.
 *  - The registry is read for the real state; nothing is trusted from a copy.
 *  - Other flags in the value survive both turning it on and turning it off;
 *    turning it off deletes the value only when nothing else is left in it.
 *  - reg.exe is run with an argv array and no shell, so a path with quotes or
 *    ampersands is one argument, never a command.
 *
 * One limit, stated: if Windows elevates Prune with a DIFFERENT administrator
 * account's credentials, "HKCU" is that account's hive, not the person's own.
 *
 * `exec`, `execPath`, `platform` and `isElevated` are injectable; no test
 * writes the real registry. */

export const LAYERS_KEY = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers';
export const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export const APPROVED_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
export const TOKEN = 'RUNASADMIN';

/* ---- the flag string, as pure functions ---- */

/** `~ WIN8RTM RUNASADMIN` -> { tilde: true, tokens: ['WIN8RTM', 'RUNASADMIN'] }. */
export function parseFlags(data) {
  const parts = String(data ?? '').trim().split(/\s+/).filter(Boolean);
  const tilde = parts[0] === '~';
  return { tilde, tokens: tilde ? parts.slice(1) : parts };
}

const sameToken = (a, b) => a.toUpperCase() === b.toUpperCase();

export function hasToken(data, token = TOKEN) {
  return parseFlags(data).tokens.some((t) => sameToken(t, token));
}

function compose({ tilde, tokens }) {
  return [...(tilde ? ['~'] : []), ...tokens].join(' ');
}

/** The value with RUNASADMIN in it: everything already there stays, in order,
 * and the flag goes last. A value that was empty or a bare `~` becomes
 * `~ RUNASADMIN`, exactly what the Properties dialog writes. A tilde is not
 * added to a value that had none. Never doubles the flag. */
export function addToken(data, token = TOKEN) {
  const flags = parseFlags(data);
  const tokens = [];
  let found = false;
  for (const t of flags.tokens) {
    if (sameToken(t, token)) {
      if (found) continue;
      found = true;
    }
    tokens.push(t);
  }
  if (!found) tokens.push(token);
  const hadAnything = String(data ?? '').trim() !== '';
  return compose({ tilde: flags.tilde || !hadAnything, tokens });
}

/** The value without RUNASADMIN, or '' when nothing else is left (the caller
 * deletes the value then, rather than leaving a bare `~` behind). */
export function removeToken(data, token = TOKEN) {
  const flags = parseFlags(data);
  const tokens = flags.tokens.filter((t) => !sameToken(t, token));
  return tokens.length === 0 ? '' : compose({ tilde: flags.tilde, tokens });
}

/* ---- reg.exe's output ---- */

/** The values in `reg query` output: [{ name, type, data }]. Value lines are
 * indented; the key line is not. Fields are separated by runs of spaces, so a
 * name may hold single spaces (C:\Program Files\...). */
export function parseRegQuery(text) {
  const values = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = /^\s+(.+?)\s{2,}(REG_[A-Z_]+)(?:\s{2,}(.*))?$/.exec(line);
    if (match) values.push({ name: match[1], type: match[2], data: (match[3] ?? '').trimEnd() });
  }
  return values;
}

/** Whether `execPath` is a packaged Prune.exe on Windows. */
export function isPruneExecutable(execPath, platform = process.platform) {
  return platform === 'win32' && typeof execPath === 'string' && /^[a-z]:\\.*\\prune\.exe$/i.test(execPath);
}

/* ---- the service ---- */

export function createRunAsAdmin({
  exec = execFileAsync,
  execPath = process.execPath,
  platform = process.platform,
  isElevated = processIsElevated,
  systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
} = {}) {
  const reg = `${systemRoot}\\System32\\reg.exe`;
  const supported = isPruneExecutable(execPath, platform);
  const run = (args) => exec(reg, args, { windowsHide: true, timeout: 15_000 });

  /** Output of a read, or '' when the key or value is not there (reg.exe
   * answers exit code 1 for both, in the machine's language). Anything else
   * that goes wrong is a real error. */
  async function read(args) {
    try {
      const { stdout } = await run(args);
      return String(stdout ?? '');
    } catch (err) {
      if (err?.code === 1) return '';
      throw err;
    }
  }

  async function readFlags() {
    const values = parseRegQuery(await read(['query', LAYERS_KEY, '/v', execPath]));
    const own = values.find((v) => v.name.toLowerCase() === execPath.toLowerCase());
    return own ? own.data : null;
  }

  /** Whether a Run entry that Windows still honours launches this exe. */
  async function startsWithWindows() {
    try {
      const needle = execPath.toLowerCase();
      const entries = parseRegQuery(await read(['query', RUN_KEY]))
        .filter((v) => v.data.replace(/"/g, '').toLowerCase().includes(needle));
      for (const entry of entries) {
        const approved = parseRegQuery(await read(['query', APPROVED_RUN_KEY, '/v', entry.name]))
          .find((v) => v.name.toLowerCase() === entry.name.toLowerCase());
        const byte = approved ? Number.parseInt(approved.data.slice(0, 2), 16) : null;
        if (isStartupEnabled(Number.isFinite(byte) ? byte : null)) return true;
      }
    } catch {
      // A Run key that cannot be read is no reason to warn.
    }
    return false;
  }

  async function status() {
    if (!supported) return { supported: false, enabled: false, elevatedNow: false, startsWithWindows: false };
    const [flags, elevatedNow, startup] = await Promise.all([
      readFlags(),
      Promise.resolve().then(() => isElevated()).catch(() => false),
      startsWithWindows()
    ]);
    return { supported: true, enabled: hasToken(flags), elevatedNow: elevatedNow === true, startsWithWindows: startup };
  }

  // Changes are applied one after another: each reads the value the previous
  // one left, so two quick toggles cannot undo each other half-way.
  let queue = Promise.resolve();

  async function apply(enabled) {
    const current = await readFlags();
    if (enabled) {
      if (hasToken(current)) return;
      await run(['add', LAYERS_KEY, '/v', execPath, '/t', 'REG_SZ', '/d', addToken(current), '/f']);
      return;
    }
    if (!hasToken(current)) return;
    const remaining = removeToken(current);
    if (remaining === '') await run(['delete', LAYERS_KEY, '/v', execPath, '/f']);
    else await run(['add', LAYERS_KEY, '/v', execPath, '/t', 'REG_SZ', '/d', remaining, '/f']);
  }

  function setEnabled(enabled) {
    if (enabled !== true && enabled !== false) return Promise.reject(new Error('enabled must be true or false.'));
    if (!supported) {
      return Promise.reject(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true }));
    }
    const result = queue.then(() => apply(enabled)).then(status);
    queue = result.catch(() => {});
    return result;
  }

  return { status, setEnabled };
}

const service = createRunAsAdmin();
export const getRunAsAdminStatus = () => service.status();
export const setRunAsAdmin = (enabled) => service.setEnabled(enabled);
