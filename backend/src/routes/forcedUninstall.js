import { Router } from 'express';
import { scanForcedUninstall, executeForcedUninstall } from '../services/forcedUninstall.js';

const router = Router();

/** Both are POST: the scan takes a body (name, publisher, registry key)
 * rather than a query string, and putting a program name and registry path
 * in a URL would also log them. Neither changes anything on disk until
 * /execute is called. */
router.post('/scan', async (req, res) => {
  const { name, publisher, registryKey } = req.body || {};
  try {
    res.json(await scanForcedUninstall({ name, publisher, registryKey }));
  } catch (err) {
    // A missing name is the caller's mistake, not a server fault.
    const status = /required/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  const { name, files, registryKeys } = req.body || {};
  try {
    res.json(await executeForcedUninstall({ name, files, registryKeys }));
  } catch (err) {
    const status = /required|selected/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
