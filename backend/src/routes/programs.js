import { Router } from 'express';
import { listInstalledPrograms } from '../services/programs.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const programs = await listInstalledPrograms();
    res.json({ programs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;