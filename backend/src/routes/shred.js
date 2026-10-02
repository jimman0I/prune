import { Router } from 'express';
import { getSettings, cleanGuardsFrom } from '../services/settings.js';
import { previewShred, shredRequested, validate } from '../services/shredTool.js';
import { normalizePasses } from '../lib/shredFile.js';

/** The Shred tool (BleachBit's "Shred files / folders").
 *
 * POST /preview  { paths }                         -> what would be destroyed
 * POST /         { paths, passes, confirmed:true } -> shreds, streaming progress
 *
 * Both are POSTs with a JSON body: localOnly + CORS already refuse a web
 * page, and a GET could be fired by an <img> tag. The second refuses
 * anything but an exact `confirmed: true`, so a request that merely
 * resembles the first cannot destroy a file. The guards (Windows, drives,
 * profiles, Quarantine, the cleaner's protected folders, the user's own
 * exclusions) come from settings here, never from the request. */

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** The failed/held lists can be as long as the folder was; the first few
 * are enough to act on and the counts below are exact. */
const LIST_CAP = 200;
const capped = (list) => list.slice(0, LIST_CAP);

router.post('/preview', async (req, res) => {
  try {
    const paths = validate(req.body?.paths);
    const guards = cleanGuardsFrom(await getSettings());
    const preview = await previewShred(paths, guards);
    res.json({ ...preview, refused: capped(preview.refused), refusedCount: preview.refused.length });
  } catch (err) {
    res.status(err instanceof TypeError ? 400 : 500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  let paths;
  try {
    paths = validate(req.body?.paths);
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (req.body?.confirmed !== true) {
    res.status(400).json({ error: 'Shredding has to be confirmed.' });
    return;
  }
  const passes = normalizePasses(req.body?.passes);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // `res`, not `req`: for a POST the request stream closes as soon as its
  // body is read, which is not the client leaving.
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  try {
    const guards = cleanGuardsFrom(await getSettings());
    sendEvent(res, 'start', { passes });
    const result = await shredRequested(paths, passes, guards, {
      signal: controller.signal,
      onProgress: (p) => { if (!controller.signal.aborted) sendEvent(res, 'progress', p); },
      onBytes: (p) => { if (!controller.signal.aborted) sendEvent(res, 'progress', p); }
    });
    if (!controller.signal.aborted) {
      sendEvent(res, 'done', {
        passes,
        shreddedFiles: result.shreddedFiles,
        bytes: result.bytes,
        aborted: result.aborted,
        failed: capped(result.failed),
        failedCount: result.failed.length,
        held: capped(result.held),
        heldCount: result.held.length
      });
    }
  } catch (err) {
    if (!controller.signal.aborted) sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
