import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseNvmeSmartLog } from '../lib/nvme/smartLog.js';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 20_000;

/** Reads the NVMe SMART / Health Information log page straight from the
 * drive, the way CrystalDiskInfo does.
 *
 * IOCTL_STORAGE_QUERY_PROPERTY with StorageDeviceProtocolSpecificProperty.
 * No driver and no third-party tool -- Windows 10 and later expose the
 * NVMe protocol passthrough directly.
 *
 * The important discovery, found by testing rather than assuming: this
 * needs NO administrator. CreateFile is opened with dwDesiredAccess = 0,
 * which is enough for a query-only IOCTL, so the full SMART log comes
 * back without a UAC prompt. Every other route to this data (raw volume
 * reads, Get-StorageReliabilityCounter's richer fields) demands
 * elevation; this one doesn't.
 *
 * PowerShell only fetches the bytes. Parsing happens in JavaScript,
 * where the bit arithmetic is testable against a real captured log --
 * an early version parsed in PowerShell and silently produced -205 C
 * because its shift operator didn't do what it looked like it did. */
const SCRIPT = String.raw`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PruneNvme {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern IntPtr CreateFileW(string n, uint a, uint s, IntPtr sa, uint c, uint f, IntPtr t);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool DeviceIoControl(IntPtr h, uint code, byte[] inb, uint inl, byte[] outb, uint outl, ref uint ret, IntPtr ov);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr h);
}
"@

$out = @{}
foreach ($disk in (Get-PhysicalDisk | Where-Object { $_.BusType -eq 'NVMe' })) {
  try {
    $buffer = New-Object byte[] 560
    # STORAGE_PROPERTY_QUERY: StorageDeviceProtocolSpecificProperty (50),
    # PropertyStandardQuery (0), then STORAGE_PROTOCOL_SPECIFIC_DATA.
    [BitConverter]::GetBytes([uint32]50).CopyTo($buffer, 0)
    [BitConverter]::GetBytes([uint32]0).CopyTo($buffer, 4)
    [BitConverter]::GetBytes([uint32]3).CopyTo($buffer, 8)    # ProtocolTypeNvme
    [BitConverter]::GetBytes([uint32]2).CopyTo($buffer, 12)   # NVMeDataTypeLogPage
    [BitConverter]::GetBytes([uint32]2).CopyTo($buffer, 16)   # log page 0x02 = SMART
    [BitConverter]::GetBytes([uint32]0).CopyTo($buffer, 20)
    [BitConverter]::GetBytes([uint32]40).CopyTo($buffer, 24)  # ProtocolDataOffset
    [BitConverter]::GetBytes([uint32]512).CopyTo($buffer, 28) # ProtocolDataLength

    # dwDesiredAccess 0 -- query-only, and the reason no elevation is needed.
    $h = [PruneNvme]::CreateFileW("\\.\PhysicalDrive$($disk.DeviceId)", 0, 3, [IntPtr]::Zero, 3, 0, [IntPtr]::Zero)
    if ($h -eq [IntPtr]::new(-1)) { continue }
    $returned = [uint32]0
    $ok = [PruneNvme]::DeviceIoControl($h, 0x002D1400, $buffer, 560, $buffer, 560, [ref]$returned, [IntPtr]::Zero)
    [PruneNvme]::CloseHandle($h) | Out-Null
    if (-not $ok -or $returned -lt 560) { continue }

    # The log page sits after the 48-byte descriptor.
    $out[[string]$disk.DeviceId] = [Convert]::ToBase64String($buffer[48..559])
  } catch { }
}
ConvertTo-Json -InputObject $out -Compress -Depth 3
`;

/** SMART data for every NVMe drive, as { deviceId: attributes }.
 *
 * A drive that doesn't answer is simply absent -- SATA SSDs and spinning
 * disks don't have this log page at all, and neither does an NVMe behind
 * a controller that refuses the passthrough. Absent means the caller
 * falls back to what Windows reports, rather than showing a blank panel
 * with zeroes in it. */
export async function getNvmeSmart() {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }
    ));
  } catch {
    return {};
  }

  const trimmed = stdout.trim();
  if (!trimmed) return {};

  let raw;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return {};
  }

  const result = {};
  for (const [deviceId, base64] of Object.entries(raw || {})) {
    try {
      result[deviceId] = parseNvmeSmartLog(Buffer.from(base64, 'base64'));
    } catch {
      // A malformed log page is one drive's problem, not the whole query's.
    }
  }
  return result;
}
