import { runPowerShellJson } from './powershell.js';

/** Free/total bytes for one drive, by letter -- same PowerShell-shell-out
 * chokepoint every other backend service already uses. Get-PSDrive's
 * Free/Used are already in bytes, no unit conversion needed. Returns null
 * (not 0/NaN) on any failure, an invalid letter or a zero-total response, so
 * the frontend shows an honest "unavailable" state rather than a fabricated
 * number. The letter is validated here because it goes into a command line. */
export async function getDriveSpace(letter) {
  if (!/^[a-z]$/i.test(String(letter))) return null;
  const script = `
    $d = Get-PSDrive -Name ${String(letter).toUpperCase()} -ErrorAction Stop
    [PSCustomObject]@{ freeBytes = $d.Free; totalBytes = ($d.Free + $d.Used) } | ConvertTo-Json -Compress
  `;
  const raw = await runPowerShellJson(script);
  if (!raw || !raw.totalBytes) return null;
  return { freeBytes: raw.freeBytes, totalBytes: raw.totalBytes };
}

/** The system drive (C:). */
export function getSystemDriveSpace() {
  return getDriveSpace('C');
}
