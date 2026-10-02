import { Router } from 'express';
import { scanAllRules, executeRules, executeRulesProgressively, scanRulesProgressively, loadCleanerRules, rulePathsExist } from '../lib/cleanerRules.js';
import { getSettings, cleanGuardsFrom } from '../services/settings.js';
import { executeRulesElevated } from '../services/elevatedClean.js';
import { getCleanerCategoryIcons } from '../services/cleanerCategoryIcons.js';
import { listCookieDomains } from '../lib/cleanerActions/cookieDomains.js';
import { listInstalledPrograms } from '../services/programs.js';
import { estimateWipe, wipeInProgress } from '../lib/cleanerActions/wipeFreeSpace.js';
import { listFixedDrives, profileDrive } from '../services/localDrives.js';
import { normalizePasses } from '../lib/shredFile.js';

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
}

/** The real installed-programs list, reduced to a lowercased name Set --
 * fetched once per scan request (not once per rule) and threaded into
 * `guards` the same way `cleanGuardsFrom`'s own fields already are, so
 * `scanRule`/`rulePathsExist` can gate a game/launcher rule's
 * `requiresProgram` field against real registry data instead of trusting
 * a bare folder-exists check. See cleanerRules.js's own requiresProgram
 * gate for why this exists. */
async function installedProgramNames() {
  const programs = await listInstalledPrograms();
  return new Set(programs.map((p) => p.name.toLowerCase()));
}

/** The same scan as GET /scan, streamed a rule at a time.
 *
 * The one-shot version takes ~19 seconds and says nothing until it's
 * finished, which is indistinguishable from being stuck. This emits each
 * rule's real size the moment it's known, so the UI can fill the tree as
 * it goes and show what it's working on.
 *
 * `X-Accel-Buffering: no` matters as much as the flushing does: a proxy
 * that buffers the response would reassemble it into exactly the
 * all-at-once behaviour this exists to avoid. */
