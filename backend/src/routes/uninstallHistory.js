import { Router } from 'express';
import { getRecentHistory } from '../services/uninstallHistory.js';

const router = Router();

router.get('/', async (_req, res) => {
  const entries = await getRecentHistory(5);
  res.json({ entries });
});

export default router;