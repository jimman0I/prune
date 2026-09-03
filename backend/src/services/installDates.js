import { runPowerShellJson } from './powershell.js';
import { listInstalledPrograms } from './programs.js';

/** Earliest date an entry could plausibly describe. A registry key with no
 * meaningful write time reads back as the FILETIME epoch (1601), and
 * various APIs substitute 1899 or 1970. None of those is an install. */
const EARLIEST = '1990-01-01';

/** Reduces whatever the query returned to a plain YYYY-MM-DD, or null.
 *
 * Third-party-controlled data, so this defends at the boundary the same
 * way parseRegistryDate in programs.js does: a malformed value produces a
 * blank, never an exception and never a wrong date. */
export function normalizeKeyDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/);
  if (!match) return null;
  const date = match[1];
  if (date < EARLIEST) return null;
  return date;
}

/** Reads the LAST WRITE TIME of each uninstall registry key.
 *
 * Windows records this for every key and exposes it only through
 * RegQueryInfoKey -- Get-ItemProperty does not carry it, which is why this
 * declares the P/Invoke rather than using a cmdlet.
 *
 * Kept as its own script, and its own endpoint, rather than folded into
 * the main program query: that query is what the whole list waits on, and
 * an Add-Type block failing there would take every program down with it.
 * The same reasoning that keeps sizes, icons and versions separate. */
const WRITE_TIME_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PruneRegTime {
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
  static extern int RegOpenKeyEx(IntPtr hKey, string sub, int opt, int sam, out IntPtr res);
  [DllImport("advapi32.dll")]
  static extern int RegQueryInfoKey(IntPtr hKey, IntPtr cls, IntPtr clen, IntPtr r,
    IntPtr sk, IntPtr mskl, IntPtr mcl, IntPtr vals, IntPtr mvnl, IntPtr mvl, IntPtr sd, out long ft);
  [DllImport("advapi32.dll")] static extern int RegCloseKey(IntPtr h);
  public static string Get(string hive, string sub) {
    IntPtr root = new IntPtr(unchecked((int)(hive == "HKCU" ? 0x80000001 : 0x80000002)));
    IntPtr h;
    if (RegOpenKeyEx(root, sub, 0, 0x20019, out h) != 0) return null;
    long ft;
    int rc = RegQueryInfoKey(h, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
      IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, out ft);
    RegCloseKey(h);
    if (rc != 0) return null;
    try { return DateTime.FromFileTime(ft).ToString("yyyy-MM-dd"); } catch { return null; }
  }
}
"@ -ErrorAction SilentlyContinue

$paths = @(
  @{ hive = 'HKLM'; sub = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall' },
  @{ hive = 'HKLM'; sub = 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall' },
  @{ hive = 'HKCU'; sub = 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall' }
)

$rows = foreach ($p in $paths) {
  $root = if ($p.hive -eq 'HKCU') { [Microsoft.Win32.Registry]::CurrentUser } else { [Microsoft.Win32.Registry]::LocalMachine }
  $key = $root.OpenSubKey($p.sub)
  if ($key) {
    foreach ($name in $key.GetSubKeyNames()) {
      $written = [PruneRegTime]::Get($p.hive, ($p.sub + '\\' + $name))
      if ($written) {
        [PSCustomObject]@{ key = ($p.hive + ':\\' + $p.sub + '\\' + $name); written = $written }
      }
    }
    $key.Close()
  }
}
ConvertTo-Json -InputObject @($rows) -Compress -Depth 3
`;

/** Install dates for the programs whose registry entry never declared one,
 * as { programId: 'YYYY-MM-DD' }.
 *
 * 67 of the 129 entries on this machine record no InstallDate -- more than
 * half the list, so the column read as mostly empty. Every one of those
 * keys still carries the moment Windows last wrote it, which is when the
 * entry was created and therefore when the program was installed.
 *
 * Confirmed as the right source by checking it against Revo Uninstaller,
 * which fills the column for all of them: its dates for Steam
 * (20/07/2025), Ubisoft Connect (15/07/2026), Rainbow Six (16/07/2026) and
 * Wuthering Waves (17/08/2026) match these key write times exactly, and
 * match neither the install folder's creation time nor its modified time.
 *
 * It is an approximation, and the merge marks it as one: an update that
 * rewrites DisplayVersion also rewrites the key, so for a
 * frequently-updated program this drifts towards "last updated". That is
 * why it is only ever a fallback -- a declared InstallDate always wins. */
export async function getProgramInstallDates(programs) {
  const list = programs ?? await listInstalledPrograms();
  const wanted = list.filter((program) => !program.installDate && program.registryKey);
  if (wanted.length === 0) return {};

  let raw;
  try {
    raw = await runPowerShellJson(WRITE_TIME_SCRIPT);
  } catch {
    return {}; // the rows keep their blank
  }
  if (!raw) return {};

  // ConvertTo-Json collapses a single-element array to a bare object.
  const rows = Array.isArray(raw) ? raw : [raw];

  // The registry is case-insensitive and PowerShell makes no promise about
  // the casing it echoes back.
  const byKey = new Map();
  for (const row of rows) {
    const date = normalizeKeyDate(row?.written);
    if (row?.key && date) byKey.set(String(row.key).toLowerCase(), date);
  }

  const dates = {};
  for (const program of wanted) {
    const found = byKey.get(program.registryKey.toLowerCase());
    if (found) dates[program.id] = found;
  }
  return dates;
}
