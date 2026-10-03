import { Router } from 'express';
import { getStartWithWindows, setStartWithWindows } from '../services/startWithWindows.js';

const router = Router();

/** "Start Prune when I sign in to Windows": { supported, enabled, minimized,
 * stale, foreign, disabledByWindows, runAsAdmin }. Read from the Run key
 * Windows itself honours, not from settings.json. `runAsAdmin` says whether
 * "Always run as administrator" is also on, which Windows will not start
 * silently. Mounted at /api/settings/start-with-windows. */
router.get('/', async (_req, res) => {
  try {
    res.json(await getStartWithWindows());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Sets or clears the entry. The body is `{ enabled: true | false,
 * minimized?: true | false }` and nothing else is read: which program is
 * started, and with what, is decided by the service (Prune's own executable and
 * at most --start-minimized), never by the request. */
router.put('/', async (req, res) => {
  const { enabled, minimized } = req.body ?? {};
  if (enabled !== true && enabled !== false) {
    res.status(400).json({ error: 'enabled must be true or false.' });
    return;
  }
  if (minimized !== undefined && minimized !== true && minimized !== false) {
    res.status(400).json({ error: 'minimized must be true or false.' });
    return;
  }
  try {
    res.json(await setStartWithWindows({ enabled, ...(minimized === undefined ? {} : { minimized }) }));
  } catch (err) {
    res.status(err.unsupported ? 409 : 500).json({ error: err.message, ...(err.unsupported ? { unsupported: true } : {}) });
  }
});

export default router;
