import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 120_000;

/** Runs a PowerShell script ELEVATED and returns its JSON output.
 *
 * Three things on Windows genuinely need administrator, and every one of
 * them is something Prune's competitors do: drive wear counters
 * (Get-StorageReliabilityCounter), raw NTFS MFT reads (the WizTree-speed
 * scan), and force-removing another program's leftovers out of HKLM. So
 * this is a shared primitive rather than a one-off inside diskHealth.js.
 *
 * Mechanism: `Start-Process -Verb RunAs` is the real Windows elevation
 * path -- it raises the UAC consent dialog the user must click. An
 * elevated child runs at a higher integrity level than this process, so
 * its stdout can NOT simply be piped back (the parent can't attach to it);
 * the standard workaround, used here, is to have the elevated script write
 * its JSON to a temp file that the unelevated parent then reads back.
 *
 * `-WindowStyle Hidden` keeps a console window from flashing up, and the
 * outer call waits (-Wait) so the temp file is complete before it's read.
 *
 * NEVER call this without a real user action behind it. Elevation is the
 * user's decision every single time: the caller must be a button they
 * pressed, not a background refresh. A UAC prompt nobody asked for is how
 * software teaches people to click "Yes" without reading.
 *
 * Returns a discriminated result rather than throwing, because "the user
 * clicked No" is an ordinary outcome, not an error:
 *   { ok: true,  data }
 *   { ok: false, cancelled: true }   -- UAC declined or dismissed
 *   { ok: false, error }             -- anything genuinely broken
 */
export async function runElevatedPowerShellJson(script, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let workDir;
  try {
    workDir = mkdtempSync(join(tmpdir(), 'prune-elevated-'));
  } catch (err) {
    return { ok: false, error: `Couldn't create a temp directory: ${err.message}` };
  }

  const scriptPath = join(workDir, 'query.ps1');
  const outPath = join(workDir, 'out.json');

  try {
    // The elevated script writes its own result to disk. Its whole body is
    // wrapped so a failure inside it still produces a readable file rather
    // than an empty one the parent has to guess about.
    const wrapped = `
$ErrorActionPreference = 'Stop'
try {
  $result = & {
${script}
  }
  Set-Content -LiteralPath ${quote(outPath)} -Value $result -Encoding UTF8
} catch {
  Set-Content -LiteralPath ${quote(outPath)} -Value (ConvertTo-Json -Compress -InputObject @{ __error = $_.Exception.Message }) -Encoding UTF8
}
`;
    writeFileSync(scriptPath, wrapped, 'utf8');

    const launcher = `Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',${quote(scriptPath)}`;

    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', launcher], { timeout: timeoutMs });
    } catch (err) {
      // Declining the UAC dialog surfaces here, not as a clean exit code.
      // Windows reports it as "The operation was canceled by the user"
      // (error 1223); matching on the message keeps this readable across
      // the localised variants that still carry the same wording in the
      // .NET exception.
      const message = `${err.message || ''}`;
      if (/canceled by the user|cancelled by the user|1223/i.test(message)) {
        return { ok: false, cancelled: true };
      }
      return { ok: false, error: message.trim() || 'Elevated PowerShell failed to start.' };
    }

    if (!existsSync(outPath)) {
      // The elevated process ran but produced nothing -- treat as a
      // cancel rather than an error: the overwhelmingly common cause is
      // the consent dialog being dismissed before the script ever ran.
      return { ok: false, cancelled: true };
    }

    const raw = readFileSync(outPath, 'utf8').trim();
    if (!raw) return { ok: false, error: 'The elevated query returned nothing.' };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return { ok: false, error: `The elevated query returned non-JSON output: ${err.message}` };
    }
    if (parsed && parsed.__error) return { ok: false, error: parsed.__error };

    return { ok: true, data: parsed };
  } finally {
    // The temp script and its output both carry whatever the caller asked
    // for; neither should outlive the call.
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Runs a Node script ELEVATED and returns the JSON it writes.
 *
 * Same elevation mechanism and same contract as the PowerShell version
 * above -- including that it must never be called without a real user
 * action behind it -- but for work PowerShell simply can't do. The MFT
 * scan is the case: it reads and parses hundreds of megabytes of binary
 * records, which is fine in Node and hopeless in a PowerShell script.
 *
 * The script is invoked with its own arguments plus the output path as
 * the last one, and is expected to write JSON there.
 *
 * Two Windows details this has to get right:
 *
 *  - In a PACKAGED app there is no node.exe to run. Electron's own
 *    executable becomes a plain Node interpreter when ELECTRON_RUN_AS_NODE
 *    is set, so that's the interpreter here.
 *
 *  - `Start-Process -Verb RunAs` goes through the elevation broker, and
 *    relying on it to carry an environment variable through is asking for
 *    trouble. A tiny .cmd shim sets the variable in the elevated process
 *    itself, where it definitely applies.
 */
export async function runElevatedNodeJson(scriptPath, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let workDir;
  try {
    workDir = mkdtempSync(join(tmpdir(), 'prune-elevated-node-'));
  } catch (err) {
    return { ok: false, error: `Couldn't create a temp directory: ${err.message}` };
  }

  const outPath = join(workDir, 'out.json');
  const shimPath = join(workDir, 'run.cmd');

  try {
    const quotedArgs = [scriptPath, ...args, outPath].map((a) => `"${a}"`).join(' ');
    const shim = [
      '@echo off',
      'set ELECTRON_RUN_AS_NODE=1',
      `"${process.execPath}" ${quotedArgs}`,
      ''
    ].join('\r\n');
    writeFileSync(shimPath, shim, 'utf8');

    const launcher = `Start-Process -FilePath ${quote(shimPath)} -Verb RunAs -WindowStyle Hidden -Wait`;

    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', launcher], { timeout: timeoutMs });
    } catch (err) {
      const message = `${err.message || ''}`;
      if (/canceled by the user|cancelled by the user|1223/i.test(message)) {
        return { ok: false, cancelled: true };
      }
      return { ok: false, error: message.trim() || 'The elevated helper failed to start.' };
    }

    if (!existsSync(outPath)) return { ok: false, cancelled: true };

    const raw = readFileSync(outPath, 'utf8').trim();
    if (!raw) return { ok: false, error: 'The elevated helper returned nothing.' };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return { ok: false, error: `The elevated helper returned non-JSON output: ${err.message}` };
    }
    if (parsed && parsed.__error) return { ok: false, error: parsed.__error };

    return { ok: true, data: parsed };
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** PowerShell single-quoted literal: the only escape inside one is a
 * doubled quote, and nothing else is interpreted -- which is exactly why
 * paths go in single quotes here rather than double. */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
