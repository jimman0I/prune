import { Router } from 'express';
import { listInstalledPrograms } from '../services/programs.js';
import { getProgramIcons } from '../services/programIcons.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const programs = await listInstalledPrograms();
    res.json({ programs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Every program's real icon, as { programId: dataUri }.
 *
 * Separate from the list on purpose. Extraction spawns PowerShell and
 * reads ~90 executables, and making the program list wait on that would
 * trade a fast list for a prettier one. The UI renders rows immediately
 * and fills the icons in when they arrive; a program with no extractable
 * icon is simply absent from the map and keeps its lettered tile. */
router.get('/icons', async (req, res) => {
  try {
    res.json({ icons: await getProgramIcons() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
