import { Router } from 'express';
import { scanForLeftovers } from '../services/leftoverScan.js';
import { normalizeScanMode } from '../services/leftoverModes.js';
import { listInstalledPrograms } from '../services/programs.js';
import { getTrace, loadTraceFindings, isTraceId } from '../services/installTraces.js';
import { getSettings } from '../services/settings.js';
import { withoutExcluded } from '../services/leftoverExclusions.js';

const router = Router();

/** What the program itself recorded about where it lives, from the request.
 * Strings only and only the known names: the scanner treats them as
 * untrusted anyway (leftoverAnchors.js), but there is no reason to carry
 * anything else further in. */
export function anchorsFrom(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const anchors = {};
  for (const key of ANCHOR_KEYS) if (typeof value[key] === 'string') anchors[key] = value[key];
  return anchors;
}
const ANCHOR_KEYS = ['installLocation', 'registryKey', 'displayIcon', 'uninstallString'];

router.post('/scan', async (req, res) => {
  const { name, publisher, mode, anchors, programId, traceId } = req.body || {};
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const settings = await getSettings().catch(() => ({}));
    // The install monitor's record of this program, when it was installed
    // under monitoring. Only ever read by id, and only a well-formed one.
    const traceFindings = isTraceId(traceId)
      ? await loadTraceFindings(await getTrace(traceId)).catch(() => undefined)
      : undefined;
    // The mode in the request wins; the remembered one is what a caller that
    // did not choose gets, and Moderate is what an unknown value becomes.
    const result = await scanForLeftovers({
      name, publisher,
      mode: normalizeScanMode(mode ?? settings?.leftoverScanMode),
      anchors: anchorsFrom(anchors),
      // The other installed programs are what the scan must not damage. The
      // list is read alongside the search and awaited only when the results
      // are filtered; a failed read is an empty list, never a failed scan.
      installedPrograms: listInstalledPrograms().catch(() => []),
      selfId: typeof programId === 'string' ? programId : undefined,
      traceFindings
    });
    res.json(withoutExcluded(result, settings));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
