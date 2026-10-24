import {
  scanRulesProgressively, executeRulesProgressively, scanAllRules, loadCleanerRules, executeRule
} from './cleanerRules.js';
import { scanJunkFiles, removeJunkFiles } from '../services/junkScan.js';

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
 *   - `junkScan`  -- the Junk files scan of `roots` for `patterns`
 *                    (services/junkScan.js); its batches of found files are
 *                    posted as `rule` messages carrying `{ files }`, so the
 *                    host relays them exactly as it relays a rule
 *   - `junkRemove`-- the removal of the ticked `paths` from that scan
 *
 * `post(message)` receives `{ type: 'rule', item }` and `{ type: 'progress',
 * progress }` as they happen; the return value is the job's summary, exactly
 * what the in-thread function would have returned. `signal` stops a streamed job
 * between rules, as it always has. */
export async function runCleanJob(job, { post = () => {}, signal } = {}) {
  const { op, ids = [], guards = {} } = job ?? {};
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
    case 'junkScan':
      return scanJunkFiles({
        roots: job.roots, patterns: job.patterns, footprints: job.footprints, guards,
        signal, onProgress, onFiles: (files) => onItem({ files })
      });
    case 'junkRemove':
      return removeJunkFiles(job.paths, { patterns: job.patterns, footprints: job.footprints, guards });
    default:
      throw new Error(`Unknown clean job "${op}".`);
  }
}
