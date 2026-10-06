import { Router } from 'express';
import { scanForcedUninstall } from '../services/forcedUninstall.js';
import { normalizeScanMode } from '../services/leftoverModes.js';
import { getSettings } from '../services/settings.js';
import { anchorsFrom } from './leftovers.js';
import { listInstalledPrograms } from '../services/programs.js';
import { withoutExcluded } from '../services/leftoverExclusions.js';

const router = Router();

/** POST, not GET: the scan takes a body (name, publisher, registry key)
 * rather than a query string, and putting a program name and registry path
 * in a URL would also log them. It changes nothing on disk -- removal is
 * POST /api/quarantine/remove, which already exists and makes a restore
 * point first. */
router.post('/scan', async (req, res) => {
  const { name, publisher, registryKey, mode, anchors } = req.body || {};
  try {
    const settings = await getSettings().catch(() => ({}));
    // The exclusions the normal uninstall scan honours apply here too: a forced
    // removal is the broadest search Prune makes, so it most needs them.
    const scan = await scanForcedUninstall({
      name, publisher, registryKey,
      mode: normalizeScanMode(mode ?? settings?.leftoverScanMode),
      anchors: anchorsFrom(anchors),
      installedPrograms: listInstalledPrograms().catch(() => [])
    });
    res.json(withoutExcluded(scan, settings));
  } catch (err) {
    // A missing name is the caller's mistake, not a server fault.
    const status = /required/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
