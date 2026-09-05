import { Router } from 'express';
import { scheduleStatus, checkSchedule } from '../services/scheduleRunner.js';

const router = Router();

/** What the Dashboard badge and the Settings section read.
 *
 * Includes the missed count, which is the whole point of the badge: a
 * desktop asleep at 2 AM does not fail its schedule, it simply is not
 * there for it, and saying so is the difference between the feature
 * looking broken and the machine having been off. */
router.get('/', async (req, res) => {
  try {
    res.json(await scheduleStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Runs the scheduled task now, if one is due.
 *
 * POST because it does the work. It does NOT force a run out of turn --
 * a button that ignored the schedule would be a second, hidden way to
 * clean, and the manual Deep Clean screen already exists for that. This
 * is "catch up now" rather than "clean now". */
router.post('/check', async (req, res) => {
  try {
    res.json(await checkSchedule());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