router.get('/scan/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Covers both the Abort button and the user simply navigating away --
  // there's no reason to keep walking the filesystem for an answer
  // nobody is waiting for.
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const rules = loadCleanerRules();
    sendEvent(res, 'start', { total: rules.length });
    const summary = await scanRulesProgressively(
      (item) => sendEvent(res, 'rule', item),
      {
        signal: controller.signal,
        // The profile-wide Deep scan rules take a while; this is how the
        // screen says what they are doing instead of sitting silent.
        onProgress: (progress) => { if (!controller.signal.aborted) sendEvent(res, 'progress', progress); },
        ...cleanGuardsFrom(await getSettings()),
        installedProgramNames: await installedProgramNames()
      }
    );
    if (!controller.signal.aborted) sendEvent(res, 'done', summary);
  } catch (err) {
    if (!controller.signal.aborted) sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

/** The rule list itself, grouped, with no sizes and no filesystem work.
 *
 * Deep Clean used to show an empty panel until someone ran a scan, so the
 * screen a user first meets said nothing about what the feature even
 * cleans -- and the scan behind it takes half a minute. The rules are
 * just a JSON file, so the tree can be on screen immediately and the
 * sizes filled in afterwards, which is how BleachBit behaves and what
 * this was asked to match.
 *
 * Every rule reports sizeBytes: null, which the tree already renders as a
 * dash. That is the honest state: not measured, as opposed to measured
 * and empty. */
router.get('/rules', async (req, res) => {
  try {
    const guards = { installedProgramNames: await installedProgramNames() };
    const grouped = [];
    for (const rule of loadCleanerRules()) {
      // `present` is computed here, cheaply, even though sizeBytes is
      // not. The two are very different costs: presence is a stat per
      // path, and now also walks actions-form rules (~150 ms for 80 rules,
      // measured on this machine), while a size needs a full directory
      // walk and takes the better part of a minute for the set.
      //
      // Worth the ~150ms because without it "hide cleaners that don't
      // apply" could not do anything until a scan had run -- the flag it
      // filters on did not exist yet -- so the list opened showing
      // Firefox, Opera and Vivaldi to someone who has none of them, and
      // the setting looked broken. Several categories on this
      // machine are for software that is not installed.
      const item = { ...rule, sizeBytes: null, fileCount: null, present: rulePathsExist(rule, guards) };
      const group = grouped.find((g) => g.category === rule.category);
      if (group) group.items.push(item);
      else grouped.push({ category: rule.category, items: [item] });
    }
    res.json({ categories: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** The icon for each category, as { category: dataUri }.
 *
 * Its own endpoint rather than a field on /rules, for the same reason the
 * program and startup icons have theirs: it opens twenty-odd executables
 * through PowerShell, and the list should be on screen long before any of
 * that finishes. A category whose program is not installed is simply
 * absent from the map and keeps its lettered tile. */
router.get('/category-icons', async (req, res) => {
  try {
    res.json({ icons: await getCleanerCategoryIcons() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cookie-domains', async (req, res) => {
  try {
    res.json(await listCookieDomains());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** What a free-space wipe would do on this machine, for the confirm dialog:
 * the drive, how much it would write, and a rough time from a real write
 * test of about a second. Read-only apart from that one throwaway file. */
router.get('/wipe-estimate', async (req, res) => {
  if (wipeInProgress()) {
    res.status(409).json({ error: 'A free-space wipe is already running.' });
    return;
  }
  try {
    // `drive` is checked against the machine's own list of fixed disks,
    // not just against a pattern: the estimate creates a folder and writes
    // a file there.
    const asked = typeof req.query.drive === 'string' && req.query.drive !== '' ? req.query.drive.trim().toUpperCase() : null;
    if (asked !== null) {
      const fixed = await listFixedDrives();
      if (!/^[A-Z]:$/.test(asked) || !fixed.some((d) => d.drive === asked)) {
        res.status(400).json({ error: 'That is not a local drive.' });
        return;
      }
    }
    res.json(await estimateWipe({ drive: asked, passes: normalizePasses(req.query.passes) }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** The local fixed drives the wipe can be pointed at, for the dialog's
 * picker, and which one it uses when none is chosen. */
router.get('/wipe-drives', async (req, res) => {
  try {
    res.json({ drives: await listFixedDrives(), profileDrive: profileDrive() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scan', async (req, res) => {
  try {
    res.json({
      categories: scanAllRules({ ...cleanGuardsFrom(await getSettings()), installedProgramNames: await installedProgramNames() })
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** The same clean as POST /execute, streamed a rule at a time -- the
 * output BleachBit shows while it's actually working, moved to the step
 * that's actually working. `ids` is a comma-separated list rather than a
 * body: EventSource (and this route's own fetch-based reader on the
 * frontend, matching /scan/stream) only ever sends GET.
 *
 * Same abort-on-disconnect wiring as /scan/stream, with the same caveat
 * `executeRulesProgressively` documents: the rule in flight when Stop is
 * pressed still finishes, so a batch already being quarantined is never
 * left half-done. */
router.get('/execute/stream', async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    res.status(400).json({ error: 'ids (a non-empty comma-separated list) is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    sendEvent(res, 'start', { total: ids.length });
    const summary = await executeRulesProgressively(
      ids,
      (item) => sendEvent(res, 'rule', item),
      {
        signal: controller.signal,
        onProgress: (progress) => { if (!controller.signal.aborted) sendEvent(res, 'progress', progress); },
        ...cleanGuardsFrom(await getSettings())
      }
    );
    if (!controller.signal.aborted) sendEvent(res, 'done', summary);
  } catch (err) {
    if (!controller.signal.aborted) sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

router.post('/execute', async (req, res) => {
  const { ruleIds } = req.body || {};
  if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
    res.status(400).json({ error: 'ruleIds (a non-empty array) is required' });
    return;
  }
  try {
    res.json(await executeRules(ruleIds, cleanGuardsFrom(await getSettings())));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** The same clean as POST /execute, but from an elevated process -- for
 * the specific rules a scan already reported `accessible: false` on
 * (Prefetch, the Defender log folders: directories Windows won't even
 * list without administrator). Raises a real UAC prompt every call; the
 * frontend only ever reaches this from a button the user pressed after
 * seeing which rules it covers, never automatically. A declined prompt
 * is an ordinary outcome (`cancelled: true`), not a 500. */
router.post('/execute-elevated', async (req, res) => {
  const { ruleIds } = req.body || {};
  if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
    res.status(400).json({ error: 'ruleIds (a non-empty array) is required' });
    return;
  }
  try {
    const result = await executeRulesElevated(ruleIds, cleanGuardsFrom(await getSettings()));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
