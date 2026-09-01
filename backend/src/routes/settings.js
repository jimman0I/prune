import { Router } from 'express';
import { getSettings, updateSettings } from '../services/settings.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    res.json(await updateSettings(req.body || {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
