import { Router } from 'express';
import { pickPath } from '../services/filePicker.js';

const router = Router();

/** Shows a native folder / installer dialog and answers with the path.
 *
 * POST because it has an effect on the machine (a window opens) and must not
 * be reachable by a prefetch. It takes only the kind of thing to choose and
 * returns only the chosen path; it reads and changes nothing else. */
router.post('/:kind', async (req, res) => {
  try {
    res.json(await pickPath(req.params.kind));
  } catch (err) {
    const status = /already open/i.test(err.message) ? 409 : /kind/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
