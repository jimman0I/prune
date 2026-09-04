import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRule, executeRule } from '../lib/cleanerRules.js';
import { quarantineRoot } from './quarantine.js';

/** The environment this redirects for the duration of one run.
 *
 * LOCALAPPDATA is what the rule's own paths expand against, and
 * UNREVO_QUARANTINE_ROOT is where executeRule moves what it takes -- both
 * have to point inside the sandbox, or a test of the destructive path
 * would leave real files in the real quarantine. */
const ENV_KEYS = ['LOCALAPPDATA', 'UNREVO_QUARANTINE_ROOT'];

/** The rule this exercises: the user temp folder.
 *
 * Chosen because it is the one Deep Clean rule that is both a plain
 * path-glob (so the sandbox can reproduce it exactly) and genuinely
 * destructive on a real machine, which is what makes proving it worth
 * doing at all. */
const RULE = {
  id: 'sandbox_user_temp',
  category: 'Sandbox',
  name: 'Temp folder',
  description: 'A copy of the real user_temp rule, pointed at the sandbox.',
  paths: ['%LOCALAPPDATA%\\Temp\\*'],
  is_safe: true,
  recommended: true
};

/** Proves the real destructive logic in cleanerRules.js (scanRule /
 * executeRule) actually works, without ever touching this machine's own
 * files.
 *
 * This used to exercise cleanup.js, which is gone -- the Smart Cleanup
 * screen it belonged to was replaced by Deep Clean's one list of
 * everything. The self-test moved with it rather than being deleted:
 * executeRule is now the ONLY destructive path in the app outside an
 * uninstall, so it is the code most worth proving.
 *
 * Deliberately does NOT create anything inside the real %LOCALAPPDATA%
 * (a literal "%LOCALAPPDATA%\Temp\prune-sandbox" path, which is what a
 * naive version of this would do) -- that is still inside the folder the
 * real rule sweeps, so a bug here could take real files with it. Instead
 * LOCALAPPDATA itself is redirected at a genuinely separate mkdtemp
 * directory for the duration of this one run, and restored in a `finally`
 * no matter what happens.
 *
 * Returns a structured, per-step report rather than a single boolean, so a
 * failure says exactly which step broke instead of just "something's
 * wrong." */
export async function runSandboxTest() {
  const steps = [];
  let sandboxDir = null;
  const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

  try {
    sandboxDir = mkdtempSync(join(tmpdir(), 'prune-sandbox-'));
    steps.push({ name: 'Create an isolated sandbox directory', passed: true, detail: sandboxDir });

    const localAppData = join(sandboxDir, 'localappdata');
    const tempDir = join(localAppData, 'Temp');
    const quarantineDir = join(sandboxDir, 'quarantine');
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(quarantineDir, { recursive: true });
    writeFileSync(join(tempDir, 'dummy1.txt'), '12345'); // 5 bytes
    writeFileSync(join(tempDir, 'dummy2.txt'), '1234567890'); // 10 bytes
    const expectedBytes = 15;
    steps.push({
      name: 'Populate dummy junk files with known sizes',
      passed: true,
      detail: `${expectedBytes} bytes across 2 files`
    });

    // Both, not just LOCALAPPDATA: executeRule quarantines what it takes,
    // and without the second redirect this test would deposit its dummy
    // files in the user's real quarantine and count as a real batch.
    process.env.LOCALAPPDATA = localAppData;
    process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
    steps.push({
      name: "Redirect the rule's root and the quarantine at the sandbox",
      passed: true,
      detail: 'LOCALAPPDATA / UNREVO_QUARANTINE_ROOT overridden'
    });

    // Proves the redirect actually took, before anything is deleted. A
    // sandbox test whose paths silently still pointed at the real machine
    // would pass every later step while doing the damage it exists to
    // rule out.
    const redirectOk = quarantineRoot() === quarantineDir;
    steps.push({
      name: 'Confirm the redirect took effect before deleting anything',
      passed: redirectOk,
      detail: redirectOk ? `quarantine resolves to ${quarantineDir}` : `quarantine still resolves to ${quarantineRoot()}`
    });
    if (!redirectOk) throw new Error('the sandbox redirect did not take effect — refusing to run the destructive step');

    const scan = scanRule(RULE);
    const scanOk = scan.sizeBytes === expectedBytes && scan.fileCount === 2 && scan.present === true;
    steps.push({
      name: 'Run the real scanRule() against the sandbox',
      passed: scanOk,
      detail: `${scan.sizeBytes}B across ${scan.fileCount} files (expected ${expectedBytes}B across 2)`
    });
    if (!scanOk) throw new Error('scanRule() did not report the expected sandbox sizes');

    const result = await executeRule(RULE);
    const executeOk = result.freedBytes === expectedBytes && result.skipped.length === 0;
    steps.push({
      name: 'Run the real executeRule() against the sandbox',
      passed: executeOk,
      detail: `freed ${result.freedBytes}B (expected ${expectedBytes}), ${result.skipped.length} skipped`
    });
    if (!executeOk) throw new Error('executeRule() did not free the expected amount');

    const contentsGone = !existsSync(join(tempDir, 'dummy1.txt')) && !existsSync(join(tempDir, 'dummy2.txt'));
    const rootSurvives = existsSync(tempDir);
    const quarantined = existsSync(quarantineDir) && readdirSync(quarantineDir).length > 0;
    const verifyOk = contentsGone && rootSurvives && quarantined;
    steps.push({
      name: 'Verify the files moved to quarantine and the folder survived',
      passed: verifyOk,
      detail: verifyOk
        ? "contents quarantined, folder intact -- matches executeRule's real contract"
        : `gone=${contentsGone}, folder=${rootSurvives}, quarantined=${quarantined}`
    });
    if (!verifyOk) throw new Error('post-clean filesystem state did not match the expected contract');

    return { passed: true, steps, error: null };
  } catch (err) {
    return { passed: false, steps, error: err.message };
  } finally {
    // Unconditional restore -- whether the test passed, failed, or threw
    // somewhere unexpected, this must never leave the cleaner rules or the
    // quarantine pointed at the sandbox for any real request that arrives
    // afterward.
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    if (sandboxDir && existsSync(sandboxDir)) {
      try { rmSync(sandboxDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  }
}
