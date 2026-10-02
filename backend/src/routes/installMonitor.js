import { Router } from 'express';
import { installMonitor } from '../services/installMonitor.js';
import { listTraces, deleteTrace } from '../services/installTraces.js';

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
