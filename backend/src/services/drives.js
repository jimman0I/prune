import { runPowerShellJson } from './powershell.js';

/** DriveType values from Win32_LogicalDisk worth scanning: 2 is removable
 * media (USB sticks, SD cards), 3 is a fixed disk. Network shares (4),
 * optical drives (5) and RAM disks (6) are deliberately out -- a share is
 * somebody else's disk, and reading an optical drive spins it up for a map
 * nobody asked for. */
const SCANNABLE_DRIVE_TYPES = new Set([2, 3]);

/** The drives the Disk Map can offer, with what is needed to choose one:
 * label, file system, size and free space.
 *
 * `ntfs` is surfaced because it decides which scan is possible: only NTFS
 * has an MFT to read, so a FAT32 or exFAT stick can still be walked but
 * can never be fast-scanned, and the picker has to say that up front
 * instead of letting a UAC prompt end in an error.
 *
 * Win32_LogicalDisk rather than Get-Volume: it is present on every Windows
 * and reports an empty card reader as a drive with no size, which is
 * dropped here -- there is nothing on it to scan. */
export async function listDrives({ env = process.env } = {}) {
  // Windows PowerShell 5.1 (what powershell.exe is) has no
  // ConvertTo-Json -AsArray; a lone drive is unwrapped into a bare object,
  // which the normalisation below accepts.
  const script = `
    Get-CimInstance Win32_LogicalDisk |
      Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 3 } |
      ForEach-Object {
        [PSCustomObject]@{
          letter = $_.DeviceID
          label = $_.VolumeName
          fileSystem = $_.FileSystem
          totalBytes = $_.Size
          freeBytes = $_.FreeSpace
          driveType = $_.DriveType
        }
      } | ConvertTo-Json -Compress
  `;
  const raw = await runPowerShellJson(script);
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const systemDrive = (/^([a-z]):?$/i.exec(String(env.SystemDrive ?? '').trim())?.[1] ?? 'C').toUpperCase();

  const drives = rows
    .map((row) => {
      const letter = /^([a-z]):$/i.exec(String(row.letter ?? '').trim())?.[1]?.toUpperCase();
      if (!letter) return null;
      if (!SCANNABLE_DRIVE_TYPES.has(Number(row.driveType))) return null;
      const totalBytes = Number(row.totalBytes);
      if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null;
      const freeBytes = Number(row.freeBytes);
      const fileSystem = row.fileSystem ?? null;
      return {
        letter,
        label: row.label ?? '',
        fileSystem,
        totalBytes,
        freeBytes: Number.isFinite(freeBytes) ? freeBytes : null,
        removable: Number(row.driveType) === 2,
        system: letter === systemDrive,
        ntfs: String(fileSystem ?? '').toUpperCase() === 'NTFS'
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.letter.localeCompare(b.letter));

  return { systemDrive, drives };
}
