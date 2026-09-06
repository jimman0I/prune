import { createServer } from 'node:http';
import { createApp } from './app.js';
import { startScheduler, checkSchedule } from './services/scheduleRunner.js';
import { enforceQuarantineLimits } from './services/quarantineLimits.js';
import { getSettings } from './services/settings.js';
import { initTray } from './lib/trayManager.js';
import { getProgramIcons } from './services/programIcons.js';
import { getProgramSizes } from './services/programSizes.js';
import { getProgramVersions } from './services/programVersions.js';
import { getProgramInstallDates } from './services/installDates.js';
import { getStoreApps } from './services/storeApps.js';
import { getPackageIcons } from './services/packageIcons.js';

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
startScheduler();
checkSchedule().catch(() => { /* a failed check must never stop the server booting */ });

// The quarantine's two limits, applied once on start.
//
// They are also applied every time a batch is created, which is the
// moment either can be crossed. This covers the other case: a retention
// window that expired while the app was closed. Without it, a machine
// left off for a month would come back holding batches it was supposed to
// have dropped weeks ago, and would keep them until the next uninstall.
//
// Fire-and-forget, like checkSchedule above, and for the same reason: a
// housekeeping pass that cannot run is not a reason for the app not to
// start. It is a no-op when neither limit is set, which is the default.
getSettings()
  .then((settings) => enforceQuarantineLimits(settings))
  .then((result) => {
    for (const batch of result.purged) {
      console.log(`Dropped quarantine backup for ${batch.programName} (${batch.reason}).`);
    }
  })
  .catch(() => { /* the backups simply stay until the next attempt */ });

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
  warmProgramIcons();
  warmProgramSizes();
  warmProgramVersions();
  warmInstallDates();
  warmStoreApps();
  warmPackageIcons();
});

/** Extracts every program's icon in the background as soon as the server
 * is up, so the Application Manager has them the moment it opens instead
 * of popping them in a second or two later.
 *
 * It reads ~90 executables and takes about two seconds, which is exactly
 * why it shouldn't happen when someone clicks the tab. Fire-and-forget:
 * the cache inside programIcons.js is the point, the return value is
 * discarded, and a failure is swallowed because icons are decoration and
 * must never affect whether the backend starts. */
function warmProgramIcons() {
  getProgramIcons()
    .then((icons) => console.log(`Prepared ${Object.keys(icons).length} program icons.`))
    .catch(() => { /* decoration only */ });
}

/** Same idea for the sizes 40 of the 130 registry entries simply don't
 * record. Measuring their install folders means walking ~124 GB, about
 * thirteen seconds -- worth starting now rather than when someone opens
 * the list and waits for numbers to appear. */
function warmProgramSizes() {
  getProgramSizes()
    .then((sizes) => console.log(`Measured ${Object.keys(sizes).length} install folders.`))
    .catch(() => { /* the rows keep their blank */ });
}

/** And the versions the other 15 entries don't record either. Reading
 * resource tables is quick -- under two seconds -- but it has to find the
 * right binary first, and that means opening install folders. Same deal
 * as the other two: better now than when someone clicks the tab. */
function warmProgramVersions() {
  getProgramVersions()
    .then((versions) => console.log(`Read ${Object.keys(versions).length} versions from program binaries.`))
    .catch(() => { /* the rows keep their blank */ });
}

/** And the install dates two thirds of the entries never declared. Opening
 * every uninstall key in three hives takes about a second and a half --
 * better spent now than when someone opens the list. */
function warmInstallDates() {
  getProgramInstallDates()
    .then((dates) => console.log(`Recovered ${Object.keys(dates).length} install dates from key write times.`))
    .catch(() => { /* the rows keep their blank */ });
}

/** And the Store apps, which the registry never mentions. Enumerating and
 * measuring 81 packages takes about five seconds -- the same argument as
 * the others for doing it before anyone asks. */
function warmStoreApps() {
  getStoreApps()
    .then((apps) => console.log(`Found ${apps.length} Microsoft Store apps.`))
    .catch(() => { /* the list still shows every registry program */ });
}

/** And the icons for those Store apps and the browser extensions. Reading
 * a hundred small PNGs out of package folders takes a few seconds, and
 * the rows look unfinished without them. */
function warmPackageIcons() {
  getPackageIcons()
    .then((icons) => console.log(`Read ${Object.keys(icons).length} package icons.`))
    .catch(() => { /* decoration only */ });
}

// trayManager.js's own initTray() is a guarded no-op outside a real
// Electron process (see its own doc comment), so this is safe in every
// runtime this file supports -- standalone `node src/index.js` and
// packaged/dev-Electron alike. It belongs here rather than in app.js for
// the same reason the listen and the scheduler do: it is about running
// the app, not about what the app serves, and a route test that
// constructed the tray would be reaching well outside its subject.
initTray();