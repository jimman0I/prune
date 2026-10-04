import { Worker } from 'node:worker_threads';
import { setWipeRunningElsewhere } from './cleanerActions/wipeFreeSpace.js';

/** Where the worker lives: next to this file, resolved the way
 * services/mftScan.js finds lib/ntfs/mftWorker.js. The packaged app ships
 * backend/src as plain files (electron-builder.config.cjs extraResources), not
 * inside the asar, so the same relative path works there. */
export const CLEAN_WORKER_URL = new URL('./cleanWorker.js', import.meta.url);

/** How long a Stop waits for a clean to reach the end of the rule it is in
 * before the thread is ended anyway. A rule normally finishes in seconds; this
 * is only the backstop for one that is stuck. */
export const ABORT_GRACE_MS = 30_000;

/** Runs one Deep Clean job (see cleanJobRunner.js) on a worker thread and
 * resolves to its summary, relaying the rules and progress it reports to
 * `onItem` / `onProgress` in the order they happened. Rejects with the worker's
 * error, or with a plain Error if the thread dies without finishing.
 *
 * `signal` is the caller's Stop:
 *   - a scan is read-only, so the thread is ended at once and the call resolves
 *     `{ aborted: true }`;
 *   - a clean is asked to stop and given the rest of the rule it is in to finish
 *     (a batch half-moved into Quarantine is a worse state than a finished
 *     one), exactly as the in-thread version always behaved. It resolves with
 *     the worker's own summary; only if that takes longer than `graceMs` is the
 *     thread ended and `{ aborted: true }` returned.
 *
 * A throw from `onItem` / `onProgress` ends the job and rejects, as it would
 * have unwound the in-thread loop. */
export function runCleanJobInWorker(job, {
  onItem = () => {}, onProgress = () => {}, signal, graceMs = ABORT_GRACE_MS,
  workerUrl = CLEAN_WORKER_URL, createWorker = (url, options) => new Worker(url, options)
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let graceTimer = null;
    let wipeRunning = false;
    let worker;

    const settle = (complete, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      signal?.removeEventListener('abort', onAbort);
      if (wipeRunning) setWipeRunningElsewhere(false);
      // Whatever is left of the thread goes: it has delivered its answer, or is
      // being given up on.
      worker?.terminate?.()?.catch?.(() => {});
      complete(value);
    };

    function onAbort() {
      if (settled) return;
      if (job.op === 'execute') {
        worker.postMessage({ type: 'abort' });
        graceTimer = setTimeout(() => settle(resolve, { aborted: true }), graceMs);
        graceTimer.unref?.();
      } else {
        settle(resolve, { aborted: true });
      }
    }

    try {
      worker = createWorker(workerUrl, { workerData: job });
    } catch (err) {
      reject(err);
      return;
    }

    worker.on('message', (message) => {
      if (settled) return;
      try {
        switch (message?.type) {
          case 'rule': onItem(message.item); break;
          case 'progress': onProgress(message.progress); break;
          case 'wipe':
            wipeRunning = message.running === true;
            setWipeRunningElsewhere(wipeRunning);
            break;
          case 'done': settle(resolve, message.summary); break;
          case 'error': settle(reject, new Error(message.message)); break;
          default: break;
        }
      } catch (err) {
        settle(reject, err);
      }
    });
    worker.on('error', (err) => settle(reject, err));
    worker.on('exit', (code) => {
      settle(reject, new Error(`The clean worker stopped before it finished (exit code ${code}).`));
    });

    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
