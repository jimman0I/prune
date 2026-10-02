import { Router } from 'express';
import { saveScan, listScans, loadScan, deleteScan, compareSaved, isScanId } from '../services/savedScans.js';

const router = Router();

/** The saved scans: list, save, open, delete, and compare two.
 *
 * Every handler is wrapped like the rest of this API -- an async handler's
 * rejection does not reach Express 4's error middleware, so without the
 * try/catch a failed disk write would leave the request unanswered. */
const guarded = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get('/', guarded(async (_req, res) => {
  res.json({ scans: await listScans() });
}));

// Before '/:id', or "compare" would be taken for an id.
router.get('/compare', guarded(async (req, res) => {
  const { a, b } = req.query;
  if (!isScanId(a) || !isScanId(b)) return res.status(400).json({ error: 'Two saved scans are needed to compare.' });
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const result = await compareSaved(a, b, { limit });
  if (!result) return res.status(404).json({ error: 'One of those saved scans is no longer there.' });
  res.json(result);
}));

router.post('/', guarded(async (req, res) => {
  const { label, source, truncated, archive } = req.body || {};
  const result = await saveScan({ label, source, truncated, archive });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.status(201).json({ scan: result.meta });
}));

router.get('/:id', guarded(async (req, res) => {
  const loaded = await loadScan(req.params.id);
  if (!loaded) return res.status(404).json({ error: 'That saved scan is not there.' });
  res.json({ scan: loaded.meta, archive: loaded.archive });
}));

router.delete('/:id', guarded(async (req, res) => {
  if (!(await deleteScan(req.params.id))) return res.status(404).json({ error: 'That saved scan is not there.' });
  res.json({ deleted: true });
}));

export default router;
