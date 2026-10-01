import { readFileSync, writeFileSync } from 'node:fs';
import { executeRules } from './cleanerRules.js';

/** The elevated half of "Clean as administrator" -- the only part that
 * runs with a higher integrity level, and only for the rules a normal
 * scan already reported `accessible: false` on (Prefetch, the Defender
 * log folders, CBS logs -- directories Windows refuses to even LIST
 * without administrator, not files locked by another process, which
 * elevation doesn't fix either way).
 *
 * Deliberately thin: it does exactly what the ordinary (unelevated)
 * POST /deep-clean/execute route does -- loadCleanerRules + executeRules
 * -- from a process that happens to be elevated, rather than
 * re-implementing cleaning logic a second time. `guards` is computed by
 * the unelevated caller from the real settings.json and handed in via a
 * file, not re-derived here: `Start-Process -Verb RunAs` launches a
 * fresh process that does not inherit this app's environment, so this
 * worker has no reliable way to find settings.json on its own, and
 * re-deriving guards here would be the one place they could silently
 * drift from what the confirm screen the user actually saw promised.
 *
 * Invoked as: elevatedCleanWorker.js <ruleIdsCsv> <guardsJsonPath> <outputPath>
 * Always writes JSON to <outputPath>, including on failure -- the
 * unelevated parent cannot see this process's stderr (it runs at a
 * higher integrity level), so an error that isn't written to the file is
 * an error nobody ever sees. */
const [ruleIdsCsv, guardsPath, outPath] = process.argv.slice(2);

run(ruleIdsCsv, guardsPath)
  .then((result) => writeFileSync(outPath, JSON.stringify(result), 'utf8'))
  .catch((err) => {
    try {
      writeFileSync(outPath, JSON.stringify({ __error: err.message }), 'utf8');
    } catch { /* nothing left to try */ }
    process.exitCode = 1;
  });

async function run(csv, path) {
  const ruleIds = String(csv || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ruleIds.length === 0) throw new Error('No rule ids were given.');
  const guards = JSON.parse(readFileSync(path, 'utf8'));
  return executeRules(ruleIds, guards);
}
