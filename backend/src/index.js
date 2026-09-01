import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import programsRoutes from './routes/programs.js';
import uninstallRoutes from './routes/uninstall.js';
import leftoversRoutes from './routes/leftovers.js';
import quarantineRoutes from './routes/quarantine.js';
import diskSpaceRoutes from './routes/diskSpace.js';
import uninstallHistoryRoutes from './routes/uninstallHistory.js';

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
    console.error(`Port ${PORT} is already in use — is another copy of unrevo (or its backend) already running? Close it and try again.`);
  } else {
    console.error('Backend server error:', err);
  }
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`unrevo backend listening on http://127.0.0.1:${PORT}`);
});