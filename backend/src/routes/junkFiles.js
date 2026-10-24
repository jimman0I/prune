import { Router } from 'express';
import { getSettings, updateSettings, cleanGuardsFrom } from '../services/settings.js';
import { validateJunkPattern, normalizeJunkPatterns, defaultJunkPatterns, isPreselected, MAX_PATTERNS } from '../lib/junkPatterns.js';
import { scanJunk, removeJunk } from '../lib/cleanJobs.js';
import { prepareRoots, junkContext } from '../services/junkScan.js';
import { listInstalledPrograms } from '../services/programs.js';
import { buildFootprints } from '../services/leftoverProtection.js';
import { recordFreed } from '../services/stats.js';
import { enforceQuarantineLimits } from '../services/quarantineLimits.js';

/** Deep Clean's Junk files scan.
 *
 * GET  /patterns          -> { patterns, defaults }
 * POST /patterns          { patterns }            -> saves the whole list, or
 *                                                     400 { reason, pattern }
 * POST /patterns/reset                             -> the defaults, saved
 * POST /scan              { roots }               -> streams what it finds
 * POST /remove            { paths, confirmed }    -> removes the ticked files
 *
 * The scan and the removal run on Deep Clean's worker thread (lib/cleanJobs.js):
 * a walk of a whole drive must not stop this process answering the window.
 * Everything that decides what may be found or removed -- the patterns, the
 * exclusions, the recent-files window, Quarantine versus Delete now -- comes
 * from settings here, never from the request. The request names only WHERE
 * to look, and which of the files it was shown it wants gone. */

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** The most paths one removal may name. Above the scan's own cap on matches,
 * so a full result can always be removed in one go. */
const MAX_REMOVE_PATHS = 25_000;
const MAX_PATH_LENGTH = 1024;
const MAX_ROOTS = 64;
/** The skipped list sent back is capped; its count is exact. */
const LIST_CAP = 200;

/** Other installed programs' folders, which the scan stays out of. A failed
 * read is an empty list: every protection that needs no list still holds. */
async function installedFootprints() {
  try {
    return buildFootprints(await listInstalledPrograms());
  } catch {
    return [];
  }
}

const withPreselection = (patterns) => patterns.map((p) => ({ ...p, preselected: isPreselected(p.pattern) }));

