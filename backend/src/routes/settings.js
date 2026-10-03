import { Router } from 'express';
import { getSettings, updateSettings } from '../services/settings.js';
import { reconcileScheduledClean } from '../services/scheduledCleanTask.js';
import { repairExplorerMenu } from '../services/explorerMenu.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const saved = await updateSettings(body);
    // The "Also run when Prune is closed" task follows the schedule: when the
    // schedule moves, or stops cleaning, an existing task moves or goes with
    // it. Only for a save that touched the schedule, and it never creates a
    // task. If Windows refuses, the save still stands: the switch in Settings
    // reads the task's real state and shows that it is out of step.
    if ('automation' in body) {
      await reconcileScheduledClean(saved.automation).catch((err) => {
        console.error('Could not update the scheduled clean task:', err.message);
      });
    }
    // The right-click menu's captions are text in the registry, in the app's
    // language: a language change brings them along. Only entries that exist are
    // rewritten (it never creates any), and a failure does not fail the save.
    if ('language' in body) {
      await repairExplorerMenu().catch((err) => {
        console.error('Could not update the right-click menu captions:', err.message);
      });
    }
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
