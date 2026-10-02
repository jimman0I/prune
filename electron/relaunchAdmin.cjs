/** Prune restarting itself as Administrator, on request.
 *
 * Reading a drive's file table needs administrator rights, and without them
 * every fast Disk Map scan raises its own UAC prompt. Starting Prune
 * elevated once makes the later scans prompt-free: the backend sees it is
 * already elevated and reads the volume directly.
 *
 * Elevation is a decision, so this is only ever reached from a button the
 * user pressed, and the window can ask for exactly one thing: restart. It
 * cannot name a program, a path or an argument -- what gets launched is this
 * app's own executable, and the only argument is the old process id the new
 * instance waits on.
 *
 * Order matters. The elevated instance is started FIRST and this one quits
 * only if that worked: a declined prompt (the most common outcome) must
 * leave the running app exactly as it was. The two instances cannot overlap
 * on the backend's port, so the new one waits for this process to exit
 * before it starts its backend (see waitForParentExit). */
const RELAUNCH_FLAG = '--prune-relaunch-after';

/** PowerShell single-quoted literal: a doubled quote is the only escape. */
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

function createAdminRelaunch({ app, platform = process.platform, execPath = process.execPath, pid = process.pid, execFile, defer = setImmediate }) {
  let inFlight = null;

  const canRelaunch = () => platform === 'win32' && app.isPackaged === true;

  function start() {
    return new Promise((resolve) => {
      const script = `Start-Process -FilePath ${quote(execPath)} -ArgumentList ${quote(`${RELAUNCH_FLAG}=${pid}`)} -Verb RunAs`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 120_000 }, (err) => {
        if (err) {
          // Declining the UAC dialog surfaces as an error, not a clean exit.
          // Matched on the message, as backend/src/lib/elevated.js does.
          const message = `${err.message || ''}`;
          if (/canceled by the user|cancelled by the user|1223/i.test(message)) {
            resolve({ ok: false, cancelled: true });
          } else {
            resolve({ ok: false, error: message.trim() || 'Windows could not start Prune as administrator.' });
          }
          return;
        }
        // Let the reply reach the window before the app goes away.
        defer(() => app.quit());
        resolve({ ok: true });
      });
    });
  }

  /** Repeated calls while one is running share it: two clicks must not
   * raise two prompts or start two elevated instances. */
  function relaunch() {
    if (!canRelaunch()) return Promise.resolve({ ok: false, unsupported: true });
    if (!inFlight) inFlight = start().finally(() => { inFlight = null; });
    return inFlight;
  }

  return { relaunch, canRelaunch };
}

/** The pid after `--prune-relaunch-after=`, or null. Only digits, a sane
 * length and non-zero: this comes from the command line, and what it feeds
 * is a liveness check, nothing more. */
function parseRelaunchArg(argv) {
  for (const arg of argv || []) {
    const match = new RegExp(`^${RELAUNCH_FLAG}=(\\d{1,9})$`).exec(String(arg));
    if (match) {
      const pid = Number(match[1]);
      return pid > 0 ? pid : null;
    }
  }
  return null;
}

/** Whether a process is still running. EPERM means it exists but belongs to
 * someone this process may not signal -- still alive. */
function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** Waits for the instance that started this one to exit, so the two never
 * hold the backend's port at once. Gives up after `timeoutMs` and returns
 * false: a start-up that hangs forever on a process that will not die is
 * worse than one that tries anyway. */
async function waitForParentExit(pid, {
  isAlive = processIsAlive,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now,
  timeoutMs = 15_000,
  intervalMs = 150
} = {}) {
  const deadline = now() + timeoutMs;
  while (isAlive(pid)) {
    if (now() >= deadline) return false;
    await sleep(intervalMs);
  }
  return true;
}

module.exports = { createAdminRelaunch, parseRelaunchArg, waitForParentExit, RELAUNCH_FLAG };
