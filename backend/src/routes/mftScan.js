import { Router } from 'express';
import { scanDrivesViaMft } from '../services/mftScan.js';
import { DEFAULT_MAX_DEPTH } from '../services/diskScan.js';
import { isElevated } from '../lib/privilege.js';
import { getSettings } from '../services/settings.js';
import { classifyScanError, SCAN_TOO_LARGE_MESSAGE } from '../lib/scanErrors.js';

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

/** Whether the fast scan can run without asking. The Disk Map reads this to
 * decide what to tell the user: nothing to approve when Prune already runs
 * as administrator, an explanation (and a restart button) when it does not. */
router.get('/status', async (_req, res) => {
  try {
    res.json({ elevated: await isElevated() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    // The user's own exclusions, read per scan: the fast scan obeys them just
    // as the folder walk does. A settings file that cannot be read must not
    // stop a scan -- no exclusions is the safe reading, since nothing real is
    // ever hidden by it.
    let settings = {};
    try { settings = (await getSettings()) ?? {}; } catch { /* fall through with none */ }
    const result = await scanDrivesViaMft({
      driveLetters,
      maxDepth,
      excludeFolders: Array.isArray(settings.excludeFolders) ? settings.excludeFolders : [],
      excludeExtensions: Array.isArray(settings.excludeExtensions) ? settings.excludeExtensions : [],
      // Each drive's tree stays the bytes the helper wrote; see sendScan.
      raw: true
    });

    // A declined prompt is a 200 carrying { cancelled: true }, not an
    // error status: the user answered the question, and the answer was
    // no. Same convention /disk-health/elevated already uses.
    if (!result.ok) {
      if (result.cancelled) return res.json({ cancelled: true });
      return res.status(500).json({ error: result.error, ...(result.code ? { code: result.code } : {}) });
    }

    await sendScan(res, result);
  } catch (err) {
    // A string past V8's limit is a RangeError with no useful message.
    const code = classifyScanError(err);
    if (res.headersSent) return res.destroy(err);
    res.status(500).json(code ? { error: SCAN_TOO_LARGE_MESSAGE, code } : { error: err.message });
  }
});

/** Writes the scan reply: { drives: [{ driveLetter, stats, tree } | { driveLetter, error }], driveLetter, stats }.
 *
 * Each tree goes out as the bytes the helper wrote, in pieces, rather than as
 * one res.json() of the parsed object. On a drive with millions of files the
 * tree is a couple of hundred megabytes: parsed it is over a gigabyte of heap
 * in the process that hosts the whole app, and serialized again it is another
 * giant string. The top-level `tree` that used to repeat the first drive is
 * gone for the same reason (it doubled the reply, and the Disk Map reads
 * `drives`). */
async function sendScan(res, result) {
  // The single-drive shape ({ tree, stats, driveLetter }) is still understood.
  const all = result.drives ?? [{ driveLetter: result.driveLetter, tree: result.tree, stats: result.stats }];
  const hasRaw = all.some((d) => d.treeJson);
  if (!hasRaw) {
    const drives = all.map(({ treeJson, ...rest }) => rest);
    return res.json({ drives, stats: result.stats, driveLetter: result.driveLetter });
  }

  res.status(200).set('Content-Type', 'application/json; charset=utf-8');
  const write = (chunk) => new Promise((resolve, reject) => {
    if (res.write(chunk)) return resolve();
    res.once('drain', resolve);
    res.once('error', reject);
  });
  await write('{"drives":[');
  let first = true;
  for (const drive of all) {
    await write(first ? '' : ',');
    first = false;
    if (drive.treeJson) {
      await write(`{"driveLetter":${JSON.stringify(drive.driveLetter)},"stats":${JSON.stringify(drive.stats ?? {})},"tree":`);
      await write(drive.treeJson);
      await write('}');
    } else {
      await write(JSON.stringify(drive));
    }
  }
  await write(`],"driveLetter":${JSON.stringify(result.driveLetter)},"stats":${JSON.stringify(result.stats ?? {})}}`);
  res.end();
}

export default router;
