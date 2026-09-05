import { Router } from 'express';
import { findDuplicates } from '../services/duplicateScan.js';
import { getSettings } from '../services/settings.js';
import { protectionReason } from '../services/pathGuard.js';

const router = Router();

/** How long one duplicate scan may run before it is cut off.
 *
 * The same shape as the disk scan's budget and for the same reason: this
 * shares one Node process with every other route, and a scan nobody
 * bounded is a scan that can make the whole app unresponsive. A truncated
 * answer that says it is truncated is better than a complete one nobody
 * waited for. */
const SCAN_TIMEOUT_MS = 120_000;

/** Duplicate files under one folder.
 *
 * A folder, never a whole drive by default. Hashing is the expensive part
 * and the honest scope for it is somewhere the user chose -- Downloads, a
 * projects folder, a photo library. Pointing it at C:\ is possible and is
 * the user's decision to make; it is not the default.
 */
router.get('/', async (req, res) => {
  const path = req.query.path;
  if (typeof path !== 'string' || !path.trim()) {
    return res.status(400).json({ error: 'A folder to search is required.' });
  }

  // The same guard the Disk Map's removal uses, for a different reason:
  // not because this deletes anything -- it does not -- but because a
  // scan rooted at a drive root or in Windows is a scan that will spend
  // two minutes and find nothing anyone should act on.
  const refusal = protectionReason(path);
  if (refusal) return res.status(400).json({ error: refusal, protected: true });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  // The client going away stops the work. Without this a user who closes
  // the tab leaves a hashing loop running against their disk.
  req.on('close', () => controller.abort());

  try {
    const settings = await getSettings();
    const result = await findDuplicates(path, {
      signal: controller.signal,
      exclusions: {
        excludeFolders: settings.excludeFolders,
        excludeExtensions: settings.excludeExtensions
      }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
