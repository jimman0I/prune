import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildRootsExpression } from './leftoverScan.js';

const execFileAsync = promisify(execFile);

/** These run REAL PowerShell on purpose.
 *
 * leftoverScan.test.js mocks runPowerShellJson, which is right for testing
 * the JS around the call -- and is exactly why a broken script survived in
 * this file for as long as it did. Every search root is a raw PowerShell
 * expression fragment pasted into an array literal, so a quoting mistake
 * in one of them is a parse error that takes the whole file scan down, and
 * a mocked test can never see it: the script is just a string nobody runs.
 *
 * The bug these exist to catch (found dogfooding, 2026-09-02): the Start
 * Menu root was interpolated unquoted, and its spaces ("Start Menu")
 * turned the array literal into a syntax error. Every file scan since the
 * feature was written returned { ok: false, items: [] }, which the UI
 * renders as "Couldn't check files & folders." The file half of the
 * leftover scan -- the app's headline feature -- had never once worked. */
describe('buildRootsExpression (real PowerShell)', () => {
  it('parses as valid PowerShell and resolves to real directories', async () => {
    const script = `$roots = ${buildRootsExpression()} | Where-Object { $_ -and (Test-Path $_) }
$roots.Count`;
    const { stdout, stderr } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 20000 }
    );
    expect(stderr).toBe('');
    expect(Number(stdout.trim())).toBeGreaterThan(0);
  }, 30000);

  it('includes the Start Menu root, whose spaces are what broke the original', async () => {
    const script = `$roots = ${buildRootsExpression()}
$roots -join "\`n"`;
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 20000 }
    );
    expect(stdout).toMatch(/Start Menu[\\/]Programs/i);
  }, 30000);

  it('includes the per-user Programs directory where Electron apps install', async () => {
    // %LOCALAPPDATA%\Programs is where Electron/Squirrel installers put
    // things (VS Code, Discord, Slack). The original roots only listed
    // %LOCALAPPDATA% itself and never recursed, so an app one level down
    // in Programs was invisible to the scan even once it ran.
    const script = `$roots = ${buildRootsExpression()}
$roots -join "\`n"`;
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 20000 }
    );
    expect(stdout).toMatch(/AppData[\\/]Local[\\/]Programs/i);
  }, 30000);
});
