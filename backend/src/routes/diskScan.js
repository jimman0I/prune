import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { scanDirectory, DEFAULT_MAX_DEPTH } from '../services/diskScan.js';
import { getSettings } from '../services/settings.js';
import { getDriveSpace, getSystemDriveSpace } from '../services/diskSpace.js';
import { scanPercent } from '../lib/scanPercent.js';
import { putScanResult, getScanResult } from '../lib/scanResults.js';
import { createLiveTree, relativeSegments } from '../lib/liveTree.js';

const router = Router();

/** Scans that are running right now, by the id announced in their `start`
 * event, so POST /stop/:id can reach the right AbortController. Removed in
 * the stream's `finally`, so a finished scan can no longer be stopped. */
const runningScans = new Map();

// Real bug, found dogfooding (2026-09-01): scanning a genuinely large root
// (a full "C:\") pegged the backend at ~100% CPU and made the ENTIRE
// process unresponsive for the whole scan -- every other route queued
// behind it, the UI hung. Root cause was two-fold: the walk was fully
// synchronous (fixed in diskScan.js -- fs.promises + a real `await` at
// every I/O point, which is what actually lets other requests interleave),
// AND depth-capping only bounded the RESPONSE tree, not the walk itself.
//
// The second half was answered with a 30-second hard stop. That fixed the
// freeze and created a worse problem: a walk of a whole drive reached about
// four percent of it and then ended, so the "default" experience was a
// picture that was 96% unknown. The streamed scan no longer has a deadline.
// It runs until it finishes or the user presses Stop, shows what it has read
// as it goes (below), and the freeze stays fixed because that was the
// walk's own awaits, not the clock.
//
// The plain GET / still has this limit: it is one request that returns one
// tree at the end, so it has nothing to show while it runs and no Stop.
const SCAN_TIMEOUT_MS = 30_000;

// How often /stream reports progress. An interval, not per file: a
// 3-million-file walk would otherwise emit millions of events.
const PROGRESS_INTERVAL_MS = 200;

// How often a progress event also carries a picture of what has been read so
// far. Bigger than a progress tick: it is hundreds of kilobytes, not bytes.
const SNAPSHOT_INTERVAL_MS = 1500;

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** The drive letter when `path` is a bare drive root ("C:", "C:\", "d:/"),
 * else null. Only there does a real "bytes in use" figure exist, so only
 * there can a percent be honest. */
function driveRootLetter(path) {
  const match = /^([a-z]):[\\/]*$/i.exec(String(path).trim());
  return match ? match[1].toUpperCase() : null;
}

/** Bytes in use on a drive, or null on any failure. Never a guess. */
async function driveInUseBytes(letter) {
  try {
    const space = letter === 'C' ? await getSystemDriveSpace() : await getDriveSpace(letter);
    if (!space) return null;
    const inUse = space.totalBytes - space.freeBytes;
    return Number.isFinite(inUse) && inUse > 0 ? inUse : null;
  } catch {
    return null;
  }
}

/** The same scan as GET /, streamed as SSE: `progress` events on an interval
 * while walking (carrying a `snapshot` of what has been read so far every
 * second or so), then `complete` (counts and a resultId, NOT the tree) or
 * `error`. The tree itself is fetched from GET /result/:id: on a big drive it
 * is tens of MB, which would make one enormous SSE line. */
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
  let clientGone = false;
  let stoppedByUser = false;
  req.on('close', () => { clientGone = true; controller.abort(); });

  const scanId = randomUUID();
  runningScans.set(scanId, () => { stoppedByUser = true; controller.abort(); });
  // First thing on the wire, so the client can offer Stop straight away.
  sendEvent(res, 'start', { type: 'start', scanId });

  let files = 0;
  let bytes = 0;
  // Resolved alongside the walk so the scan does not wait on PowerShell.
  // Stays null (=> percent null) for any path but a drive root, or on failure.
  let inUseBytes = null;
  const rootLetter = driveRootLetter(path);
  if (rootLetter) {
    driveInUseBytes(rootLetter).then((v) => { inUseBytes = v; });
  }

  // What has been read so far, as a small tree. Only worth keeping for a path
  // the walk can name segments under; a single file has nothing to show.
  const live = createLiveTree(String(path).replace(/[\\/]+$/, '') || String(path));
  let lastSnapshotAt = 0;
  let snapshotDirty = false;

  const ticker = setInterval(() => {
    const event = {
      type: 'progress',
      files,
      bytes,
      percent: scanPercent(bytes, inUseBytes)
    };
    const now = Date.now();
    if (snapshotDirty && now - lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
      event.snapshot = live.snapshot();
      lastSnapshotAt = now;
      snapshotDirty = false;
    }
    sendEvent(res, 'progress', event);
  }, PROGRESS_INTERVAL_MS);

  try {
    const settings = await getSettings();
    const result = await scanDirectory(path, DEFAULT_MAX_DEPTH, controller.signal, {
      excludeFolders: settings.excludeFolders,
      excludeExtensions: settings.excludeExtensions
    }, (size, info) => {
      files += 1;
      bytes += size;
      if (info?.path) {
        const segments = relativeSegments(path, info.path);
        if (segments && segments.length > 0) {
          live.add(segments, size, info.allocated ?? 0);
          snapshotDirty = true;
        }
      }
    });

    clearInterval(ticker);
    if (clientGone) return;

    if (!result) {
      const message = stoppedByUser
        ? `The scan of "${path}" was stopped before any result was ready.`
        : `Could not read "${path}" -- it may not exist or may not be accessible.`;
      sendEvent(res, 'error', { type: 'error', message });
      return;
    }

    // Only ever true when the user pressed Stop: the walk has no deadline.
    const truncated = controller.signal.aborted;
    const resultId = putScanResult({ ...result, truncated });
    sendEvent(res, 'complete', { type: 'complete', totalFiles: files, totalBytes: bytes, truncated, stoppedByUser, resultId });
  } catch (err) {
    if (!clientGone) sendEvent(res, 'error', { type: 'error', message: err.message });
  } finally {
    runningScans.delete(scanId);
    clearInterval(ticker);
    res.end();
  }
});

/** Asks a running /stream scan to stop. The walk already answers an abort
 * with the partial tree it has so far (flagged `truncated`), so the stream
 * simply carries on to its normal `complete` event and the client shows what
 * was measured, worded as "stopped early". Stopping by dropping the
 * connection instead would discard exactly that partial result. */
router.post('/stop/:id', (req, res) => {
  const stopScan = runningScans.get(req.params.id);
  if (!stopScan) return res.status(404).json({ error: 'No running scan with that id (it may have already finished).' });
  stopScan();
  res.json({ stopped: true });
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
