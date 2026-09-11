import { Router } from 'express';
import { getRecentHistory, appendHistoryEntry } from '../services/uninstallHistory.js';
import { getSettings } from '../services/settings.js';

const router = Router();

// Both handlers wrapped like every other one in this app. An async
// handler that rejects does not reach the error middleware -- Express 4
// forwards only what a handler throws synchronously, which an async
// function never does -- so a failed history read or write left the
// request unanswered rather than reporting anything.

router.get('/', async (_req, res) => {
  try {
    res.json({ entries: await getRecentHistory(5) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { programName, publisher, sizeBytes } = req.body || {};
  if (!programName) return res.status(400).json({ error: 'programName is required.' });
  try {
    // Revo's "Disable Uninstall History". Off means nothing is written --
    // the point is that no record exists -- and only an explicit false
    // turns it off, so a settings file from before this keeps its history.
    if ((await getSettings())?.keepUninstallHistory === false) {
      res.json({ ok: true, skipped: true });
      return;
    }
    await appendHistoryEntry({ programName, publisher, sizeBytes });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
