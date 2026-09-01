import { Router } from 'express';
import { scanAllRules, executeRules } from '../lib/cleanerRules.js';

const router = Router();

router.get('/scan', (req, res) => {
  try {
    res.json({ categories: scanAllRules() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  const { ruleIds } = req.body || {};
  if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
    res.status(400).json({ error: 'ruleIds (a non-empty array) is required' });
    return;
  }
  try {
    res.json(await executeRules(ruleIds));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
