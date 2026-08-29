import { runPowerShellJson } from './powershell.js';

/** Best-effort System Restore checkpoint before a forced-removal batch —
 * NOT the primary safety net (see quarantine.js / the design spec: Windows
 * throttles Checkpoint-Computer to one per 24h by default, so relying on
 * it alone would silently leave a user's second uninstall of the day
 * unprotected). Never throws — a caller that awaits this and ignores a
 * false `created` is using it correctly. */
export async function tryCreateRestorePoint(description) {
  const script = `
try {
  Checkpoint-Computer -Description '${description.replace(/'/g, "''")}' -RestorePointType 'APPLICATION_UNINSTALL' -ErrorAction Stop
  ConvertTo-Json @{ created = $true }
} catch {
  ConvertTo-Json @{ created = $false; reason = $_.Exception.Message }
}
`;
  try {
    const result = await runPowerShellJson(script);
    return result || { created: false, reason: 'No response from PowerShell' };
  } catch (err) {
    return { created: false, reason: err.message };
  }
}