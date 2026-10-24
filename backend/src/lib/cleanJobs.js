import {
  scanRulesProgressively, executeRulesProgressively, scanAllRules, executeRules, loadCleanerRules, executeRule
} from './cleanerRules.js';
import { runCleanJobInWorker } from './cleanWorkerHost.js';
import { scanJunkFiles, removeJunkFiles } from '../services/junkScan.js';

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

/** The Junk files scan (services/junkScan.js) on the worker:
 * `job` is { roots, patterns, footprints, guards }; found files arrive at
 * `onFiles(batch)` as the walk finds them. Stop ends the thread at once -- the
 * scan only reads -- and resolves `{ aborted: true }`; the batches already
 * relayed stay true. */
export function scanJunk(job, { onFiles = () => {}, onProgress, signal } = {}) {
  if (inThread()) return scanJunkFiles({ ...job, signal, onProgress, onFiles });
  return runCleanJobInWorker({ op: 'junkScan', ...job }, { onItem: (item) => onFiles(item?.files ?? []), onProgress, signal });
}

/** Removing what the person ticked: `job` is { paths, patterns, footprints,
 * guards }. No signal on purpose: a batch half-moved into Quarantine is a
 * worse state than a finished one, so a removal that has started finishes. */
export function removeJunk(job) {
  if (inThread()) return removeJunkFiles(job.paths, job);
  return runCleanJobInWorker({ op: 'junkRemove', ...job });
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
