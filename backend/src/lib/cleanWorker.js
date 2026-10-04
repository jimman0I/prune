import { parentPort, workerData } from 'node:worker_threads';
import { runCleanJob } from './cleanJobRunner.js';
import { onWipeStateChange } from './cleanerActions/wipeFreeSpace.js';

/** The thread a Deep Clean scan or clean runs on (started by
 * cleanWorkerHost.js), so that walking a huge cache folder with synchronous
 * file calls blocks this thread and not the one that serves the window, the
 * tray and every other request.
 *
 * It takes one job from `workerData`, reports `rule` / `progress` messages as
 * they happen, then exactly one `done` (with the summary) or `error`. The only
 * thing it accepts back is `abort`, which stops a streamed job between rules --
 * the same point a Stop has always taken effect, so a rule that is half way
 * through moving files into Quarantine finishes rather than being cut off.
 *
 * Nothing in here touches Electron (it is not available in a worker). It does
 * not record the lifetime "freed" total either: the thread that started the job
 * does that from the results it relays, so there is one writer of stats.json.
 * The environment (UNREVO_SETTINGS_PATH, UNREVO_QUARANTINE_ROOT, ...) is a copy
 * of the process's at the time the worker was started. */
if (parentPort) {
  const port = parentPort;
  const controller = new AbortController();
  port.on('message', (message) => {
    if (message?.type === 'abort') controller.abort();
  });
  // A free-space wipe takes the "one at a time" flag in THIS thread; the main
  // thread's Wipe estimate needs to know about it too.
  onWipeStateChange((running) => port.postMessage({ type: 'wipe', running }));

  runCleanJob(workerData, { post: (message) => port.postMessage(message), signal: controller.signal })
    .then((summary) => port.postMessage({ type: 'done', summary }))
    .catch((err) => port.postMessage({ type: 'error', message: err?.message ?? String(err) }));
}
