import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import { classifyScanError, SCAN_TOO_LARGE_MESSAGE } from './scanErrors.js';

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
export async function runElevatedNodeJson(scriptPath, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS, input, lines = false } = {}) {
  let workDir;
  try {
    workDir = mkdtempSync(join(tmpdir(), 'prune-elevated-node-'));
  } catch (err) {
    return { ok: false, error: `Couldn't create a temp directory: ${err.message}` };
  }

  const outPath = join(workDir, 'out.json');
  const shimPath = join(workDir, 'run.cmd');

  try {
    // A job too rich for a command line (a list of drives, the user's
    // exclusions) travels as a file next to the output: arguments pass
    // through a .cmd shim and a PowerShell quote, and a folder name with a
    // quote or a percent sign in it must not be able to change what runs.
    const jobArgs = [];
    if (input !== undefined) {
      const jobPath = join(workDir, 'job.json');
      writeFileSync(jobPath, JSON.stringify(input), 'utf8');
      jobArgs.push(jobPath);
    }
    const quotedArgs = [scriptPath, ...args, ...jobArgs, outPath].map((a) => `"${a}"`).join(' ');
    // The helper may die without writing anything (running out of memory is a
    // hard stop, not an exception). A file that is missing after the shim ran
    // would be read as a declined prompt, so the shim writes a failure line
    // itself in that case. A declined prompt never runs the shim at all, so
    // that reading stays true where it belongs.
    const crashed = JSON.stringify({ __error: 'The helper stopped before it finished.', __code: 'crashed' });
    const shim = [
      '@echo off',
      'set ELECTRON_RUN_AS_NODE=1',
      `"${process.execPath}" ${nodeFlags().join(' ')} ${quotedArgs}`,
      `if not exist "${outPath}" echo ${crashed}> "${outPath}"`,
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

    return readOutput(outPath, { lines, who: 'The elevated helper' });
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Runs the same Node worker as runElevatedNodeJson, in THIS process's own
 * privilege level and without any prompt.
 *
 * For a backend that is already Administrator: spawning a second elevated
 * process through RunAs would ask for consent the user already gave by
 * starting Prune that way, every single scan. The worker is identical and
 * so is the result shape, minus `cancelled` -- there is no dialog to
 * decline here, so a run that produced nothing is an error, never a
 * "no". */
export async function runNodeJson(scriptPath, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS, input, lines = false } = {}) {
  let workDir;
  try {
    workDir = mkdtempSync(join(tmpdir(), 'prune-node-'));
  } catch (err) {
    return { ok: false, error: `Couldn't create a temp directory: ${err.message}` };
  }

  const outPath = join(workDir, 'out.json');

  try {
    const jobArgs = [];
    if (input !== undefined) {
      const jobPath = join(workDir, 'job.json');
      writeFileSync(jobPath, JSON.stringify(input), 'utf8');
      jobArgs.push(jobPath);
    }

    let failure = null;
    try {
      await execFileAsync(process.execPath, [...nodeFlags(), scriptPath, ...args, ...jobArgs, outPath], {
        timeout: timeoutMs,
        windowsHide: true,
        // stderr is where a process that ran out of memory says so.
        maxBuffer: 4 * 1024 * 1024,
        // In a packaged app process.execPath is Prune's own executable,
        // which only acts as a plain Node interpreter with this set.
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      });
    } catch (err) {
      failure = err;
    }

    // The worker writes its own error to the output file before exiting
    // non-zero, and that message is worth more than "Command failed".
    if (existsSync(outPath) && statSync(outPath).size > 0) {
      const read = readOutput(outPath, { lines, who: 'The helper' });
      if (!read.ok || !failure) return read;
    }

    if (failure) {
      const detail = `${failure.stderr || ''}`.trim();
      // A heap that ran out is a fatal stop with no output file; its stderr is
      // the only place that says so.
      const code = classifyScanError(detail) ?? classifyScanError(failure.message || '');
      if (code) return { ok: false, error: SCAN_TOO_LARGE_MESSAGE, code };
      return { ok: false, error: `${`${failure.message || ''}`.trim() || 'The helper failed to run.'}${detail ? ` — ${detail}` : ''}` };
    }
    return { ok: false, error: 'The helper returned nothing.' };
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** The most a helper's output file may be before it is refused unread. The
 * scan keeps its result far below this (files are folded, lib/foldFiles.js);
 * this is the guard for the day something does not. The one-document form is
 * bound by what a string can hold; the line form is not read as a string. */
const MAX_DOCUMENT_BYTES = 400 * 1024 * 1024;
const MAX_LINES_BYTES = 1500 * 1024 * 1024;

/** Reads what a helper wrote: one JSON document, or with `lines` an array of
 * Buffers, one per line, left unparsed (a line can be a whole drive's tree and
 * the caller may only need to pass it on). A failure line ({"__error"...}) ends
 * the read as a failure. */
export function readOutput(outPath, { lines, who }) {
  const size = statSync(outPath).size;
  if (size > (lines ? MAX_LINES_BYTES : MAX_DOCUMENT_BYTES)) {
    return { ok: false, error: SCAN_TOO_LARGE_MESSAGE, code: classifyScanError('Invalid string length') };
  }
  let raw;
  try {
    raw = readFileSync(outPath);
  } catch (err) {
    const code = classifyScanError(err);
    return code ? { ok: false, error: SCAN_TOO_LARGE_MESSAGE, code } : { ok: false, error: `${who} left output that could not be read: ${err.message}` };
  }
  if (raw.length === 0 || raw.toString('utf8', 0, Math.min(raw.length, 64)).trim() === '') return { ok: false, error: `${who} returned nothing.` };

  if (lines) {
    const out = [];
    for (let start = 0; start < raw.length;) {
      let end = raw.indexOf(0x0a, start);
      if (end === -1) end = raw.length;
      if (end > start) {
        const line = raw.subarray(start, end);
        // A failure line is small; looking only at small lines avoids parsing a tree.
        if (line.length < 4096 && line.indexOf('"__error"') !== -1) {
          try {
            const parsed = JSON.parse(line.toString('utf8'));
            if (parsed?.__error) return { ok: false, error: parsed.__error, ...(parsed.__code ? { code: parsed.__code } : {}) };
          } catch { /* not a failure line after all */ }
        }
        out.push(line);
      }
      start = end + 1;
    }
    return out.length === 0 ? { ok: false, error: `${who} returned nothing.` } : { ok: true, lines: out };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8').trim());
  } catch (err) {
    const code = classifyScanError(err);
    return code ? { ok: false, error: SCAN_TOO_LARGE_MESSAGE, code } : { ok: false, error: `${who} returned non-JSON output: ${err.message}` };
  }
  if (parsed && parsed.__error) return { ok: false, error: parsed.__error, ...(parsed.__code ? { code: parsed.__code } : {}) };
  return { ok: true, data: parsed };
}

/** Node flags for a helper process. A scan of a drive with millions of files
 * holds a record per file while it works, and Node's default old-space limit
 * (a quarter of RAM, at most 4 GB, less on a small machine) is not guaranteed
 * to cover that, so the helper gets a generous one: three fifths of this
 * machine's memory, between 2 and 8 GB. It only ever uses what it needs. */
export function nodeFlags(memoryBytes = totalmem()) {
  const mb = Math.min(8192, Math.max(2048, Math.floor((memoryBytes * 0.6) / (1024 * 1024))));
  return [`--max-old-space-size=${mb}`];
}

/** PowerShell single-quoted literal: the only escape inside one is a
 * doubled quote, and nothing else is interpreted -- which is exactly why
 * paths go in single quotes here rather than double. */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
