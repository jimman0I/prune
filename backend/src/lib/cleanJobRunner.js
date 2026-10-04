import {
  scanRulesProgressively, executeRulesProgressively, scanAllRules, loadCleanerRules, executeRule
} from './cleanerRules.js';

/** One Deep Clean job, run against the real cleaner and reported as plain
 * messages. This is the part that runs inside the worker thread (see
 * cleanWorker.js), kept apart from the thread plumbing so it can be run, and
 * tested, in the calling thread too.
 *
 * `job` is `{ op, ids?, guards }`:
 *   - `scan`      -- the streamed scan, a rule at a time (scanRulesProgressively)
 *   - `scanAll`   -- the one-shot scan, grouped by category (scanAllRules)
 *   - `execute`   -- the streamed clean of `ids` (executeRulesProgressively)
 *   - `executeOne`-- one rule by id (executeRule), for the tray's Quick Clean
 *
 * `post(message)` receives `{ type: 'rule', item }` and `{ type: 'progress',
 * progress }` as they happen; the return value is the job's summary, exactly
 * what the in-thread function would have returned. `signal` stops a streamed job
 * between rules, as it always has. */
export async function runCleanJob({ op, ids = [], guards = {} }, { post = () => {}, signal } = {}) {
  const onProgress = (progress) => post({ type: 'progress', progress });
  const onItem = (item) => post({ type: 'rule', item });

  switch (op) {
    case 'scan':
      return scanRulesProgressively(onItem, { ...guards, signal, onProgress });
    case 'scanAll':
      return { categories: scanAllRules(guards) };
    case 'execute':
      return executeRulesProgressively(ids, onItem, { ...guards, signal, onProgress });
    case 'executeOne': {
      const rule = loadCleanerRules().find((r) => r.id === ids[0]);
      return { result: rule ? await executeRule(rule, guards) : null };
    }
    default:
      throw new Error(`Unknown clean job "${op}".`);
  }
}