router.get('/patterns', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      patterns: withPreselection(normalizeJunkPatterns(settings.junkPatterns)),
      defaults: withPreselection(defaultJunkPatterns())
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** The whole list at once: adding, removing and switching one on or off are
 * all "here is the list now". Refused as a whole when any entry is not valid,
 * naming the first one and why, so a typo is answered rather than silently
 * dropped by the normalization a plain settings save would apply. */
router.post('/patterns', async (req, res) => {
  const list = req.body?.patterns;
  if (!Array.isArray(list)) { res.status(400).json({ error: 'patterns (a list) is required', reason: 'empty' }); return; }
  if (list.length > MAX_PATTERNS) { res.status(400).json({ error: `At most ${MAX_PATTERNS} patterns.`, reason: 'tooMany' }); return; }
  const seen = new Set();
  for (const entry of list) {
    const raw = typeof entry === 'string' ? entry : entry?.pattern;
    const checked = validateJunkPattern(raw);
    if (!checked.ok) {
      res.status(400).json({ error: `That pattern cannot be used (${checked.reason}).`, reason: checked.reason, pattern: typeof raw === 'string' ? raw : '' });
      return;
    }
    const key = checked.pattern.toLowerCase();
    if (seen.has(key)) { res.status(400).json({ error: 'That pattern is already in the list.', reason: 'duplicate', pattern: checked.pattern }); return; }
    seen.add(key);
  }
  try {
    const saved = await updateSettings({ junkPatterns: normalizeJunkPatterns(list) });
    res.json({ patterns: withPreselection(saved.junkPatterns) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/patterns/reset', async (req, res) => {
  try {
    const saved = await updateSettings({ junkPatterns: defaultJunkPatterns() });
    res.json({ patterns: withPreselection(saved.junkPatterns) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** The scan, streamed: 'start' { roots, refused, patterns }, 'progress'
 * { dirs, entries, matches }, 'files' { files } in batches as they are found,
 * then 'done' (the summary) or 'error'. A POST so the roots travel as JSON;
 * the client reads the body as a stream (the same reader the Shred tool uses).
 * Stop, or the window going away, ends the worker. */
router.post('/scan', async (req, res) => {
  const asked = req.body?.roots;
  if (!Array.isArray(asked) || asked.length === 0 || asked.length > MAX_ROOTS
    || asked.some((r) => typeof r !== 'string' || r.length > MAX_PATH_LENGTH)) {
    res.status(400).json({ error: 'roots (a list of drives or folders) is required', reason: 'noRoots' });
    return;
  }

  let settings;
  let prepared;
  let patterns;
  let footprints;
  try {
    settings = await getSettings();
    patterns = normalizeJunkPatterns(settings.junkPatterns);
    footprints = await installedFootprints();
    prepared = await prepareRoots(asked, junkContext({ footprints }));
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }
  if (!patterns.some((p) => p.enabled)) {
    res.status(400).json({ error: 'No junk patterns are turned on.', reason: 'noPatterns' });
    return;
  }
  if (prepared.roots.length === 0) {
    res.status(400).json({ error: 'None of those can be scanned.', reason: 'noUsableRoots', refused: prepared.refused });
    return;
  }

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
    sendEvent(res, 'start', {
      roots: prepared.roots,
      refused: prepared.refused,
      patterns: withPreselection(patterns.filter((p) => p.enabled))
    });
    const summary = await scanJunk({
      roots: prepared.roots,
      patterns,
      guards: cleanGuardsFrom(settings),
      footprints
    }, {
      signal: controller.signal,
      onFiles: (files) => { if (!controller.signal.aborted) sendEvent(res, 'files', { files }); },
      onProgress: (progress) => { if (!controller.signal.aborted) sendEvent(res, 'progress', progress); }
    });
    if (!controller.signal.aborted) sendEvent(res, 'done', summary);
  } catch (err) {
    if (!controller.signal.aborted) sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

/** Removes the files the person ticked, as one batch. Refuses anything but an
 * exact `confirmed: true`, so a request that merely resembles one cannot
 * remove a file. Each path is judged again (see removeJunkFiles); where they go
 * -- Quarantine, the Recycle Bin, or deleted -- is Settings' Deep Clean choice. */
router.post('/remove', async (req, res) => {
  const paths = req.body?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_REMOVE_PATHS
    || paths.some((p) => typeof p !== 'string' || p.length === 0 || p.length > MAX_PATH_LENGTH)) {
    res.status(400).json({ error: `paths (a list of 1 to ${MAX_REMOVE_PATHS} files) is required` });
    return;
  }
  if (req.body?.confirmed !== true) {
    res.status(400).json({ error: 'Removing junk files has to be confirmed.' });
    return;
  }
  try {
    const settings = await getSettings();
    const guards = cleanGuardsFrom(settings);
    const result = await removeJunk({
      paths,
      patterns: normalizeJunkPatterns(settings.junkPatterns),
      guards,
      footprints: await installedFootprints()
    });
    // Deleted bytes only: what moved to Quarantine is counted when that is
    // emptied, the same as every Deep Clean run.
    await recordFreed(result.freedBytes);
    const [rule] = result.results;
    // The quarantine grew, so it may now be over a limit the person set.
    const limits = rule?.quarantineBatch ? await enforceQuarantineLimits(settings) : undefined;
    res.json({
      ...result,
      results: [{ ...rule, skipped: (rule?.skipped ?? []).slice(0, LIST_CAP), skippedCount: rule?.skipped?.length ?? 0 }],
      // Every path that is still where it was, uncapped (it can be no longer
      // than the request): the window takes everything else out of its list,
      // and a capped list would make files that stayed vanish from it.
      keptPaths: (rule?.skipped ?? []).map((s) => s.path),
      mode: guards.removal === 'delete' ? 'delete' : (guards.autoQuarantine === false ? 'recycle' : 'quarantine'),
      ...(limits ? { limits } : {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
