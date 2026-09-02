import { Router } from 'express';
import { getFileTypeIcons } from '../services/fileTypeIcons.js';

const router = Router();

/** POST because the caller sends a list of extensions, which on a real
 * drive is a few dozen entries -- a body, not a query string. It reads
 * nothing but the shell's own file associations and changes nothing. */
router.post('/', async (req, res) => {
  const { extensions } = req.body || {};
  try {
    res.json({ icons: await getFileTypeIcons(Array.isArray(extensions) ? extensions : []) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
