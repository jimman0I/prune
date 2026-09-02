import { Router } from 'express';
import { scanForcedUninstall } from '../services/forcedUninstall.js';

const router = Router();

/** POST, not GET: the scan takes a body (name, publisher, registry key)
 * rather than a query string, and putting a program name and registry path
 * in a URL would also log them. It changes nothing on disk -- removal is
 * POST /api/quarantine/remove, which already exists and makes a restore
 * point first. */
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

export default router;
