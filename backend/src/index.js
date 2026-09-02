import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import programsRoutes from './routes/programs.js';
import uninstallRoutes from './routes/uninstall.js';
import leftoversRoutes from './routes/leftovers.js';
import quarantineRoutes from './routes/quarantine.js';
import diskSpaceRoutes from './routes/diskSpace.js';
import uninstallHistoryRoutes from './routes/uninstallHistory.js';
import diskScanRoutes from './routes/diskScan.js';
import { scanRouter as cleanupScanRoutes, executeRouter as cleanupExecuteRoutes } from './routes/cleanup.js';
import settingsRoutes from './routes/settings.js';
import sandboxTestRoutes from './routes/sandboxTest.js';
import deepCleanRoutes from './routes/deepClean.js';
import diskHealthRoutes from './routes/diskHealth.js';
import forcedUninstallRoutes from './routes/forcedUninstall.js';
import mftScanRoutes from './routes/mftScan.js';
import fileIconsRoutes from './routes/fileIcons.js';
import { initTray } from './lib/trayManager.js';
import { getProgramIcons } from './services/programIcons.js';
import { getProgramSizes } from './services/programSizes.js';

const PORT = process.env.UNREVO_BACKEND_PORT || 3101;

// A rejection escaping every route's own try/catch would otherwise crash
// the whole process — this is loaded in-process inside Electron's main
// process (see electron/main.cjs), so a crash here takes the whole app
// down, not just a request.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/programs', programsRoutes);
app.use('/api/uninstall', uninstallRoutes);
app.use('/api/leftovers', leftoversRoutes);
app.use('/api/quarantine', quarantineRoutes);
app.use('/api/disk-space', diskSpaceRoutes);
app.use('/api/uninstall-history', uninstallHistoryRoutes);
app.use('/api/disk-scan', diskScanRoutes);
app.use('/api/cleanup-scan', cleanupScanRoutes);
app.use('/api/cleanup-execute', cleanupExecuteRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sandbox-test', sandboxTestRoutes);
app.use('/api/deep-clean', deepCleanRoutes);
app.use('/api/disk-health', diskHealthRoutes);
app.use('/api/forced-uninstall', forcedUninstallRoutes);
app.use('/api/mft-scan', mftScanRoutes);
app.use('/api/file-icons', fileIconsRoutes);

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

// v2.0 Phase 1: this is the one line in this file that isn't a route
// mount. trayManager.js's own initTray() is a guarded no-op outside a
// real Electron process (see its own doc comment), so this is safe in
// every runtime this file supports -- standalone `node src/index.js`,
// `vitest run`, and packaged/dev-Electron alike. There's no automation.js
// route yet to trigger this as an import side effect (that's a later
// Phase 2 mission), and electron/main.cjs -- the only other place that
// could call it -- is locked for this feature, so this direct call is
// the only place left.
initTray();