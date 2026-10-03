import { Router } from 'express';
import { getExplorerMenu, setExplorerMenu } from '../services/explorerMenu.js';

const router = Router();

/** "Add Prune to the right-click menu": { supported, reason?, enabled,
 * incomplete, stale, foreign, captions }. Read from the registry (the four
 * shell verbs under HKCU\Software\Classes), not from settings.json. `captions`
 * are the two menu texts in the app's language. Mounted at
 * /api/settings/explorer-menu. */
router.get('/', async (_req, res) => {
  try {
    res.json(await getExplorerMenu());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Adds or removes the verbs. The body is `{ enabled: true | false }` and
 * nothing else is read: which keys are written, what they run and what they say
 * is decided by the service (Prune's own executable, two fixed flags), never by
 * the request. */
router.put('/', async (req, res) => {
  const { enabled } = req.body ?? {};
  if (enabled !== true && enabled !== false) {
    res.status(400).json({ error: 'enabled must be true or false.' });
    return;
  }
  try {
    res.json(await setExplorerMenu({ enabled }));
  } catch (err) {
    res.status(err.unsupported ? 409 : 500).json({ error: err.message, ...(err.unsupported ? { unsupported: true } : {}) });
  }
});

export default router;
