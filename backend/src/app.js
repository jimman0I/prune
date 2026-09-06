/** The Express app, built but not listening.
 *
 * Split out of index.js so the routes can be tested. Importing index.js
 * binds port 3101 and starts the scheduler -- which in a test means
 * colliding with the running app and, worse, potentially firing a real
 * scheduled clean. Constructing the app has to be free of both.
 *
 * The port is a parameter rather than a module constant because the
 * localOnly guard checks the Host header against it: a test listening on
 * an ephemeral port must be able to tell the guard which port is
 * legitimately its own, or every request it makes is a 403.
 */
import express from 'express';
import cors from 'cors';
import { localOnly } from './lib/localOnly.js';
import { jsonErrors, notFound } from './lib/jsonErrors.js';
import programsRoutes from './routes/programs.js';
import uninstallRoutes from './routes/uninstall.js';
import leftoversRoutes from './routes/leftovers.js';
import quarantineRoutes from './routes/quarantine.js';
import duplicateRoutes from './routes/duplicates.js';
import automationRoutes from './routes/automation.js';
import resourceRoutes from './routes/resources.js';
import diskSpaceRoutes from './routes/diskSpace.js';
import uninstallHistoryRoutes from './routes/uninstallHistory.js';
import diskScanRoutes from './routes/diskScan.js';
import settingsRoutes from './routes/settings.js';
import sandboxTestRoutes from './routes/sandboxTest.js';
import deepCleanRoutes from './routes/deepClean.js';
import diskHealthRoutes from './routes/diskHealth.js';
import forcedUninstallRoutes from './routes/forcedUninstall.js';
import mftScanRoutes from './routes/mftScan.js';
import fileIconsRoutes from './routes/fileIcons.js';

export function createApp({ port } = {}) {
  const app = express();

  /** Only Prune's own window may call this API.
   *
   * Listening on 127.0.0.1 is not the protection it sounds like -- every
   * web page the user has open can reach loopback too. This server used to
   * send `Access-Control-Allow-Origin: *` and check nothing, so any site
   * the user was browsing could read their installed programs, toggle
   * startup entries, run a Deep Clean, move a folder through
   * /quarantine/path, or empty the quarantine and destroy every undo the
   * app holds. See lib/localOnly.js.
   *
   * Before express.json(), so a refused request is rejected on its headers
   * and its body is never parsed. */
  app.use(localOnly(port));

  /** CORS with an explicit reflector rather than a wildcard.
   *
   * localOnly has already refused anything untrusted by this point, so this
   * only ever answers Prune's own window -- but a wildcard header would
   * still be a standing invitation, and the preflight has to succeed for
   * the app's own POSTs to work. */
  app.use(cors({
    origin: (origin, callback) => callback(null, origin || true),
    credentials: false
  }));

  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/programs', programsRoutes);
  app.use('/api/uninstall', uninstallRoutes);
  app.use('/api/leftovers', leftoversRoutes);
  app.use('/api/quarantine', quarantineRoutes);
  app.use('/api/duplicates', duplicateRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/disk-space', diskSpaceRoutes);
  app.use('/api/uninstall-history', uninstallHistoryRoutes);
  app.use('/api/disk-scan', diskScanRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/sandbox-test', sandboxTestRoutes);
  app.use('/api/deep-clean', deepCleanRoutes);
  app.use('/api/disk-health', diskHealthRoutes);
  app.use('/api/forced-uninstall', forcedUninstallRoutes);
  app.use('/api/mft-scan', mftScanRoutes);
  app.use('/api/file-icons', fileIconsRoutes);

  /** Anything still unanswered is a path this app does not serve. After
   * every route, so it can only see what none of them matched. */
  app.use(notFound());

  /** Last, because an Express error handler only sees what was raised by
   * middleware mounted before it. See lib/jsonErrors.js -- without this,
   * a truncated POST body got an HTML page containing a stack trace and
   * this machine's filesystem paths. */
  app.use(jsonErrors());

  return app;
}
