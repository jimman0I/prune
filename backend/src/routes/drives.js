import { Router } from 'express';
import { listDrives } from '../services/drives.js';

const router = Router();

/** The local drives the Disk Map can scan. Wrapped like every other async
 * handler in this app: Express 4 does not forward a rejected promise to the
 * error middleware, so an unwrapped failure would leave the request open. */
router.get('/', async (_req, res) => {
  try {
    res.json(await listDrives());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
