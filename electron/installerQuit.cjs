/** Prune quitting when the installer asks it to.
 *
 * The stock installer closes a running app by asking Windows to end the
 * process. Windows refuses when the app runs as Administrator (the "Always
 * run as administrator" setting, or "Restart Prune as administrator") and the
 * installer, a per-user program, does not: the person is told to close Prune
 * by hand. A same-user file is not subject to that rule, so the installer
 * (electron/build/installer.nsh) writes a small flag file into Prune's data
 * folder and this watcher, in the running app, sees it and quits.
 *
 * Only a flag written AFTER this instance started counts, and any older one
 * is removed at start: an installer that was cancelled after writing the flag
 * must not make the next launch quit on sight. The flag asks for nothing but
 * a clean exit, so the worst a stray one can do is close Prune. */
const fs = require('node:fs');
const path = require('node:path');

const QUIT_FLAG = 'installer-quit.flag';

function createInstallerQuitWatcher({
  dir,
  onQuit,
  intervalMs = 1000,
  now = Date.now,
  stat = fs.statSync,
  unlink = fs.unlinkSync,
  setTimer = setInterval,
  clearTimer = clearInterval
}) {
  const file = path.join(dir, QUIT_FLAG);
  const startedAt = now();
  const remove = () => { try { unlink(file); } catch { /* already gone */ } };

  remove();

  function check() {
    let info;
    try { info = stat(file); } catch { return false; }
    remove();
    // Written before this instance existed: not for us.
    if (info.mtimeMs < startedAt - 1000) return false;
    onQuit();
    return true;
  }

  const timer = setTimer(() => { if (check()) clearTimer(timer); }, intervalMs);
  if (timer && typeof timer.unref === 'function') timer.unref();

  return { check, stop: () => clearTimer(timer) };
}

module.exports = { createInstallerQuitWatcher, QUIT_FLAG };
