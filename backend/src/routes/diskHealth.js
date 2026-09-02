import { Router } from 'express';
import { getDiskHealth, getElevatedDiskHealth } from '../services/diskHealth.js';

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

// POST, not GET: this raises a UAC consent dialog, which is a side effect
// and must never be something a page load or a refresh can trigger on its
// own. Only a button the user actually pressed reaches this.
router.post('/elevated', async (req, res) => {
  try {
    const result = await getElevatedDiskHealth();
    // A declined prompt is a 200 with { cancelled: true } -- the request
    // did exactly what it was asked to; the user simply said no.
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
