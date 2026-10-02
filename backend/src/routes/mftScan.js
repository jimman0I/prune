import { Router } from 'express';
import { scanDrivesViaMft } from '../services/mftScan.js';
import { DEFAULT_MAX_DEPTH } from '../services/diskScan.js';

const router = Router();

/** The drive letters a request names: `driveLetters: ['C', 'D']`, or the
 * older single `driveLetter`. Returns null when any entry is not one ASCII
 * letter -- this ends up in a raw device path, so nothing is "cleaned up"
 * into a different drive than the one that was asked for. */
function lettersFrom(body) {
  const raw = Array.isArray(body.driveLetters)
    ? body.driveLetters
    : [body.driveLetter === undefined ? 'C' : body.driveLetter];
  if (raw.length === 0 || raw.length > 26) return null;
  if (!raw.every((l) => /^[a-z]$/i.test(String(l)))) return null;
  return [...new Set(raw.map((l) => String(l).toUpperCase()))];
}

/** POST because it raises a UAC prompt, exactly like /disk-health/elevated.
 * That's not a REST technicality -- a GET is something a browser, a
 * prefetch, or a retry can perform on its own, and nothing that pops a
 * consent dialog should be reachable that way. */
router.post('/', async (req, res) => {
  const body = req.body || {};
  const { maxDepth = DEFAULT_MAX_DEPTH } = body;

  const driveLetters = lettersFrom(body);
  if (!driveLetters) {
    return res.status(400).json({ error: 'driveLetters must be single letters.' });
  }

  // Wrapped like every other handler in this app. scanDrivesViaMft reports
  // an expected failure through result.ok, but it can still reject --
  // spawning an elevated process has its own ways to go wrong -- and an
  // async handler's rejection does not reach the error middleware, since
  // Express 4 forwards only what a handler throws synchronously. Without
  // this the request was never answered at all, which from the Disk Map
  // is indistinguishable from a scan still running.
  try {
    const result = await scanDrivesViaMft({ driveLetters, maxDepth });

    // A declined prompt is a 200 carrying { cancelled: true }, not an
    // error status: the user answered the question, and the answer was
    // no. Same convention /disk-health/elevated already uses.
    if (!result.ok) {
      if (result.cancelled) return res.json({ cancelled: true });
      return res.status(500).json({ error: result.error });
    }

    res.json({
      drives: result.drives,
      tree: result.tree,
      stats: result.stats,
      driveLetter: result.driveLetter
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
