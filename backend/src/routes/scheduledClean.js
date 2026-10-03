import { Router } from 'express';
import { getSettings } from '../services/settings.js';
import { recordFreed } from '../services/stats.js';
import { ingestReport, latestRun } from '../services/scheduledCleanReport.js';
import {
  getScheduledCleanStatus, enableScheduledClean, disableScheduledClean, scheduleOf
} from '../services/scheduledCleanTask.js';

const router = Router();

/** The run in the shape the screens use. */
function summary(run) {
  if (!run) return null;
  return {
    at: run.at, ok: run.ok, mode: run.mode, movedBytes: run.movedBytes, freedBytes: run.freedBytes,
    rulesCleaned: run.rulesCleaned, rulesFailed: run.rulesFailed
  };
}

/** What unattended runs left since the app last looked: their freed bytes are
 * added to the lifetime total (once each), and the latest run is returned. */
async function lastClean() {
  await ingestReport({ recordFreed });
  return summary(await latestRun());
}

/** "Also run when Prune is closed": the Task Scheduler task as Windows has it,
 * for the schedule in Settings, plus the last unattended run.
 * { supported, reason, exists, inSync, nextRun, lastRun, lastTaskResult,
 *   canEnable, lastClean }. Mounted at /api/scheduled-clean. */
router.get('/', async (_req, res) => {
  try {
    const schedule = scheduleOf((await getSettings()).automation);
    const [state, last] = await Promise.all([getScheduledCleanStatus(schedule), lastClean()]);
    res.json({ ...state, canEnable: state.supported === true && schedule !== null, lastClean: last });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Only the last unattended run: a quiet line on the Dashboard, no PowerShell. */
router.get('/last', async (_req, res) => {
  try {
    res.json({ lastClean: await lastClean() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Creates or removes the task. The body is `{ enabled: true | false }` and
 * nothing else is read: what the task runs, and when, is decided by the
 * service from the running Prune and the schedule in Settings, never by the
 * request. */
router.put('/', async (req, res) => {
  const enabled = req.body?.enabled;
  if (enabled !== true && enabled !== false) {
    res.status(400).json({ error: 'enabled must be true or false.' });
    return;
  }
  try {
    if (!enabled) {
      res.json(await disableScheduledClean());
      return;
    }
    const schedule = scheduleOf((await getSettings()).automation);
    if (!schedule) {
      res.status(409).json({ error: 'Set the scheduled run to clean first.', needsSchedule: true });
      return;
    }
    res.json(await enableScheduledClean(schedule));
  } catch (err) {
    if (err.unsupported) res.status(409).json({ error: err.message, unsupported: true, reason: err.reason });
    else if (err.needsSchedule) res.status(409).json({ error: err.message, needsSchedule: true });
    else res.status(500).json({ error: err.message });
  }
});

export default router;
