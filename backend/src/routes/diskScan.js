import { Router } from 'express';
import { scanDirectory, DEFAULT_MAX_DEPTH } from '../services/diskScan.js';
import { getSettings } from '../services/settings.js';

const router = Router();

// Real bug, found dogfooding (2026-09-01): scanning a genuinely large root
// (a full "C:\") pegged the backend at ~100% CPU and made the ENTIRE
// process unresponsive for the whole scan -- every other route queued
// behind it, the UI hung. Root cause was two-fold: the walk was fully
// synchronous (fixed in diskScan.js -- fs.promises + a real `await` at
// every I/O point, which is what actually lets other requests interleave),
// AND depth-capping only bounded the RESPONSE tree, not the walk itself --
// an accurate total for a huge subtree still means visiting every file in
// it, no matter how shallow the returned JSON is. This timeout is the real
// bound on that second half: a scan that's taking too long is stopped
// cleanly rather than left to run indefinitely, per the same reasoning
// as WAR_ROOM_PHASE_TIMEOUT_MS in triclaude-web's own warRoom.js.
const SCAN_TIMEOUT_MS = 30_000;

router.get('/', async (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'Missing required "path" query parameter.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  // Also stop scanning if the client disconnects (navigated off the Disk
  // Map screen, closed the tab) before a response was ever sent -- no point
  // burning I/O on an answer nobody's waiting for. Fires on normal
  // completion too, but aborting an already-settled scan is a harmless
  // no-op by then.
  req.on('close', () => controller.abort());

  try {
    // The user's own exclusions, read per scan rather than cached: they
    // are edited on the Settings screen and a stale copy would show a
    // folder the user has just told the app to ignore.
    const settings = await getSettings();
    const result = await scanDirectory(path, DEFAULT_MAX_DEPTH, controller.signal, {
      excludeFolders: settings.excludeFolders,
      excludeExtensions: settings.excludeExtensions
    });
    if (!result) {
      if (controller.signal.aborted) {
        return res.status(504).json({
          error: `Scanning "${path}" took too long (over ${SCAN_TIMEOUT_MS / 1000}s) and was stopped before any result was ready.`
        });
      }
      return res.status(404).json({ error: `Could not read "${path}" -- it may not exist or may not be accessible.` });
    }
    // `truncated` tells the caller whether the timeout cut this scan short
    // -- when true, `size` totals are a real but possibly INCOMPLETE lower
    // bound (whatever was actually visited before the deadline), not
    // guaranteed-accurate the way an untruncated scan's totals are.
    res.json({ ...result, truncated: controller.signal.aborted });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
