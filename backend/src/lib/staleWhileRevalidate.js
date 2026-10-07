/** Like memoizeAsync, but the first answer of a launch can be last launch's.
 *
 * `compute` is the slow, honest answer. `store` (a snapshotStore) holds the
 * previous one on disk. The first call of a process that finds a snapshot
 * returns it at once and starts the real computation in the background; when
 * that finishes the answer is kept in memory (and saved) and later calls get
 * it. With no snapshot -- the first launch ever, or a store with no path --
 * callers wait for one shared run, exactly as with memoizeAsync.
 *
 * Once something is held, a call never waits: past `ttlMs` it returns what it
 * has and refreshes behind it. That is acceptable because this is only ever
 * decoration (icons, a list of things that were there a minute ago), the row it
 * belongs to comes from a fresh read, and the window asks again shortly after.
 *
 * A failed or unwanted background run never replaces what is held: `accept`
 * says whether a fresh answer is worth keeping (the Store scan reports a
 * failure as an empty list, and an empty list must not erase 80 icons). With
 * nothing held, a rejection reaches the caller and is not remembered. */
export function staleWhileRevalidate(compute, { store = null, ttlMs = 0, accept = () => true, now = Date.now } = {}) {
  let value;
  let settledAt = null;
  let inflight = null;
  let snapshotLoad = null;

  /** Reads the snapshot once, however many callers arrive at the same time. */
  const loadSnapshot = () => {
    if (!snapshotLoad) {
      snapshotLoad = (async () => {
        const saved = store ? await store.read().catch(() => null) : null;
        if (saved !== null && saved !== undefined && settledAt === null) {
          value = saved;
          settledAt = now();
          // Last launch's answer is what the caller gets; this launch's is made behind it.
          refresh().catch(() => { /* the snapshot stays; the next ask retries */ });
        }
      })();
    }
    return snapshotLoad;
  };

  const refresh = () => {
    if (!inflight) {
      let started;
      try {
        started = Promise.resolve(compute());
      } catch (err) {
        started = Promise.reject(err);
      }
      inflight = started
        .then((result) => {
          if (accept(result)) {
            value = result;
            settledAt = now();
            if (store) store.write(result).catch(() => {});
          } else if (settledAt === null) {
            // Nothing better is held, so an unwanted answer still beats none;
            // it is just never saved.
            value = result;
            settledAt = now();
          }
          return result;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };

  const run = async () => {
    await loadSnapshot();
    if (settledAt === null) return refresh(); // nothing to show: wait for the real answer
    if (now() - settledAt >= ttlMs) {
      settledAt = now(); // one refresh per period, not one per call
      refresh().catch(() => {});
    }
    return value;
  };

  run.clear = () => {
    value = undefined;
    settledAt = null;
    snapshotLoad = Promise.resolve(); // a test clearing the cache wants a real run, not the disk
  };
  /** Resolves when no run is in flight. For tests and the warm-up. */
  run.settled = async () => { while (inflight) await inflight.catch(() => {}); };
  return run;
}
