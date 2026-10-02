import { Router } from 'express';
import {
  getRecentHistory, getAllHistory, appendHistoryEntry, updateHistoryEntry, clearHistory
} from '../services/uninstallHistory.js';
import { cleanEntryFields } from '../services/historyFields.js';
import { getSettings } from '../services/settings.js';

const router = Router();

// Every handler wrapped like every other one in this app. An async handler
// that rejects does not reach the error middleware -- Express 4 forwards only
// what a handler throws synchronously, which an async function never does --
// so a failed history read or write left the request unanswered rather than
// reporting anything.

/** Revo's "Disable Uninstall History". Off means nothing is written -- the
 * point is that no record exists -- and only an explicit false turns it off,
 * so a settings file from before this keeps its history. */
async function historyIsOff() {
  return (await getSettings())?.keepUninstallHistory === false;
}

/** The five latest entries (what the Dashboard shows), or all of them with
 * ?all=1 (the History view). */
router.get('/', async (req, res) => {
  try {
    const all = req.query.all === '1' || req.query.all === 'true';
    res.json({ entries: all ? await getAllHistory() : await getRecentHistory(5) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const fields = cleanEntryFields(req.body);
  if (!fields.programName) return res.status(400).json({ error: 'programName is required.' });
  try {
    if (await historyIsOff()) {
      res.json({ ok: true, skipped: true });
      return;
    }
    const entry = await appendHistoryEntry(fields);
    res.json({ ok: true, id: entry?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Adds the outcome of the leftover review to an entry already written. */
router.patch('/:id', async (req, res) => {
  try {
    if (await historyIsOff()) {
      res.json({ ok: true, skipped: true });
      return;
    }
    const updated = await updateHistoryEntry(req.params.id, req.body);
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Clears the whole log. Always allowed, whatever the setting says: turning
 * the history off stops new entries and clearing removes the old ones. */
router.delete('/', async (_req, res) => {
  try {
    res.json({ ok: true, cleared: await clearHistory() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
