import { existsSync } from 'node:fs';
import { runPowerShellJson } from './powershell.js';
import { parseUninstallerPath } from './uninstallerPath.js';
import { expandPath } from '../lib/cleanerRules.js';

/** Everything Windows runs when you sign in.
 *
 * Revo keeps an autorun manager under its Tools menu, and it is the one
 * tool there that belongs next to an uninstaller: the entries outlive the
 * programs that created them. A program removed carelessly leaves its Run
 * key behind, and Windows goes on trying to launch a file that is not
 * there at every single sign-in.
 *
 * Read from the four places that actually matter: the Run and RunOnce keys
 * in both machine hives and the user hive, and the two Startup folders.
 * Scheduled tasks are deliberately absent -- there are hundreds of them,
 * almost all of them Windows' own, and a list nobody can read is not a
 * feature. */
const STARTUP_QUERY = `
$out = @()

$keys = @(
  @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; scope = 'machine'; kind = 'Run' },
  @{ path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'; scope = 'machine'; kind = 'Run (32-bit)' },
  @{ path = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; scope = 'user'; kind = 'Run' },
  @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; scope = 'machine'; kind = 'RunOnce' },
  @{ path = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; scope = 'user'; kind = 'RunOnce' }
)

foreach ($k in $keys) {
  if (-not (Test-Path $k.path)) { continue }
  $props = Get-ItemProperty -Path $k.path -ErrorAction SilentlyContinue
  if (-not $props) { continue }
  foreach ($p in $props.PSObject.Properties) {
    if ($p.Name -like 'PS*') { continue }
    $out += [PSCustomObject]@{
      name = [string]$p.Name
      command = [string]$p.Value
      scope = $k.scope
      location = $k.kind
      source = 'registry'
      registryKey = $k.path
    }
  }
}

$folders = @(
  @{ path = [Environment]::GetFolderPath('Startup'); scope = 'user' },
  @{ path = [Environment]::GetFolderPath('CommonStartup'); scope = 'machine' }
)
foreach ($f in $folders) {
  if (-not $f.path -or -not (Test-Path $f.path)) { continue }
  foreach ($item in Get-ChildItem -LiteralPath $f.path -File -ErrorAction SilentlyContinue) {
    if ($item.Name -eq 'desktop.ini') { continue }
    $out += [PSCustomObject]@{
      name = [string]$item.BaseName
      command = [string]$item.FullName
      scope = $f.scope
      location = 'Startup folder'
      source = 'folder'
      registryKey = ''
    }
  }
}

ConvertTo-Json -InputObject @($out) -Compress -Depth 3
`;

/** One raw entry, normalized, or null.
 *
 * `runs` is the interesting field. The command is parsed with the same
 * reader the uninstall strings use -- they are the same kind of value, a
 * command line rather than a path, with the same quoting rules and the
 * same ambiguity when unquoted -- and then the file is checked.
 *
 * A shortcut in a Startup folder is left alone: its target lives inside
 * the .lnk and reading that needs a shell call, so what is checked is the
 * shortcut itself. Saying a shortcut exists when it does is honest;
 * claiming to know whether its target resolves would not be. */
export function normalizeStartupItem(raw) {
  if (!raw?.name || !raw?.command) return null;

  const command = String(raw.command).trim();
  if (!command) return null;

  const isShortcut = /\.(lnk|url)$/i.test(command);
  const { executable } = parseUninstallerPath(command);
  const expanded = executable ? expandPath(executable) : null;

  // Only an absolute path can be checked. A bare command name is resolved
  // through PATH at launch, exactly as in programHealth.js, and null there
  // means "unanswerable" rather than "missing".
  const checkable = Boolean(expanded) && (/^[a-z]:[\\/]/i.test(expanded) || expanded.startsWith('\\\\'));

  return {
    id: `${raw.source}:${raw.scope}:${raw.location}:${raw.name}`,
    name: raw.name,
    command,
    executable: expanded,
    scope: raw.scope === 'machine' ? 'All users' : 'This user',
    location: raw.location,
    source: raw.source,
    registryKey: raw.registryKey || null,
    isShortcut,
    // true, false, or null when there is nothing that can be checked.
    exists: checkable ? existsSync(expanded) : null
  };
}

/** Everything set to run at sign-in.
 *
 * Broken entries sort first: they are the reason to look at this list at
 * all, and everything else here is working as intended. */
export async function getStartupItems() {
  let raw;
  try {
    raw = await runPowerShellJson(STARTUP_QUERY);
  } catch {
    return [];
  }
  if (!raw) return [];

  const rows = Array.isArray(raw) ? raw : [raw];
  const items = rows.map(normalizeStartupItem).filter(Boolean);

  return items.sort((a, b) => {
    if (a.exists === false && b.exists !== false) return -1;
    if (b.exists === false && a.exists !== false) return 1;
    return a.name.localeCompare(b.name);
  });
}
