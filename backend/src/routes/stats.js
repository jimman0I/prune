import { Router } from 'express';
import { getStats } from '../services/stats.js';

/** GET /api/stats -- the lifetime total behind the Dashboard's quiet
 * "Prune has freed X since <date>" line. Read-only: the only things that
 * change it are the removals themselves, in the backend (see
 * services/stats.js). Nothing a client sends can raise it. */
const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json(await getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
