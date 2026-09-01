import { runPowerShellJson } from './powershell.js';

/** Free/total bytes for the system drive (C:) -- same PowerShell-shell-out
 * chokepoint every other backend service already uses. Get-PSDrive's
 * Free/Used are already in bytes, no unit conversion needed. Returns null
 * (not 0/NaN) on any failure or a zero-total response, so the frontend
 * shows an honest "unavailable" state rather than a fabricated number. */
export async function getSystemDriveSpace() {
  const script = `
    $d = Get-PSDrive -Name C -ErrorAction Stop
    [PSCustomObject]@{ freeBytes = $d.Free; totalBytes = ($d.Free + $d.Used) } | ConvertTo-Json -Compress
  `;
  const raw = await runPowerShellJson(script);
  if (!raw || !raw.totalBytes) return null;
  return { freeBytes: raw.freeBytes, totalBytes: raw.totalBytes };
}