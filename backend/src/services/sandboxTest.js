import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanJunk, executeCleanup } from './cleanup.js';

const ENV_KEYS = ['UNREVO_TEMP_ROOT', 'UNREVO_WINDOWS_TEMP_ROOT', 'UNREVO_LOCALAPPDATA_ROOT'];

/** Proves the real destructive logic in cleanup.js (scanJunk/executeCleanup)
 * actually works, without ever touching this machine's real Temp/
 * LocalAppData/browser cache. Deliberately does NOT create anything inside
 * the real %TEMP% root itself (a literal "%TEMP%\unrevo-sandbox" path,
 * which is what a naive version of this would do) -- that's still a
 * subfolder OF the real root cleanup.js's tempFiles category scans, so a
 * bug here could sweep real files. Instead it uses cleanup.js's own
 * env-var-override testability hooks (the same UNREVO_TEMP_ROOT/
 * UNREVO_WINDOWS_TEMP_ROOT/UNREVO_LOCALAPPDATA_ROOT mechanism
 * cleanup.test.js already exercises) to redirect the REAL functions at a
 * genuinely separate mkdtemp-generated directory for the duration of this
 * one run, then restores the real values in a `finally` no matter what
 * happens -- a thrown error, an assertion failure, anything.
 *
 * Returns a structured, per-step report rather than a single boolean, so a
 * failure says exactly which step broke instead of just "something's
 * wrong." */
export async function runSandboxTest() {
  const steps = [];
  let sandboxDir = null;
  const savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));

  try {
    sandboxDir = mkdtempSync(join(tmpdir(), 'unrevo-sandbox-'));
    steps.push({ name: 'Create an isolated sandbox directory', passed: true, detail: sandboxDir });

    const tempDir = join(sandboxDir, 'temp');
    const winTempDir = join(sandboxDir, 'wintemp');
    const localAppDataDir = join(sandboxDir, 'localappdata');
    const explorerDir = join(localAppDataDir, 'Microsoft', 'Windows', 'Explorer');
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(winTempDir, { recursive: true });
    mkdirSync(explorerDir, { recursive: true });
    writeFileSync(join(tempDir, 'dummy1.txt'), '12345'); // 5 bytes
    writeFileSync(join(tempDir, 'dummy2.txt'), '1234567890'); // 10 bytes
    writeFileSync(join(explorerDir, 'thumbcache_256.db'), 'abcde'); // 5 bytes
    const expectedTempBytes = 15;
    const expectedThumbBytes = 5;
    steps.push({
      name: 'Populate dummy junk files with known sizes',
      passed: true,
      detail: `${expectedTempBytes} bytes of dummy temp files, ${expectedThumbBytes} bytes of dummy thumbnail cache`
    });

    // All three roots the tempFiles/thumbnailCache categories can read from
    // -- windowsTempRoot() specifically must be overridden too, not just
    // tempRoot(), or executeCleanup(['tempFiles']) below would fall back to
    // deleting the CONTENTS OF THE REAL C:\Windows\Temp.
    process.env.UNREVO_TEMP_ROOT = tempDir;
    process.env.UNREVO_WINDOWS_TEMP_ROOT = winTempDir;
    process.env.UNREVO_LOCALAPPDATA_ROOT = localAppDataDir;
    steps.push({
      name: "Redirect cleanup.js's root resolvers at the sandbox",
      passed: true,
      detail: 'UNREVO_TEMP_ROOT / UNREVO_WINDOWS_TEMP_ROOT / UNREVO_LOCALAPPDATA_ROOT overridden'
    });

    const scan = await scanJunk();
    const tempCategory = scan.categories.find(c => c.id === 'tempFiles');
    const thumbCategory = scan.categories.find(c => c.id === 'thumbnailCache');
    const scanOk = tempCategory?.sizeBytes === expectedTempBytes && thumbCategory?.sizeBytes === expectedThumbBytes;
    steps.push({
      name: 'Run the real scanJunk() against the sandbox',
      passed: scanOk,
      detail: `tempFiles=${tempCategory?.sizeBytes}B (expected ${expectedTempBytes}), thumbnailCache=${thumbCategory?.sizeBytes}B (expected ${expectedThumbBytes})`
    });
    if (!scanOk) throw new Error('scanJunk() did not report the expected sandbox sizes');

    const result = await executeCleanup(['tempFiles', 'thumbnailCache']);
    const executeOk = result.freedBytes === expectedTempBytes + expectedThumbBytes && result.skipped.length === 0;
    steps.push({
      name: 'Run the real executeCleanup() against the sandbox',
      passed: executeOk,
      detail: `freed ${result.freedBytes}B (expected ${expectedTempBytes + expectedThumbBytes}), ${result.skipped.length} skipped`
    });
    if (!executeOk) throw new Error('executeCleanup() did not free the expected amount');

    const contentsGone = !existsSync(join(tempDir, 'dummy1.txt'))
      && !existsSync(join(tempDir, 'dummy2.txt'))
      && !existsSync(join(explorerDir, 'thumbcache_256.db'));
    const rootsSurvive = existsSync(tempDir) && existsSync(explorerDir);
    const verifyOk = contentsGone && rootsSurvive;
    steps.push({
      name: 'Verify dummy files are gone but the sandbox root folders survive',
      passed: verifyOk,
      detail: verifyOk
        ? "contents deleted, root folders intact -- matches executeCleanup's real contract"
        : 'unexpected leftover filesystem state'
    });
    if (!verifyOk) throw new Error('post-cleanup filesystem state did not match the expected contract');

    return { passed: true, steps, error: null };
  } catch (err) {
    return { passed: false, steps, error: err.message };
  } finally {
    // Unconditional restore -- whether the test passed, failed, or threw
    // somewhere unexpected, this must never leave cleanup.js pointed at
    // the sandbox for any real request that arrives afterward.
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    if (sandboxDir && existsSync(sandboxDir)) {
      try { rmSync(sandboxDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  }
}
