import { execFile } from 'node:child_process';

const TIMEOUT_MS = 15000;

/** Runs a PowerShell script, parses stdout as JSON. `-NoProfile
 * -NonInteractive` avoid a user's PowerShell profile slowing or altering
 * output; `-Command` (not `-File`) so callers pass a script string
 * directly, no temp file needed. Timeout + one retry (matching Re:Route's
 * own router-timeout precedent) — a hung call fails loud rather than
 * hanging the caller forever. */
export function runPowerShellJson(script, { timeoutMs = TIMEOUT_MS, retries = 1 } = {}) {
  return attempt(script, timeoutMs, retries);
}

/** Same invocation (UTF-8 forced, no profile, timeout + one retry) but
 * returns the raw trimmed stdout instead of parsing it as JSON — for a
 * caller whose script prints plain text (`reg query`'s own format, for
 * instance) rather than `ConvertTo-Json`. Empty output resolves to an
 * empty string, same "no matches is not an error" rule runPowerShellJson
 * follows. */
export function runPowerShellText(script, { timeoutMs = TIMEOUT_MS, retries = 1 } = {}) {
  return attemptText(script, timeoutMs, retries);
}

/** Forces UTF-8 on the way out.
 *
 * powershell.exe is Windows PowerShell 5.1, and it writes its output in
 * the machine's legacy codepage rather than UTF-8. Node reads that stream
 * as UTF-8, so anything outside the codepage arrived either as question
 * marks or as bytes that are not valid UTF-8 at all -- and the second
 * case fails JSON.parse, which loses the ENTIRE query rather than the one
 * row that contained the character.
 *
 * Found while listing Store apps: a Greek language pack named "Ελληνικά -
 * Πακέτο τοπικά προσαρμογής" failed the parse for all 81 packages. The
 * same fault sits under every other query here -- a program named in
 * Greek, Chinese or Cyrillic would have corrupted the program list on
 * anyone's machine, and an earlier probe had already shown a publisher
 * coming back as "????????" without anyone reading it as a bug.
 *
 * Prepended to the script rather than set through chcp: it applies to
 * this process only and needs no console to attach to. */
const UTF8_PREAMBLE = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';

/** The environment powershell.exe is started with: this process's, minus
 * PSModulePath.
 *
 * PowerShell 7 puts its own module folders in PSModulePath, and a Windows
 * PowerShell 5.1 started from inside it inherits them and can then fail to
 * load its own built-in modules -- Get-AuthenticodeSignature (in
 * Microsoft.PowerShell.Security) answered nothing at all on the GitHub
 * runner, whose environment is set up for PowerShell 7. Prune started from a
 * PowerShell 7 terminal would hit the same. Without the variable, 5.1 uses
 * its own default module paths, which is what it expects. */
export function windowsPowerShellEnv(env = process.env) {
  const out = { ...env };
  for (const key of Object.keys(out)) if (key.toLowerCase() === 'psmodulepath') delete out[key];
  return out;
}

function attempt(script, timeoutMs, retriesLeft) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', UTF8_PREAMBLE + script],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, env: windowsPowerShellEnv() },
      (err, stdout, stderr) => {
        if (err) {
          if (retriesLeft > 0) {
            attempt(script, timeoutMs, retriesLeft - 1).then(resolve, reject);
            return;
          }
          reject(new Error(`PowerShell command failed: ${err.message}${stderr ? ` — ${stderr.trim()}` : ''}`));
          return;
        }
        const trimmed = stdout.trim();
        if (!trimmed) { resolve(null); return; } // empty result is valid (e.g. no matches)
        try {
          resolve(JSON.parse(trimmed));
        } catch (parseErr) {
          reject(new Error(`PowerShell returned non-JSON output: ${parseErr.message}`));
        }
      }
    );
  });
}

function attemptText(script, timeoutMs, retriesLeft) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', UTF8_PREAMBLE + script],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, env: windowsPowerShellEnv() },
      (err, stdout, stderr) => {
        if (err) {
          if (retriesLeft > 0) {
            attemptText(script, timeoutMs, retriesLeft - 1).then(resolve, reject);
            return;
          }
          reject(new Error(`PowerShell command failed: ${err.message}${stderr ? ` — ${stderr.trim()}` : ''}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}