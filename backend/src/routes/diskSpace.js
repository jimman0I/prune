import { Router } from 'express';
import { getSystemDriveSpace } from '../services/diskSpace.js';

const router = Router();

router.get('/', async (_req, res) => {
  // Wrapped like every other handler in this app. An async handler that
  // rejects does not reach the error middleware -- Express 4 forwards
  // only what a handler throws synchronously, which an async function
  // never does -- so without this the rejection escaped to process level
  // and the request was simply never answered. Confirmed by test: the
  // socket stayed open until the client gave up.
  try {
    const space = await getSystemDriveSpace();
    if (!space) return res.status(503).json({ error: 'Could not read disk space.' });
    res.json(space);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
