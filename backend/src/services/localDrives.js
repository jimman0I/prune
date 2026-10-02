import { parse } from 'node:path';
import { runPowerShellJson } from './powershell.js';
import { settingsPath } from './settings.js';

/** The local fixed disks, for the free-space wipe's drive picker.
 *
 * Fixed disks only (Win32_LogicalDisk DriveType 3): not a USB stick that
 * might be pulled mid-wipe, not a network share whose "free space" is
 * someone else's, not an optical drive. A drive that is locked (BitLocker)
 * reports no size and is left out, because there is nothing to wipe on it. */

const SCRIPT = `
  Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 3" |
    ForEach-Object {
      [PSCustomObject]@{
        drive = $_.DeviceID
        label = $_.VolumeName
        totalBytes = [int64]$_.Size
        freeBytes = [int64]$_.FreeSpace
      }
    } | ConvertTo-Json -Compress
`;

/** [{ drive: 'C:', label, totalBytes, freeBytes }], in drive-letter order. */
export async function listFixedDrives({ run = runPowerShellJson } = {}) {
  const raw = await run(SCRIPT);
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return rows
    .filter((row) => row && typeof row.drive === 'string' && /^[A-Za-z]:$/.test(row.drive.trim()) && Number(row.totalBytes) > 0)
    .map((row) => {
      const totalBytes = Number(row.totalBytes);
      return {
        drive: row.drive.trim().toUpperCase(),
        label: String(row.label ?? '').trim(),
        totalBytes,
        freeBytes: Math.min(totalBytes, Math.max(0, Number(row.freeBytes) || 0))
      };
    })
    .sort((a, b) => a.drive.localeCompare(b.drive));
}

/** The drive Prune keeps its settings on -- the one the wipe uses when none
 * is chosen, so nothing is ever created at the root of C:. */
export function profileDrive() {
  return parse(settingsPath()).root.replace(/[\\/]+$/, '').toUpperCase();
}
