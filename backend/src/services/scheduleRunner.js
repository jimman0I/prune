import { getSettings, updateSettings, cleanGuardsFrom } from './settings.js';
import { scanAllRules, executeRules } from '../lib/cleanerRules.js';
import { dueRun } from '../lib/schedule.js';

/** Running the scheduled task, when the app happens to be running.
 *
 * IN-APP, and that limitation is the honest one to state rather than to
 * hide. A Windows scheduled task would fire with Prune closed, but there
 * is nothing for it to invoke: the backend is an Express server Electron
 * starts, with no headless entry point. Registering a task that launches
 * the full desktop app at 2 AM to clean unattended would be worse than
 * this -- it puts a window on screen nobody asked for and deletes files
 * with nobody watching.
 *
 * So the schedule catches up instead. The check runs on start and every
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
    // of 74 rules it is most of them.
    const scanned = scanAllRules(guards);
    const ids = scanned
      .flatMap((category) => category.items ?? [])
      .filter((rule) => rule.recommended && rule.present !== false && (rule.sizeBytes ?? 0) > 0)
      .map((rule) => rule.id);

    if (ids.length === 0) return { ok: true, task, summary: 'Nothing to clean.', freedBytes: 0 };

    const result = await executeRules(ids, guards);
    return {
      ok: true,
      task,
      freedBytes: result.freedBytes ?? 0,
      summary: `Cleaned ${ids.length} ${ids.length === 1 ? 'rule' : 'rules'}.`
    };
  }

  const scanned = scanAllRules(guards);
  const total = scanned
    .flatMap((category) => category.items ?? [])
    .reduce((sum, rule) => sum + (rule.sizeBytes ?? 0), 0);

  return { ok: true, task: 'scan', freedBytes: 0, foundBytes: total, summary: 'Scan finished.' };
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

  running = true;
  try {
    const result = await runTask(automation.task, cleanGuardsFrom(settings));
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
  const status = dueRun(automation, automation?.lastRunAt ?? null, now);
  return {
    automation,
    due: status.due,
    missed: status.missed,
    nextRun: status.nextRun ? status.nextRun.getTime() : null,
    lastRunAt: automation?.lastRunAt ?? null,
    lastResult: automation?.lastResult ?? null
  };
}
