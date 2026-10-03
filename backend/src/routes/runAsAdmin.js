import { Router } from 'express';
import { getRunAsAdminStatus, setRunAsAdmin } from '../services/runAsAdmin.js';

const router = Router();

/** "Always run as administrator": { supported, enabled, elevatedNow,
 * startsWithWindows }. `enabled` is read from the registry flag Windows
 * itself honours, not from settings.json; `elevatedNow` is whether this
 * running Prune has administrator rights (which a change here does not alter
 * until the next start). Mounted at /api/settings/run-as-admin. */
router.get('/', async (_req, res) => {
  try {
    res.json(await getRunAsAdminStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Sets or clears the flag. The body is `{ enabled: true | false }` and
 * nothing else is read: which program the flag is for is decided by the
 * service (Prune's own executable), never by the request. */
router.put('/', async (req, res) => {
  const enabled = req.body?.enabled;
  if (enabled !== true && enabled !== false) {
    res.status(400).json({ error: 'enabled must be true or false.' });
    return;
  }
  try {
    res.json(await setRunAsAdmin(enabled));
  } catch (err) {
    res.status(err.unsupported ? 409 : 500).json({ error: err.message, ...(err.unsupported ? { unsupported: true } : {}) });
  }
});

export default router;
