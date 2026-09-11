import { Router } from 'express';
import { getSettings } from '../services/settings.js';
import { appVersion, updateChecker, openReleasePage } from '../services/updateCheck.js';

/** /update-check -- where the app decides whether it may reach the
 * network at all.
 *
 * The setting is read on every request rather than once at startup, so
 * turning it off takes effect at once, and only an explicit `true` counts:
 * a hand-edited "true" string or a 1 is not consent. The running version is
 * answered either way, since the About panel reads it from here.
 */
const router = Router();

router.get('/', async (req, res) => {
  try {
    const current = appVersion();
    const settings = await getSettings();
    if (settings?.updateCheck !== true) {
      res.json({ enabled: false, current });
      return;
    }
    res.json({ enabled: true, ...(await updateChecker.check()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Opens the page of the newer release the last check found.
 *
 * Takes no address from the request. An endpoint that opened whatever URL
 * it was sent would be an "open anything in the browser" button for any
 * code that can reach this API; this one can only ever open a Prune
 * release page, and only after a check has found one. */
router.post('/open', async (req, res) => {
  try {
    const last = updateChecker.lastResult();
    if (!last?.newer || !last.url) {
      res.status(409).json({ error: 'No newer release has been found to open.' });
      return;
    }
    res.json(await openReleasePage(last.url));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
