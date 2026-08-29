import { Router } from 'express';
import { scanForLeftovers } from '../services/leftoverScan.js';

const router = Router();

router.post('/scan', async (req, res) => {
  const { name, publisher } = req.body || {};
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const result = await scanForLeftovers({ name, publisher });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;