import { Router } from 'express';
import { getSettings } from '../services/settings.js';
import { findLowDrives } from '../services/lowDisk.js';
import { normalizeLowDiskPercent } from '../lib/lowDiskChoices.js';

/** GET /api/low-disk -- the local drives that are short of room, for the
 * Dashboard banner: { percent, drives: [{ drive, label, freeBytes, totalBytes,
 * percentFree }] }.
 *
 * The share comes from Settings, never from the request, and 0 (Off) answers
 * without touching a disk. Cheap by design (see services/lowDisk.js) because the
 * Dashboard asks every few minutes. */
const router = Router();

router.get('/', async (req, res) => {
  try {
    const percent = normalizeLowDiskPercent((await getSettings()).lowDiskWarning);
    res.json({ percent, drives: await findLowDrives({ percent }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
