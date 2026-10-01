import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runElevatedNodeJson } from '../lib/elevated.js';

const here = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(here, '..', 'lib', 'elevatedCleanWorker.js');

/** Re-runs a specific set of Deep Clean rules from an elevated process --
 * for the rules a normal scan already reported `accessible: false` on
 * (a directory Windows won't even list without administrator, like
 * Prefetch or the Defender log folders), not a general "run everything
 * as admin" switch. Only ever called from a button the user pressed
 * after seeing exactly which rules this would cover; see elevated.js's
 * own rule about never calling it from a background action.
 *
 * `guards` is written to a temp file rather than passed as an argument:
 * it is the same object cleanGuardsFrom(await getSettings()) already
 * built for the ordinary unelevated execute, so the elevated run cleans
 * under the identical rules (removal mode, exclusions, recency window)
 * the user's regular Settings already promise -- never a second,
 * drifted copy of that decision.
 *
 * Returns the discriminated result elevated.js's functions all use:
 *   { ok: true, data: { freedBytes, movedBytes, results } }
 *   { ok: false, cancelled: true }   -- UAC declined or dismissed
 *   { ok: false, error }
 */
export async function executeRulesElevated(ruleIds, guards, { timeoutMs } = {}) {
  if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
    return { ok: false, error: 'No rules were given to clean.' };
  }

  let workDir;
  try {
    workDir = mkdtempSync(join(tmpdir(), 'prune-elevated-clean-'));
  } catch (err) {
    return { ok: false, error: `Couldn't create a temp directory: ${err.message}` };
  }

  try {
    const guardsPath = join(workDir, 'guards.json');
    writeFileSync(guardsPath, JSON.stringify(guards || {}), 'utf8');

    return await runElevatedNodeJson(
      WORKER_PATH,
      [ruleIds.join(','), guardsPath],
      timeoutMs ? { timeoutMs } : {}
    );
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
