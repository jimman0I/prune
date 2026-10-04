import { createServer } from 'node:http';
import { createApp } from './app.js';
import { startScheduler, checkSchedule } from './services/scheduleRunner.js';
import { enforceQuarantineLimits } from './services/quarantineLimits.js';
import { cleanupAllWipeLeftovers } from './lib/cleanerActions/wipeFreeSpace.js';
import { listFixedDrives } from './services/localDrives.js';
import { getSettings } from './services/settings.js';
import { applyInstallerChoices } from './services/installerChoices.js';
import { initTray } from './lib/trayManager.js';
import { ingestReport } from './services/scheduledCleanReport.js';
import { recordFreed } from './services/stats.js';
import { reconcileScheduledClean } from './services/scheduledCleanTask.js';
import { repairStartWithWindows } from './services/startWithWindows.js';
import { repairExplorerMenu } from './services/explorerMenu.js';
import { getProgramSizes, refreshStaleSizes } from './services/programSizes.js';
import {
  HOUSEKEEPING_DELAY_MS, SCHEDULE_CATCHUP_DELAY_MS, runLater, scheduleHousekeeping
} from './lib/startupTasks.js';

const PORT = process.env.UNREVO_BACKEND_PORT || 3101;

// A rejection escaping every route's own try/catch would otherwise crash
// the whole process — this is loaded in-process inside Electron's main
// process (see electron/main.cjs), so a crash here takes the whole app
// down, not just a request.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Built in app.js so the routes can be tested without binding a port or
// starting the scheduler. This file keeps everything that is about
// RUNNING the server rather than about what it serves.
const app = createApp({ port: PORT });

// The schedule catches up on start as well as on its timer: the window
// most likely to have been missed is one that passed while the machine
// was off, and the app opening is the first moment anything can notice.
// A few seconds in rather than at once (see lib/startupTasks.js): the first
// moments belong to the window loading.
startScheduler();
runLater(SCHEDULE_CATCHUP_DELAY_MS, () => {
  checkSchedule().catch(() => { /* a failed check must never stop the server booting */ });
});

// Upkeep nobody is waiting for. Each of these used to start the instant the
// server was listening -- several of them spawn a process -- right on top of
// the window's own first load, which is a big part of why Prune felt slow and
// busy to open. They run once, one after another, HOUSEKEEPING_DELAY_MS after
// the server is up (scheduled in the listen callback below). Each is
// best-effort: one that cannot run is not a reason for the app not to start,
// and does not stop the ones after it.
const housekeeping = [
  // Whatever a clean started by Task Scheduler freed while Prune was closed is
  // added to the lifetime total now (once per run: see scheduledCleanReport.js).
  { name: 'scheduled clean report', run: () => ingestReport({ recordFreed }) },

  // An existing scheduled-clean task is put back in line with the schedule and
  // with where Prune is installed -- an update into a different folder would
  // otherwise leave it pointing at the old one. It never creates a task.
  // A failure just means the Settings switch shows the task as it really is.
  {
    name: 'scheduled clean task',
    run: async () => reconcileScheduledClean((await getSettings()).automation)
  },

  // The sign-in entry, if the person turned it on, follows Prune into a new
  // install folder. Never creates one.
  { name: 'start with Windows', run: () => repairStartWithWindows() },

  // The right-click menu entries, if the person turned them on, follow Prune into
  // a new install folder and into the app's language. Never creates one.
  { name: 'Explorer menu', run: () => repairExplorerMenu() },

  // A free-space wipe that was killed mid-run (power cut, crash, task kill)
  // leaves its zero-filled files on the drive, and until they are deleted the
  // drive is nearly full. They live in a folder of their own under a name only
  // the wipe uses, so removing them is safe and happens on every start.
  // The wipe can now target any local fixed drive, so the sweep looks in each
  // one's own Prune-wipe folder as well as the profile's. A drive list that
  // cannot be read just means only the profile's folder is swept this start.
  // (They are tried again on the next start.)
  {
    name: 'free-space wipe leftovers',
    run: async () => {
      const drives = await listFixedDrives().catch(() => []);
      const removed = await cleanupAllWipeLeftovers({ drives: drives.map((d) => d.drive) });
      if (removed.files > 0) console.log(`Removed ${removed.files} leftover free-space wipe files (${removed.bytes} bytes).`);
    }
  },

  // The quarantine's two limits, applied once on start.
  //
  // They are also applied every time a batch is created, which is the
  // moment either can be crossed. This covers the other case: a retention
  // window that expired while the app was closed. Without it, a machine
  // left off for a month would come back holding batches it was supposed to
  // have dropped weeks ago, and would keep them until the next uninstall.
  // It is a no-op when neither limit is set, which is the default.
  {
    name: 'quarantine limits',
    run: async () => {
      const result = await enforceQuarantineLimits(await getSettings());
      for (const batch of result.purged) {
        console.log(`Dropped quarantine backup for ${batch.programName} (${batch.reason}).`);
      }
    }
  },

  // Install-folder sizes that were shown from a day-old (or older) kept figure
  // are measured again now, last, so the next launch has the new numbers and the
  // walk that this replaces is not sitting on the window's first seconds.
  { name: 'program sizes refresh', run: () => refreshStaleSizes() }
];

