import { Router, text } from 'express';
import { installMonitor } from '../services/installMonitor.js';
import { listTraces, deleteTrace } from '../services/installTraces.js';
import { buildTraceFile, importTraceFile, TraceFileError, MAX_TRACE_FILE_BYTES } from '../services/installTraceFile.js';

const router = Router();

/** Install with monitoring.
 *
 * The body of /start names an installer by path and nothing else, and the
 * monitor validates it (an existing .exe or .msi). It is started through the
 * shell with the path in an environment variable. Everything here is POST
 * because it acts on the machine, and the status is a plain read. */
router.post('/start', async (req, res) => {
  try {
    await installMonitor.start({ installerPath: req.body?.installerPath });
    res.json(installMonitor.status());
  } catch (err) {
    const status = /already/i.test(err.message) ? 409
      : /full path|\.exe|\.msi|not a file|does not exist/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/session', (_req, res) => {
  res.json(installMonitor.status());
});

/** "Done installing". The comparison can take a minute, so the request is
 * answered at once with where the monitor is, and the page polls /session. */
router.post('/session/finish', (_req, res) => {
  installMonitor.finish();
  res.json(installMonitor.status());
});

router.post('/session/cancel', (_req, res) => {
  installMonitor.cancel();
  res.json(installMonitor.status());
});

router.get('/traces', async (_req, res) => {
  try {
    res.json({ traces: await listTraces() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Export: the whole `.prunetraces` file as JSON, for the window to save. The
 * window makes the file itself (lib/download.js), so nothing here writes to a
 * path the request names. */
router.get('/traces/export', async (_req, res) => {
  try {
    res.json(await buildTraceFile());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/traces/:id/export', async (req, res) => {
  try {
    const file = await buildTraceFile({ id: req.params.id });
    if (!file) { res.status(404).json({ error: 'There is no such install trace.' }); return; }
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Import: the file's text as the raw text/plain body, as Deep Clean's cleaner
 * import does -- the app-wide JSON parser stops at 100 KB, and the importer
 * checks the size again and trusts nothing in it (services/installTraceFile.js).
 * A file that is not a trace file at all is a 400 with a machine-readable
 * `code`; traces in it that do not pass are counted, not fatal. */
router.post('/traces/import', text({ type: '*/*', limit: `${MAX_TRACE_FILE_BYTES + 1024}` }), async (req, res) => {
  try {
    res.json(await importTraceFile(typeof req.body === 'string' ? req.body : ''));
  } catch (err) {
    if (err instanceof TraceFileError) { res.status(400).json({ error: err.message, code: err.code }); return; }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/traces/:id', async (req, res) => {
  try {
    if (!(await deleteTrace(req.params.id))) {
      res.status(404).json({ error: 'There is no such install trace.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
