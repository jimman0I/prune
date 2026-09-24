import { Router } from 'express';
import { scanDirectory, DEFAULT_MAX_DEPTH } from '../services/diskScan.js';
import { getSettings } from '../services/settings.js';
import { getSystemDriveSpace } from '../services/diskSpace.js';
import { scanPercent } from '../lib/scanPercent.js';
import { putScanResult, getScanResult } from '../lib/scanResults.js';

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
// Shared by GET / and GET /stream so both routes have one deadline.
const SCAN_TIMEOUT_MS = 30_000;

// How often /stream reports progress. An interval, not per file: a
// 3-million-file walk would otherwise emit millions of events.
const PROGRESS_INTERVAL_MS = 200;

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** True for a bare drive root on the system drive ("C:", "C:\", "c:/").
 * Only there does a real "bytes in use" figure exist (getSystemDriveSpace
 * reports C: only), so only there can a percent be honest. */
function isSystemDriveRoot(path) {
  return /^[cC]:[\\/]*$/.test(String(path).trim());
}

/** Bytes in use on C:, or null on any failure. Never a guess. */
async function systemDriveInUseBytes() {
  try {
    const space = await getSystemDriveSpace();
    if (!space) return null;
    const inUse = space.totalBytes - space.freeBytes;
    return Number.isFinite(inUse) && inUse > 0 ? inUse : null;
  } catch {
    return null;
  }
}

/** The same scan as GET /, streamed as SSE: `progress` events on an interval
 * while walking, then `complete` (counts and a resultId, NOT the tree) or
 * `error`. The tree itself is fetched from GET /result/:id: on a big drive
 * it is tens of MB, which would make one enormous SSE line. */
router.get('/stream', async (req, res) => {
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'Missing required "path" query parameter.' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  // The deadline the abort above enforces, so the client can count down to
  // the true stopping point instead of duplicating the constant.
  const deadline = Date.now() + SCAN_TIMEOUT_MS;
  let clientGone = false;
  req.on('close', () => { clientGone = true; controller.abort(); });

  let files = 0;
  let bytes = 0;
  // Resolved alongside the walk so the scan does not wait on PowerShell.
  // Stays null (=> percent null) for any path but the C: root, or on failure.
  let inUseBytes = null;
  if (isSystemDriveRoot(path)) {
    systemDriveInUseBytes().then((v) => { inUseBytes = v; });
  }

  const ticker = setInterval(() => {
    sendEvent(res, 'progress', {
      type: 'progress',
      files,
      bytes,
      percent: scanPercent(bytes, inUseBytes),
      // Time until the walk is forcibly stopped: an UPPER BOUND on what is
      // left, since a scan that finishes sooner simply ends.
      remainingMs: Math.max(0, deadline - Date.now())
    });
  }, PROGRESS_INTERVAL_MS);

  try {
    const settings = await getSettings();
    const result = await scanDirectory(path, DEFAULT_MAX_DEPTH, controller.signal, {
      excludeFolders: settings.excludeFolders,
      excludeExtensions: settings.excludeExtensions
    }, (size) => { files += 1; bytes += size; });

    clearInterval(ticker);
    if (clientGone) return;

    if (!result) {
      const message = controller.signal.aborted
        ? `Scanning "${path}" took too long (over ${SCAN_TIMEOUT_MS / 1000}s) and was stopped before any result was ready.`
        : `Could not read "${path}" -- it may not exist or may not be accessible.`;
      sendEvent(res, 'error', { type: 'error', message });
      return;
    }

    const truncated = controller.signal.aborted;
    const resultId = putScanResult({ ...result, truncated });
    sendEvent(res, 'complete', { type: 'complete', totalFiles: files, totalBytes: bytes, truncated, resultId });
  } catch (err) {
    if (!clientGone) sendEvent(res, 'error', { type: 'error', message: err.message });
  } finally {
    clearInterval(ticker);
    clearTimeout(timeout);
    res.end();
  }
});

/** The finished tree from a completed /stream scan, as ordinary JSON in the
 * same shape as GET /'s body. */
router.get('/result/:id', (req, res) => {
  const tree = getScanResult(req.params.id);
  if (!tree) return res.status(404).json({ error: 'That scan result is not available (it may have expired). Scan again.' });
  res.json(tree);
});

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
