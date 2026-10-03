import { Router } from 'express';
import { huntAtPoint, describeHunt, endHuntedProcess, validatePoint } from '../services/hunter.js';
import { listInstalledPrograms } from '../services/programs.js';
import { getStoreApps } from '../services/storeApps.js';
import { getStartupItems } from '../services/startupItems.js';

const router = Router();

/** Hunter, after the crosshair was dropped. The Electron main process sends
 * the screen point it read ({ x, y } in physical pixels, whole numbers) and
 * this answers what is there: { status: 'picked' | 'nothing' | 'unreadable' |
 * 'failed', ... }. A picked window comes back with the installed program it
 * belongs to and the startup entries that launch it.
 *
 * POST because it asks Windows something about the desktop; only x and y are
 * read from the body, and they are validated and bounded before they get
 * anywhere near a script. */
router.post('/at-point', async (req, res) => {
  const point = validatePoint(req.body);
  if (!point) {
    res.status(400).json({ error: 'x and y must be whole numbers within the screen.' });
    return;
  }
  try {
    const result = await huntAtPoint(point);
    if (result.status !== 'picked') { res.json(result); return; }
    // Read after the drop, not before: the lists are only needed for what was
    // actually picked, and they can take a few seconds.
    const [programs, storeApps, startupItems] = await Promise.all([
      listInstalledPrograms().catch(() => []),
      getStoreApps().catch(() => []),
      getStartupItems().catch(() => [])
    ]);
    res.json(describeHunt(result, { programs, storeApps, startupItems }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Ends the process Hunter named. The body carries the pid and the path it
 * was shown with; the service looks the pid up again and refuses if it is
 * Prune, Windows, or no longer that program. */
router.post('/end-process', async (req, res) => {
  const { pid, exePath } = req.body || {};
  try {
    const result = await endHuntedProcess({ pid, exePath });
    res.status(result.ok ? 200 : 409).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
