import {
  scanRulesProgressively, executeRulesProgressively, scanAllRules, executeRules, loadCleanerRules, executeRule
} from './cleanerRules.js';
import { runCleanJobInWorker } from './cleanWorkerHost.js';

/** Where a Deep Clean scan or clean runs.
 *
 * It walks and deletes with synchronous file calls, and a cache folder can hold
 * hundreds of thousands of files. In the main process that stops the window,
 * the tray and every HTTP request for as long as the walk takes (seconds, for
 * Chrome's or Steam's shader cache), so by default each job runs on a worker
 * thread (cleanWorker.js) and this thread only relays what it reports.
 *
 * `UNREVO_CLEAN_IN_THREAD=1` runs the same functions in the calling thread
 * instead. That is for the test suite, whose tests replace the cleaner with
 * mocks that a worker thread could not see; it also gives a way to rule the
 * worker out when diagnosing a problem. The answers are the same either way.
 *
 * All of these take and return what the cleanerRules functions they stand in
 * for do, so a caller changes only the import. */
const inThread = () => process.env.UNREVO_CLEAN_IN_THREAD === '1';

/** Options for the worker are the plain guards; the signal and callbacks stay
 * here, where they can be called. */
function split({ signal, onProgress, ...guards } = {}) {
  return { signal, onProgress, guards };
}

/** scanRulesProgressively(onItem, { signal, onProgress, ...guards }) */
export function scanRules(onItem, options = {}) {
  if (inThread()) return scanRulesProgressively(onItem, options);
  const { signal, onProgress, guards } = split(options);
  return runCleanJobInWorker({ op: 'scan', guards }, { onItem, onProgress, signal });
}

/** executeRulesProgressively(ids, onItem, { signal, onProgress, ...guards }) */
export function executeRulesStreamed(ids, onItem, options = {}) {
  if (inThread()) return executeRulesProgressively(ids, onItem, options);
  const { signal, onProgress, guards } = split(options);
  return runCleanJobInWorker({ op: 'execute', ids, guards }, { onItem, onProgress, signal });
}

/** scanAllRules(guards) -> the categories, as one answer. */
export async function scanEverything(guards = {}) {
  if (inThread()) return scanAllRules(guards);
  const { categories } = await runCleanJobInWorker({ op: 'scanAll', guards });
  return categories;
}

/** executeRules(ids, guards) -> { freedBytes, movedBytes, results } */
export async function executeToSummary(ids, guards = {}) {
  if (inThread()) return executeRules(ids, guards);
  const { freedBytes, movedBytes, results } = await runCleanJobInWorker({ op: 'execute', ids, guards });
  return { freedBytes, movedBytes, results };
}

/** One rule by id -> its result, or null when there is no such rule. Passing no
 * guards runs it with the defaults, as the tray's Quick Clean always has. */
export async function executeRuleById(id, guards) {
  if (inThread()) {
    const rule = loadCleanerRules().find((r) => r.id === id);
    if (!rule) return null;
    return guards === undefined ? executeRule(rule) : executeRule(rule, guards);
  }
  const { result } = await runCleanJobInWorker({ op: 'executeOne', ids: [id], guards: guards ?? {} });
  return result;
}
