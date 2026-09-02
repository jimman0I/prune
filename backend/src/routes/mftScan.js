import { Router } from 'express';
import { scanDriveViaMft } from '../services/mftScan.js';
import { DEFAULT_MAX_DEPTH } from '../services/diskScan.js';

const router = Router();

/** POST because it raises a UAC prompt, exactly like /disk-health/elevated.
 * That's not a REST technicality -- a GET is something a browser, a
 * prefetch, or a retry can perform on its own, and nothing that pops a
 * consent dialog should be reachable that way. */
router.post('/', async (req, res) => {
  const { driveLetter = 'C', maxDepth = DEFAULT_MAX_DEPTH } = req.body || {};

  if (!/^[a-z]$/i.test(String(driveLetter))) {
    return res.status(400).json({ error: 'driveLetter must be a single letter.' });
  }

  const result = await scanDriveViaMft({ driveLetter, maxDepth });

  // A declined prompt is a 200 carrying { cancelled: true }, not an error
  // status: the user answered the question, and the answer was no. Same
  // convention /disk-health/elevated already uses.
  if (!result.ok) {
    if (result.cancelled) return res.json({ cancelled: true });
    return res.status(500).json({ error: result.error });
  }

  res.json({ tree: result.tree, stats: result.stats, driveLetter: result.driveLetter });
});

export default router;
