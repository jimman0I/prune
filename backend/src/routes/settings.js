import { Router } from 'express';
import { getSettings, updateSettings } from '../services/settings.js';
import { reconcileScheduledClean } from '../services/scheduledCleanTask.js';

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
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
