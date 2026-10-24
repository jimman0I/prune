import { Router } from 'express';
import { listWindowsTools, launchWindowsTool, isKnownTool } from '../services/windowsTools.js';

const router = Router();

/** The Windows tools on this PC, for the Dashboard's Windows tools dialog
 * (services/windowsTools.js). Only the ones whose files exist. Mounted at
 * /api/windows-tools. */
router.get('/', async (_req, res) => {
  try {
    res.json({ tools: await listWindowsTools() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Starts one. The body is { id } and nothing else is read from it: what
 * runs, with what arguments, comes only from the fixed list in the service.
 * An id that is not in it is a 400 before anything starts; one that is but
 * is not on this PC (Group Policy on Home) is a 404. A declined UAC dialog is
 * an ordinary answer, { ok: false, cancelled: true }, not an error. POST,
 * like /programs/reveal: a window opens. */
router.post('/launch', async (req, res) => {
  const id = req.body?.id;
  if (!isKnownTool(id)) {
    res.status(400).json({ ok: false, error: 'Unknown tool.' });
    return;
  }
  const result = await launchWindowsTool(id);
  if (result.missing) { res.status(404).json({ ok: false, error: result.error }); return; }
  res.status(result.ok || result.cancelled ? 200 : 500).json(
    result.ok ? { ok: true } : result.cancelled ? { ok: false, cancelled: true } : { ok: false, error: result.error }
  );
});

export default router;
