import { Router } from 'express';
import { getRecentHistory, appendHistoryEntry } from '../services/uninstallHistory.js';

const router = Router();

router.get('/', async (_req, res) => {
  const entries = await getRecentHistory(5);
  res.json({ entries });
});

router.post('/', async (req, res) => {
  const { programName, publisher, sizeBytes } = req.body;
  if (!programName) return res.status(400).json({ error: 'programName is required.' });
  await appendHistoryEntry({ programName, publisher, sizeBytes });
  res.json({ ok: true });
});
export default router;