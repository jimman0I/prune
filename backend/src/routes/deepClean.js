import { Router } from 'express';
import { scanAllRules, executeRules, scanRulesProgressively, loadCleanerRules } from '../lib/cleanerRules.js';
import { getSettings, cleanGuardsFrom } from '../services/settings.js';

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
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
      { signal: controller.signal, ...cleanGuardsFrom(await getSettings()) }
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
router.get('/rules', (req, res) => {
  try {
    const grouped = [];
    for (const rule of loadCleanerRules()) {
      const item = { ...rule, sizeBytes: null, fileCount: null };
      const group = grouped.find((g) => g.category === rule.category);
      if (group) group.items.push(item);
      else grouped.push({ category: rule.category, items: [item] });
    }
    res.json({ categories: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scan', async (req, res) => {
  try {
    res.json({ categories: scanAllRules(cleanGuardsFrom(await getSettings())) });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

export default router;
