/** Wraps an async computation so that callers who arrive while it is running
 * share the one run instead of each starting their own, and (optionally) so
 * that an answer is kept for `ttlMs` afterwards.
 *
 * This is what lets the slow, decorative program lookups (icons, install
 * dates, Store icons) be computed on the first request from the window
 * rather than eagerly at start-up: the window asks for several things at
 * once, and without this each ask would repeat the same PowerShell or
 * filesystem pass.
 *
 * A rejection is handed to everyone waiting on that run and is never kept,
 * so a failed lookup is retried by the next caller rather than remembered as
 * an empty answer. */
export function memoizeAsync(compute, { ttlMs = 0, now = Date.now } = {}) {
  let inflight = null;
  let value;
  let settledAt = null;

  const run = () => {
    if (settledAt !== null && ttlMs > 0 && now() - settledAt < ttlMs) {
      return Promise.resolve(value);
    }
    if (!inflight) {
      let started;
      try {
        started = Promise.resolve(compute());
      } catch (err) {
        started = Promise.reject(err);
      }
      inflight = started
        .then((result) => {
          value = result;
          settledAt = now();
          return result;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };

  /** Forgets the kept answer. A run already in flight still completes for
   * the callers waiting on it. */
  run.clear = () => {
    value = undefined;
    settledAt = null;
  };

  return run;
}
