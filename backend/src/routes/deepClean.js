import { Router } from 'express';
import { scanAllRules, executeRules, scanRulesProgressively, loadCleanerRules } from '../lib/cleanerRules.js';

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
      { signal: controller.signal }
    );
    if (!controller.signal.aborted) sendEvent(res, 'done', summary);
  } catch (err) {
    if (!controller.signal.aborted) sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

router.get('/scan', (req, res) => {
  try {
    res.json({ categories: scanAllRules() });
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
    res.json(await executeRules(ruleIds));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
