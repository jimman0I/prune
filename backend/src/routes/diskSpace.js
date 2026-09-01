import { Router } from 'express';
import { getSystemDriveSpace } from '../services/diskSpace.js';

const router = Router();

router.get('/', async (_req, res) => {
  const space = await getSystemDriveSpace();
  if (!space) return res.status(503).json({ error: 'Could not read disk space.' });
  res.json(space);
});

export default router;