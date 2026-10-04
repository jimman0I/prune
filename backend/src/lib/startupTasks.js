/** When the start-up housekeeping runs, counted from the moment the server is
 * listening.
 *
 * Opening the window is the one moment the person is waiting on Prune, and it
 * is also when the renderer's own first requests (program list, sizes, drive
 * health) land. Everything below is upkeep that nobody is waiting for -- a
 * leftover sweep, a Task Scheduler check, a quarantine pass, each of which
 * spawns a process or walks a folder -- so it waits until that first load is
 * over instead of competing with it. Twenty seconds is comfortably past the
 * window's first paint and first data without leaving the upkeep undone for
 * long. */
export const HOUSEKEEPING_DELAY_MS = 20_000;

/** The schedule's catch-up is the one start-up task a person can notice, so it
 * does not wait for the housekeeping: a window that passed while the machine
 * was off is picked up a few seconds after Prune opens. Still later than the
 * window's first load, and it costs one settings read unless a run is due. */
export const SCHEDULE_CATCHUP_DELAY_MS = 5_000;

/** Runs `fn` once, `delayMs` from now, on a timer that never keeps the
 * process alive. Returns the timer so a caller (or a test) can cancel it. */
export function runLater(delayMs, fn, { setTimer = setTimeout } = {}) {
  const timer = setTimer(fn, delayMs);
  timer?.unref?.();
  return timer;
}

/** Runs the given tasks one after another, `delayMs` from now. A task that
 * throws or rejects is reported to `onError` and the next one still runs --
 * upkeep that cannot run is never a reason for the app not to work, and one
 * failure must not take the rest with it.
 *
 * `tasks` is a list of `{ name, run }`. Sequential on purpose: they used to
 * start together at launch, which is what made the first seconds so busy. */
export function scheduleHousekeeping(tasks, {
  delayMs = HOUSEKEEPING_DELAY_MS,
  setTimer = setTimeout,
  onError = () => {}
} = {}) {
  return runLater(delayMs, async () => {
    for (const task of tasks) {
      try {
        await task.run();
      } catch (err) {
        try { onError(task.name, err); } catch { /* reporting must not stop the pass */ }
      }
    }
  }, { setTimer });
}
