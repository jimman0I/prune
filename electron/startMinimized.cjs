/** Starting minimised: the decisions, kept free of Electron so they can be
 * tested without a window.
 *
 * "Start Prune when I sign in to Windows" (Settings -> General) puts
 * `"<Prune.exe>" --start-minimized` in the per-user Run key. When that flag is
 * present, main.cjs creates the window hidden instead of showing it, and this
 * file decides what happens to it:
 *
 *   normal   no flag: the window is shown, as always.
 *   tray     flag, and "Minimize to tray" is on: the window stays hidden and
 *            the tray icon is how it comes back.
 *   taskbar  flag, but the tray setting is off: the window starts minimised in
 *            the taskbar. Hiding it with no tray setting would leave a running
 *            program with no way back that the person agreed to.
 *
 * And one rule over all of them: never lose the window. A 'tray' start is only
 * kept if the tray icon really exists a moment later (settleHiddenStart);
 * otherwise it falls back to the taskbar.
 *
 * A second launch (a shortcut, the Start menu) while Prune is running does not
 * open a second app: it shows the existing window -- unless the second launch
 * is itself a silent --start-minimized one (revealSteps,
 * shouldRevealForSecondInstance). */

const START_MINIMIZED_FLAG = '--start-minimized';

/** Emitted on Electron's `app` by backend/src/lib/trayManager.js once the tray
 * icon exists. The two cannot import each other (CommonJS here, ESM there), so
 * the name is written in both and background.test.cjs checks they agree. */
const TRAY_READY_EVENT = 'prune:tray-ready';

/** Whether the command line has exactly `--start-minimized`. argv[0] is the
 * program and never a flag; anything that is not a string is ignored. */
function parseStartMinimized(argv) {
  if (!Array.isArray(argv)) return false;
  return argv.slice(1).some((arg) => arg === START_MINIMIZED_FLAG);
}

/** 'normal' | 'tray' | 'taskbar'. Only an explicit true for each input counts. */
function decideStartMode({ startMinimized = false, minimizeToTray = false } = {}) {
  if (startMinimized !== true) return 'normal';
  return minimizeToTray === true ? 'tray' : 'taskbar';
}

/** The "Minimize to tray" setting, read straight from settings.json because the
 * window is created before the backend answers. Only an explicit `true` is on
 * (settings.js's default is off); a missing, damaged or unreadable file is off,
 * which starts in the taskbar, the safe side. */
function readMinimizeToTray(settingsFile, readText) {
  if (!settingsFile) return false;
  try {
    const parsed = JSON.parse(readText(settingsFile));
    return parsed !== null && typeof parsed === 'object' && parsed.minimizeToTray === true;
  } catch {
    return false;
  }
}

/** A 'tray' start is kept only if the tray is there. `trayReady()` says whether
 * it already is; `waitForTray()` waits a little for it (it is created by the
 * backend a moment after the window) and answers whether it appeared. If it
 * never does, or waiting fails, the window goes to the taskbar instead. */
async function settleHiddenStart({ mode, trayReady, waitForTray }) {
  if (mode !== 'tray') return mode;
  if (trayReady()) return 'tray';
  try {
    return (await waitForTray()) ? 'tray' : 'taskbar';
  } catch {
    return 'taskbar';
  }
}

/** The window calls, in order, that bring a hidden or minimised window back. */
function revealSteps({ isMinimized = false } = {}) {
  return [...(isMinimized ? ['restore'] : []), 'show', 'focus'];
}

/** Whether another launch should surface the running window. A launch that is
 * itself a silent --start-minimized (the Run key firing while Prune is already
 * up) must not. */
function shouldRevealForSecondInstance(argv) {
  return !parseStartMinimized(argv);
}

module.exports = {
  TRAY_READY_EVENT, START_MINIMIZED_FLAG, parseStartMinimized, decideStartMode, readMinimizeToTray, settleHiddenStart, revealSteps, shouldRevealForSecondInstance
};
