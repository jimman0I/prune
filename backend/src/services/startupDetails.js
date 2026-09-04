import { runPowerShellJson } from './powershell.js';

/** Who wrote the thing Windows is about to launch, and whether it is
 * already running.
 *
 * Revo's Autorun Manager gives every row a Description, a Publisher and a
 * Status, and those three turn the list from a set of registry values into
 * something a person can make a decision about. "RtkAudUService" is a name
 * only its author loves; "Realtek Audio Universal Service, Realtek
 * Semiconductor" is a row you can decide about without a search engine.
 *
 * Both facts come off the executable itself rather than the registry: the
 * Run value carries a command line and nothing else, so the description
 * and publisher are read from the file's own version resource, the same
 * place Explorer's Properties dialog reads them.
 *
 * Running state is a separate question with a separate answer -- a startup
 * entry that is switched on may still not be running (it crashed, it was
 * closed), and one that is switched OFF may be running because something
 * else started it. Revo reports these independently and so does this. */
function buildScript(paths) {
  // Every path is single-quoted with its own quotes doubled, which is
  // PowerShell's escape inside a single-quoted string. A path with an
  // apostrophe in it -- "C:\Users\O'Brien\app.exe" -- would otherwise end
  // the string early and turn the rest of the array into syntax.
  const literals = paths.map((p) => `'${p.replace(/'/g, "''")}'`).join(',');

  return `
$ErrorActionPreference = 'SilentlyContinue'
# One snapshot of what is running, taken once rather than per entry:
# Get-Process is expensive and this list can be dozens long.
#
# Two indexes, because one is not enough. The full image path is the exact
# answer, but reading .Path on a process owned by another user or running
# elevated raises an access error and yields nothing -- and this backend is
# not elevated. Found live: KeePassXC runs elevated here, so it was
# reported as not running while Revo showed it RUNNING.
#
# So the name is indexed too, and a match on either counts. That is looser
# -- two different programs with the same executable name would be confused
# -- but the failure it fixes is silent and common, and the one it
# introduces is rare and visible.
$running = @{}
$runningNames = @{}
foreach ($proc in (Get-Process -ErrorAction SilentlyContinue)) {
  $imagePath = $proc.Path
  if ($imagePath) { $running[$imagePath.ToLower()] = $true }
  if ($proc.ProcessName) { $runningNames[($proc.ProcessName + '.exe').ToLower()] = $true }
}

$out = @{}
foreach ($path in @(${literals})) {
  if (-not $path) { continue }
  $info = $null
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    $file = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue
    $info = $file.VersionInfo
  }
  $out[$path] = [PSCustomObject]@{
    description = if ($info) { [string]$info.FileDescription } else { '' }
    publisher   = if ($info) { [string]$info.CompanyName } else { '' }
    running     = [bool]($running[$path.ToLower()] -or $runningNames[[System.IO.Path]::GetFileName($path).ToLower()])
  }
}

ConvertTo-Json -InputObject $out -Compress -Depth 4
`;
}

/** Trims the version-resource strings into something worth showing.
 *
 * A blank FileDescription is common and a whitespace-only one is not rare;
 * both mean the file simply does not carry the field, and an empty string
 * on screen looks like a bug rather than an absence. Null says "nothing to
 * show" and the row can render a dash. */
export function cleanDetail(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/[\x00-\x1F]/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

/** Looks up description, publisher and running state for a list of
 * executables. Returns a map keyed by the path that was asked about.
 *
 * A failure here is not a failure of the startup list: the names and
 * commands are already known and are the load-bearing part. An empty map
 * leaves every row showing dashes, which is worse than the truth but far
 * better than an empty screen. */
export async function getStartupDetails(paths) {
  const unique = [...new Set((paths || []).filter((p) => typeof p === 'string' && p.trim() !== ''))];
  if (unique.length === 0) return {};

  let raw;
  try {
    raw = await runPowerShellJson(buildScript(unique));
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object') return {};

  const details = {};
  for (const [path, value] of Object.entries(raw)) {
    details[path] = {
      description: cleanDetail(value?.description),
      publisher: cleanDetail(value?.publisher),
      running: value?.running === true
    };
  }
  return details;
}
