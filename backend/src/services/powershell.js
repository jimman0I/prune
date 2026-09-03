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

function attempt(script, timeoutMs, retriesLeft) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', UTF8_PREAMBLE + script],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
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