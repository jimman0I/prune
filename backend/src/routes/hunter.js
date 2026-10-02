import { Router } from 'express';
import { startHunt, cancelHunt, describeHunt, endHuntedProcess } from '../services/hunter.js';
import { listInstalledPrograms } from '../services/programs.js';
import { getStoreApps } from '../services/storeApps.js';
import { getStartupItems } from '../services/startupItems.js';

const router = Router();

/** Hunter mode. The request stays open while the person looks for a window
 * (about thirty seconds at most) and answers with what they clicked:
 * { status: 'picked' | 'cancelled' | 'timeout' | 'failed', ... }. A picked
 * window comes back with the installed program it belongs to and the startup
 * entries that launch it. POST because a hunt acts on the desktop. */
router.post('/start', async (_req, res) => {
  try {
    const result = await startHunt();
    if (result.status !== 'picked') { res.json(result); return; }
    // Read after the click, not before: the lists are only needed for what
    // was actually picked, and they can take a few seconds.
    const [programs, storeApps, startupItems] = await Promise.all([
      listInstalledPrograms().catch(() => []),
      getStoreApps().catch(() => []),
      getStartupItems().catch(() => [])
    ]);
    res.json(describeHunt(result, { programs, storeApps, startupItems }));
  } catch (err) {
    res.status(/already running/i.test(err.message) ? 409 : 500).json({ error: err.message });
  }
});

router.post('/cancel', (_req, res) => {
  res.json({ cancelled: cancelHunt() });
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
