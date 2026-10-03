import { Router } from 'express';
import { findProgramForFile } from '../services/programFinder.js';
import { listInstalledPrograms } from '../services/programs.js';
import { getStoreApps } from '../services/storeApps.js';

const router = Router();

/** Which installed program a .exe or a .lnk belongs to. Used by the right-click
 * menu's "Find in Prune (uninstall)" and by dropping a file onto the
 * Applications screen. The body is `{ path }` and nothing else is read. The
 * answer is { status: 'matched' | 'unmatched' | 'windows' | 'unresolved', ... }
 * (services/programFinder.js); it only looks, and changes nothing. POST because
 * it reads a file and runs the installed-program lookup, which takes seconds. */
router.post('/', async (req, res) => {
  const path = req.body?.path;
  if (typeof path !== 'string') {
    res.status(400).json({ error: 'path must be the full path of a program or a shortcut.' });
    return;
  }
  try {
    res.json(await findProgramForFile(path, {
      // Read only once the path is known to be worth looking up.
      loadContext: async () => {
        const [programs, storeApps] = await Promise.all([
          listInstalledPrograms().catch(() => []),
          getStoreApps().catch(() => [])
        ]);
        return { programs, storeApps };
      }
    }));
  } catch (err) {
    res.status(err.invalid ? 400 : 500).json({ error: err.message });
  }
});

export default router;
