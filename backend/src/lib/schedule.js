/** When a scheduled run should happen, and whether one is overdue.
 *
 * Pure and local-time. Someone who types 2:00 AM means 2:00 AM where they
 * are, so every calculation goes through a local Date rather than through
 * UTC arithmetic -- which also means a clock change is handled by the
 * platform rather than by a day-length constant that is wrong twice a
 * year.
 *
 * Separate from the runner because this is the part with the edge cases:
 * a window that has already passed today, a weekday that has to roll a
 * whole week, and a machine that was off for four days and missed three
 * runs. None of those throw when they are wrong -- they just fire at the
 * wrong time, or never.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** More missed runs than this and the number stops being information. A
 * machine off for three years should say "a lot", not render 1,095. */
const MAX_REPORTED_MISSES = 99;

function isValid(schedule) {
  if (!schedule?.enabled) return false;
  const { frequency, hour, minute, weekday } = schedule;
  if (frequency !== 'daily' && frequency !== 'weekly') return false;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return false;
  // A weekly schedule with no valid weekday has no meaning; refusing it is
  // better than silently running on Sundays because 0 is falsy.
  if (frequency === 'weekly' && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) return false;
  return true;
}

/** The scheduled moment on a given day, in local time. */
function atTimeOn(date, hour, minute) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

/** The first run strictly after `from`, or null.
 *
 * Strictly after matters: a run that finishes at exactly 02:00:00.000
 * would otherwise compute its own start time as the next one and fire in
 * a loop. */
export function nextRunAfter(schedule, from = new Date()) {
  if (!isValid(schedule)) return null;
  const { frequency, hour, minute, weekday } = schedule;

  let candidate = atTimeOn(from, hour, minute);
  if (candidate <= from) candidate = atTimeOn(addDays(from, 1), hour, minute);

  if (frequency === 'daily') return candidate;

  // Walk forward to the right weekday. At most seven steps, and each one
  // goes through a real Date so a DST boundary shifts with the platform
  // rather than against a 24-hour constant.
  for (let i = 0; i < 7; i++) {
    if (candidate.getDay() === weekday) return candidate;
    candidate = atTimeOn(addDays(candidate, 1), hour, minute);
  }
  return null;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Whether a run is overdue, and how many windows went by unattended.
 *
 * `lastRunAt` is a timestamp or null for "never run".
 *
 * The missed count is what makes this honest on a desktop. A machine
 * asleep at 2 AM does not fail the schedule, it simply is not there for
 * it -- and "3 runs missed" is the difference between the feature being
 * broken and the machine having been off. */
export function dueRun(schedule, lastRunAt, now = new Date()) {
  const idle = { due: false, missed: 0, nextRun: null };
  if (!isValid(schedule)) return idle;

  const nextRun = nextRunAfter(schedule, now);

  // A lastRun in the future means the clock moved backwards. Treating that
  // as "many runs missed" would fire a clean immediately on a machine
  // whose only problem was its time zone.
  if (Number.isFinite(lastRunAt) && lastRunAt > now.getTime()) return { ...idle, nextRun };

  // Never run: due as soon as the first window has passed. The window it
  // would have used is the most recent one before now.
  const previous = previousRunBefore(schedule, now);
  if (!previous) return { ...idle, nextRun };

  if (!Number.isFinite(lastRunAt)) {
    // Never run. Due only if the most recent window is TODAY's -- a
    // schedule switched on this morning must not immediately fire for a
    // window that passed before it existed, and a weekly one enabled on a
    // Tuesday must not run because last Sunday went by.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return previous >= startOfToday
      ? { due: true, missed: 0, nextRun }
      : { ...idle, nextRun };
  }
  if (lastRunAt >= previous.getTime()) return { due: false, missed: 0, nextRun };

  // Count the windows between the last run and now, capped. The window
  // that is due right now is not "missed" -- it is the one about to run.
  let missed = 0;
  let cursor = previous;
  while (missed < MAX_REPORTED_MISSES) {
    const earlier = previousRunBefore(schedule, cursor);
    if (!earlier || earlier.getTime() <= lastRunAt) break;
    missed++;
    cursor = earlier;
  }

  return { due: true, missed, nextRun };
}

/** The most recent scheduled moment at or before `before`. */
function previousRunBefore(schedule, before) {
  if (!isValid(schedule)) return null;
  const { frequency, hour, minute, weekday } = schedule;

  // Strictly before. Given a moment that IS a scheduled time -- which is
  // exactly what the missed-run walk passes in -- returning it unchanged
  // makes the loop step nowhere and spin until it hits the cap.
  let candidate = atTimeOn(before, hour, minute);
  if (candidate >= before) candidate = atTimeOn(addDays(before, -1), hour, minute);

  if (frequency === 'daily') return candidate;

  for (let i = 0; i < 7; i++) {
    if (candidate.getDay() === weekday) return candidate;
    candidate = atTimeOn(addDays(candidate, -1), hour, minute);
  }
  return null;
}

/** The schedule as a sentence, for the screen. */
export function describeSchedule(schedule) {
  if (!isValid(schedule)) return 'Off';
  const time = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
  return schedule.frequency === 'weekly'
    ? `Every ${WEEKDAYS[schedule.weekday]} at ${time}`
    : `Every day at ${time}`;
}
