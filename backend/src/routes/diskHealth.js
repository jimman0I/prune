import { Router } from 'express';
import { getDiskHealth } from '../services/diskHealth.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const health = await getDiskHealth();
    if (!health) { res.status(503).json({ error: 'Disk health is unavailable on this machine.' }); return; }
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