// Real bug, found dogfooding (2026-08-29): a `server.listen()` failure
// (most commonly EADDRINUSE — something else, or a second copy of this
// same backend, already bound to the port) fires as an 'error' EVENT on
// the server object, not a promise rejection — the unhandledRejection
// handler above never sees it. With no listener here, Node's own default
// behavior for an unhandled EventEmitter 'error' is to throw, crashing
// the whole process instantly and silently (no stack trace reaches this
// file's own console.log/error calls in time). Inside Electron specifically
// this crashes the ENTIRE APP during startup — main.cjs's own
// `app.whenReady().then(...)` chain never reaches createWindow(), so no
// window, no diagnostic event, nothing — Electron's own native
// "a JavaScript error occurred" crash path is the only visible symptom,
// and Windows reports that crashed process's window title as bare
// "Error". Confirmed live: running a second, manually-started copy of
// this exact backend (e.g. for local curl testing) while also launching
// the packaged/dev Electron app reproduces this exactly, on demand, every
// time. A real end user would only ever hit this if something else on
// their machine is already using this port — rare, but "crashes the
// whole app with zero explanation" is the wrong failure mode regardless
// of how rare the trigger is.
// The installer's answer to "Check for updates", if it left one. Before
// the port opens, so the very first settings request after an install
// already sees it. A failure only means it is applied on the next start
// instead -- the file is kept when the save fails.
await applyInstallerChoices().catch((err) => {
  console.error("Could not apply the installer's choices:", err);
});

const server = createServer(app);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — is another copy of Prune (or its backend) already running? Close it and try again.`);
  } else {
    console.error('Backend server error:', err);
  }
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Prune backend listening on http://127.0.0.1:${PORT}`);
  scheduleHousekeeping(housekeeping, {
    delayMs: HOUSEKEEPING_DELAY_MS,
    onError: (name, err) => console.error(`Start-up housekeeping (${name}) failed:`, err?.message ?? err)
  });
  warmProgramSizes();
});

/** Program sizes are the one lookup the first screen needs: the Dashboard's
 * space breakdown and largest-programs list wait for them (the window asks
 * for them as soon as it opens), so they start now and the window's request
 * joins the same run instead of starting a second walk.
 *
 * Everything else the Applications screen decorates its rows with -- icons,
 * versions, install dates, Store apps, package icons -- used to be warmed here
 * too, which cost a PowerShell pass, ~90 executables and ~100 PNGs on top of
 * the window opening for a screen that may never be visited. Each is now
 * computed the first time the window asks (and shared if it asks twice at
 * once), which the window only does once Applications has been opened.
 *
 * The folder sizes are remembered between launches (see folderSizeStore.js),
 * so after the first launch of the day this is a registry read, not a walk
 * of the install folders. Fire-and-forget: a failure leaves the rows with
 * their blank and must never affect whether the backend starts. */
function warmProgramSizes() {
  getProgramSizes()
    .then((sizes) => console.log(`Measured ${Object.keys(sizes).length} install folders.`))
    .catch(() => { /* the rows keep their blank */ });
}

// trayManager.js's own initTray() is a guarded no-op outside a real
// Electron process (see its own doc comment), so this is safe in every
// runtime this file supports -- standalone `node src/index.js` and
// packaged/dev-Electron alike. It belongs here rather than in app.js for
// the same reason the listen and the scheduler do: it is about running
// the app, not about what the app serves, and a route test that
// constructed the tray would be reaching well outside its subject.
initTray();