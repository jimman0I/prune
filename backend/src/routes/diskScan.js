import { Router } from 'express';
import { scanDirectory } from '../services/diskScan.js';

const router = Router();

// Synchronous, blocking fs walk -- fine for the current scope (a real
// worker-thread/async-streaming version for very large scans is future
// work, same tradeoff diskScan.js's own DEFAULT_MAX_DEPTH comment notes).
router.get('/', (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'Missing required "path" query parameter.' });
  const result = scanDirectory(path);
  if (!result) return res.status(404).json({ error: `Could not read "${path}" -- it may not exist or may not be accessible.` });
  res.json(result);
});

export default router;
