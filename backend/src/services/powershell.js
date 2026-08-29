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

function attempt(script, timeoutMs, retriesLeft) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
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