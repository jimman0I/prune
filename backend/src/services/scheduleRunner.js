import { getSettings, updateSettings, cleanGuardsFrom } from './settings.js';
import { scanAllRules, executeRules } from '../lib/cleanerRules.js';
import { dueRun } from '../lib/schedule.js';
import { recordFreed } from './stats.js';
import { scheduledCleanDelegates } from './scheduledCleanTask.js';
import { latestRun } from './scheduledCleanReport.js';

/** Running the scheduled task, when the app happens to be running.
 *
 * IN-APP, and that limitation is the honest one to state rather than to
 * hide. Launching the full desktop app at 2 AM to clean unattended would put
 * a window on screen nobody asked for. Running while Prune is closed is a
 * separate, opt-in thing: "Also run when Prune is closed" registers a Windows
 * task that runs the command line (services/scheduledCleanTask.js), and while
 * that task exists this scheduler stands down for the schedule (see
 * handedToTask below).
 *
 * Without it, the schedule catches up instead. The check runs on start and every
 * minute after, and a window that passed while the machine was off is
 * reported as missed rather than silently skipped. That is what the
 * Dashboard badge says, and it is the difference between "the feature is
 * broken" and "your computer was asleep".
 */

/** Every minute. The windows are minute-granular, and a check that costs
 * one settings read is not worth batching. */
const CHECK_INTERVAL_MS = 60_000;

let timer = null;
let running = false;

/** A scan measures and reports; a clean removes. Both are bounded by the
 * same guards the manual path uses, and a clean still goes to quarantine
 * -- an unattended run is exactly when reversibility matters most. */
async function runTask(task, guards) {
  if (task === 'clean') {
    // The rules a clean would tick by default, and only the ones with
    // something in them. A scheduled clean must not act on a rule the
    // scan proved is empty -- that is work with no result, and on a list
    // of rules it is most of them.
    const scanned = scanAllRules(guards);
    const ids = scanned
      .flatMap((category) => category.items ?? [])
      .filter((rule) => rule.recommended && rule.present !== false && (rule.sizeBytes ?? 0) > 0)
      .map((rule) => rule.id);

    if (ids.length === 0) return { ok: true, task, summary: 'Nothing to clean.', freedBytes: 0 };

    const result = await executeRules(ids, guards);
    await recordFreed(result.freedBytes);
    return {
      ok: true,
      task,
      freedBytes: result.freedBytes ?? 0,
      movedBytes: result.movedBytes ?? 0,
      summary: `Cleaned ${ids.length} ${ids.length === 1 ? 'rule' : 'rules'}.`
    };
  }

  const scanned = scanAllRules(guards);
  const total = scanned
    .flatMap((category) => category.items ?? [])
    .reduce((sum, rule) => sum + (rule.sizeBytes ?? 0), 0);

  return { ok: true, task: 'scan', freedBytes: 0, foundBytes: total, summary: 'Scan finished.' };
}

/** Whether Windows Task Scheduler owns this schedule.
 *
 * "Also run when Prune is closed" registers a task that runs the same clean
 * from the command line, with or without Prune open. While that task exists
 * the in-app scheduler must not ALSO run it: two cleans of one schedule, one
 * of them behind the other's back. Only a schedule that cleans is ever handed
 * over; one that only measures stays here. A task that cannot be read counts
 * as no task, so the schedule keeps working. */
async function handedToTask(automation) {
  if (automation?.enabled !== true || automation?.task !== 'clean') return false;
  try {
    return await scheduledCleanDelegates();
  } catch {
    return false;
  }
}

/** Checks whether a run is due, and runs it.
 *
 * Exported so a test and the route can drive it directly rather than
 * waiting a minute for a timer. */
export async function checkSchedule(now = new Date()) {
  // Never two at once. A clean takes longer than the check interval, and
  // a second one starting on top would be operating on a disk the first
  // is still changing.
  if (running) return { skipped: 'already running' };

  const settings = await getSettings();
  const automation = settings.automation;
  const status = dueRun(automation, automation?.lastRunAt ?? null, now);
  if (!status.due) return { ...status, ran: false };
  if (await handedToTask(automation)) return { ...status, ran: false, deferred: 'scheduled task' };

  running = true;
  try {
    // Always 'quarantine', whatever Settings says for a manual Deep Clean.
    // "Delete now" is a choice made with the confirm dialog in front of it;
    // an unattended 2 AM run has no dialog, so it never gets to delete.
    const result = await runTask(automation.task, { ...cleanGuardsFrom(settings), removal: 'quarantine' });
    await updateSettings({
      automation: {
        ...automation,
        lastRunAt: now.getTime(),
        lastResult: { at: now.getTime(), missedBefore: status.missed, ...result }
      }
    });
    return { ...status, ran: true, result };
  } catch (err) {
    // A failed run still records the attempt. Without that it stays due
    // and retries every minute for the rest of the day.
    await updateSettings({
      automation: {
        ...automation,
        lastRunAt: now.getTime(),
        lastResult: { at: now.getTime(), ok: false, task: automation.task, error: err.message }
      }
    });
    return { ...status, ran: true, error: err.message };
  } finally {
    running = false;
  }
}

/** Starts the minute check. Safe to call twice. */
export function startScheduler() {
  if (timer) return;
  // Not on the very first tick: the app has just started and is already
  // doing the most work it will do all session.
  timer = setInterval(() => { checkSchedule().catch(() => {}); }, CHECK_INTERVAL_MS);
  // Never keeps the process alive on its own.
  timer.unref?.();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** What the Dashboard badge and the Settings section read. */
export async function scheduleStatus(now = new Date()) {
  const settings = await getSettings();
  const automation = settings.automation ?? null;
  const delegated = await handedToTask(automation);
  // The task keeps its own record (its report), so "missed" is measured from
  // that, not from the in-app record the task never updates.
  let lastRunAt = automation?.lastRunAt ?? null;
  if (delegated) {
    const run = await latestRun().catch(() => null);
    if (run) lastRunAt = Math.max(lastRunAt ?? 0, run.at);
  }
  const status = dueRun(automation, lastRunAt, now);
  return {
    automation,
    // Not "due" for the app to catch up: the task is the one that runs it.
    due: delegated ? false : status.due,
    missed: status.missed,
    nextRun: status.nextRun ? status.nextRun.getTime() : null,
    lastRunAt,
    lastResult: automation?.lastResult ?? null,
    delegatedToTask: delegated
  };
}
