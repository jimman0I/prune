import { Router } from 'express';
import { listBackups, restoreBackup, deleteBackup } from '../services/backups.js';

const router = Router();

/** The Backup Manager: registry exports and scheduled-task definitions Prune
 * saved before it changed something with no Recycle Bin. The id names a
 * backup as `registry:<folder>` or `task:<folder>` and is parsed strictly by
 * the service; nothing else from the request reaches a path. */
router.get('/', async (_req, res) => {
  try {
    res.json({ backups: await listBackups() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    res.json(await restoreBackup(req.params.id));
  } catch (err) {
    res.status(/no such backup/i.test(err.message) ? 404 : 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteBackup(req.params.id);
    if (!result.deleted) { res.status(404).json({ error: 'There is no such backup.' }); return; }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
