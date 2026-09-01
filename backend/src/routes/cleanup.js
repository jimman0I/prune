import { Router } from 'express';
import { scanJunk, executeCleanup } from '../services/cleanup.js';

const scanRouter = Router();
scanRouter.get('/', async (req, res) => {
  try {
    res.json(await scanJunk());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const executeRouter = Router();
executeRouter.post('/', async (req, res) => {
  const { categoryIds } = req.body || {};
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    res.status(400).json({ error: 'categoryIds (a non-empty array) is required' });
    return;
  }
  try {
    res.json(await executeCleanup(categoryIds));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { scanRouter, executeRouter };
