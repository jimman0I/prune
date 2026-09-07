import { existsSync } from 'node:fs';
import { runPowerShellJson } from './powershell.js';
import { parseUninstallerPath } from './uninstallerPath.js';
import { expandPath } from '../lib/cleanerRules.js';
import { isStartupEnabled, approvedLookupKey } from './startupApproved.js';
import { getStartupDetails } from './startupDetails.js';
import { toggleRefusal } from './startupToggle.js';
import { appxDisplayName } from './appxName.js';

/** Everything Windows runs when you sign in.
 *
 * Revo keeps an autorun manager under its Tools menu, and it is the one
 * tool there that belongs next to an uninstaller: the entries outlive the
 * programs that created them. A program removed carelessly leaves its Run
 * key behind, and Windows goes on trying to launch a file that is not
 * there at every single sign-in.
 *
 * Read from seven places: the Run and RunOnce keys in both machine hives
 * and the user hive, the two Startup folders, scheduled tasks, services
 * set to start automatically, and the startup tasks Windows Store apps
 * register.
 *
 * The last three were absent, on the reasoning that "there are hundreds
 * of them, almost all of them Windows' own, and a list nobody can read is
 * not a feature". The premise was right and the conclusion was not: there
 * are 202 scheduled tasks on this machine and 81 automatic services, and
 * filtering out the ones under \Microsoft\ and in system32 leaves 10 and
 * 20 -- all of them things a person installed. Skipping the whole
 * location to avoid the noise also skipped the signal, and left Prune
 * showing 15 entries where Revo showed 77.
 *
 * All three are read-only here. Each is switchable somewhere -- Task
 * Scheduler, services.msc, the app's own settings -- but none through
 * StartupApproved, which is the only thing this app knows how to write.
 * They carry a `toggleNote` saying where to go instead, which the screen
 * renders as a fixed tick and a sentence rather than a control that does
 * nothing. */
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
      approvedName = [string]$p.Name
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
      # StartupApproved records a folder entry by its FILE name, extension
      # and all. The list shows "FxSound"; the key is "FxSound.lnk".
      approvedName = [string]$item.Name
      command = [string]$item.FullName
      scope = $f.scope
      location = 'Startup folder'
      source = 'folder'
      registryKey = ''
    }
  }
}

# Scheduled tasks, minus Microsoft's own.
#
# These were left out on the grounds that "there are hundreds of them,
# almost all of them Windows' own, and a list nobody can read is not a
# feature". True of all 202 on this machine; false once the \Microsoft\
# tree is excluded, which leaves 11 -- every one of them something a
# person installed. Revo lists them for the same reason.
#
# Keyed by full path, not by name: task names are only unique within their
# folder.
foreach ($t in (Get-ScheduledTask -ErrorAction SilentlyContinue)) {
  if ($t.TaskPath -like '\\Microsoft\\*') { continue }
  $action = $t.Actions | Where-Object { $_.Execute } | Select-Object -First 1
  if (-not $action) { continue }
  $cmd = [string]$action.Execute
  if ($action.Arguments) { $cmd = $cmd + ' ' + [string]$action.Arguments }
  $out += [PSCustomObject]@{
    name = [string]$t.TaskName
    key = [string]$t.TaskPath + [string]$t.TaskName
    command = $cmd
    scope = 'machine'
    location = 'Scheduled task'
    source = 'task'
    enabled = ($t.State -ne 'Disabled')
    description = [string]$t.Description
    registryKey = ''
  }
}

# Services set to start automatically, minus Windows' own.
#
# system32 is the line between "a program set itself to run" and "Windows
# is Windows" -- without it this is 81 rows, most of them the operating
# system describing itself.
#
# Keyed by service short name because DISPLAY names are not unique: two
# different services on this machine are both called "Gaming Services".
foreach ($s in (Get-CimInstance Win32_Service -ErrorAction SilentlyContinue)) {
  if ($s.StartMode -ne 'Auto') { continue }
  if (-not $s.PathName) { continue }
  if ($s.PathName -match '^"?C:\\\\WINDOWS\\\\[Ss]ystem32\\\\') { continue }
  $out += [PSCustomObject]@{
    name = [string]$s.DisplayName
    key = [string]$s.Name
    command = [string]$s.PathName
    scope = 'machine'
    location = 'Service'
    source = 'service'
    enabled = $true
    description = [string]$s.Description
    registryKey = ''
  }
}

# Startup tasks registered by Windows Store apps.
#
# State 2 is enabled; 0 and 1 are the two ways of being off (off, and
# turned off by the user). Verified against this machine's own list by
# comparing every row with the ticks Revo shows for the same apps.
#
# There is no command line for any of these: a Store app declares a
# startup task by package identity and Windows launches it through the
# package. The row says what it can and claims nothing else.
$appRoot = 'HKCU:\\SOFTWARE\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData'
foreach ($pkg in (Get-ChildItem $appRoot -ErrorAction SilentlyContinue)) {
  foreach ($taskKey in (Get-ChildItem $pkg.PSPath -ErrorAction SilentlyContinue)) {
    $props = Get-ItemProperty $taskKey.PSPath -ErrorAction SilentlyContinue
    if ($null -eq $props -or $null -eq $props.State) { continue }
    $out += [PSCustomObject]@{
      name = ($pkg.PSChildName -split '_')[0]
      key = [string]$pkg.PSChildName + '\\' + [string]$taskKey.PSChildName
      command = ''
      scope = 'user'
      location = 'Windows app'
      source = 'appx'
      enabled = ([int]$props.State -eq 2)
      description = [string]$taskKey.PSChildName
      registryKey = ''
    }
  }
}

# Which of these Windows will actually run. Disabling a startup item does
# not remove it -- the Run value or the shortcut stays exactly where it is
# and the decision is recorded separately, here. A list that reads only the
# Run keys reports every switched-off entry as running at sign-in.
$approved = @{}
$approvedRoots = @(
  @{ path = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'; scope = 'user' },
  @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'; scope = 'machine' }
)
foreach ($r in $approvedRoots) {
  foreach ($kind in @('Run','Run32','StartupFolder')) {
    $kp = Join-Path $r.path $kind
    if (-not (Test-Path $kp)) { continue }
    $ap = Get-ItemProperty -Path $kp -ErrorAction SilentlyContinue
    if (-not $ap) { continue }
    foreach ($p in $ap.PSObject.Properties) {
      if ($p.Name -like 'PS*') { continue }
      $approved[('{0}|{1}|{2}' -f $r.scope, $kind, $p.Name)] = @($p.Value)
    }
  }
}

ConvertTo-Json -InputObject ([PSCustomObject]@{ items = @($out); approved = $approved }) -Compress -Depth 4
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
  if (!raw?.name) return null;

  const command = String(raw.command || '').trim();
  // For a Run value or a Startup-folder shortcut the command IS the entry,
  // so an empty one is malformed. A Windows Store app registers its
  // startup task by package identity and has no command line anywhere --
  // dropping those would silently lose every one of them.
  if (!command && raw.source !== 'appx') return null;

  const isShortcut = /\.(lnk|url)$/i.test(command);
  const { executable } = parseUninstallerPath(command);
  const expanded = executable ? expandPath(executable) : null;

  // Only an absolute path can be checked. A bare command name is resolved
  // through PATH at launch, exactly as in programHealth.js, and null there
  // means "unanswerable" rather than "missing".
  const checkable = Boolean(expanded) && (/^[a-z]:[\\/]/i.test(expanded) || expanded.startsWith('\\\\'));

  // A Store app arrives as its package family name. Prettified here
  // rather than in the query so the rule is a testable pure function
  // rather than a line of PowerShell.
  const name = raw.source === 'appx' ? appxDisplayName(raw.name) : raw.name;

  return {
    // `key` where the source can supply something guaranteed unique --
    // a service's short name, a task's full path -- because display names
    // are not. Two distinct services on this machine are both shown as
    // "Gaming Services"; keyed by name they collapse into one row, which
    // is a duplicate React key and a toggle acting on whichever was found
    // first.
    id: `${raw.source}:${raw.scope}:${raw.location}:${raw.key || raw.name}`,
    name,
    approvedName: raw.approvedName || raw.name,
    command,
    executable: expanded,
    scope: raw.scope === 'machine' ? 'All users' : 'This user',
    // Kept raw as well as prettified. `scope` is a label for the screen;
    // the StartupApproved lookup needs the machine/user word itself.
    rawScope: raw.scope === 'machine' ? 'machine' : 'user',
    location: raw.location,
    source: raw.source,
    registryKey: raw.registryKey || null,
    isShortcut,
    // true, false, or null when there is nothing that can be checked.
    exists: checkable ? existsSync(expanded) : null,
    // Present only for the sources that know their own state. undefined
    // means "ask StartupApproved", which is right for Run keys and
    // Startup folders and wrong for everything else.
    reportedEnabled: typeof raw.enabled === 'boolean' ? raw.enabled : undefined
  };
}

/** Attaches each entry's on/off state from the StartupApproved map, and
 * the reason it cannot be switched when there is one.
 *
 * Separate from normalizeStartupItem because it needs the whole map, and
 * because "is this entry switched on" is a different question from "what
 * does this entry say" -- one comes from the Run key, the other from a
 * decision recorded somewhere else entirely.
 *
 * `toggleNote` is the same question one step further: an entry Windows
 * keeps no record for cannot be switched at all, and the screen needs the
 * reason rather than an inert control. Computed here because it comes
 * from the same lookup -- the entries with no note are exactly the ones
 * whose state was read from a real key. */
export function attachEnabledState(items, approved) {
  const map = approved || {};
  return items.map((item) => ({
    ...item,
    // A source that knows its own state wins. StartupApproved records Run,
    // Run32 and StartupFolder entries and nothing else, so reading a
    // scheduled task or a Store app's state out of it would report every
    // one of them as enabled -- including the ones that are switched off.
    enabled: item.reportedEnabled ?? isStartupEnabled(
      map[approvedLookupKey({ ...item, scope: item.rawScope })] ?? null
    ),
    toggleNote: toggleRefusal(item)
  }));
}

/** The entries themselves, without the second pass for version resources
 * and running processes.
 *
 * Split out for the toggle. Switching an entry off needs to know exactly
 * which registry value the click meant, and the honest way to answer that
 * is to look again rather than to trust an id posted by the UI -- an id
 * the UI made up would otherwise name a registry write target. The extra
 * columns cost about a second and a half and answer nothing the write
 * needs, so they are not read for it. */
export async function getStartupEntries() {
  let raw;
  try {
    raw = await runPowerShellJson(STARTUP_QUERY);
  } catch {
    return [];
  }
  if (!raw) return [];

  // The query used to return a bare array and now returns
  // { items, approved }. Both shapes are read so a packaged app running an
  // older backend against a newer frontend still lists something.
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : [raw]);
  return attachEnabledState(rows.map(normalizeStartupItem).filter(Boolean), raw.approved);
}

/** Everything set to run at sign-in.
 *
 * Broken entries sort first: they are the reason to look at this list at
 * all, and everything else here is working as intended. */
export async function getStartupItems() {
  const base = await getStartupEntries();
  if (base.length === 0) return [];

  // A second pass over the executables, for the three columns Revo shows
  // that the registry cannot answer: what the file says it is, who signed
  // it, and whether it is running right now. One call for the whole list.
  const details = await getStartupDetails(base.map((item) => item.executable));
  const items = base.map((item) => {
    const detail = (item.executable && details[item.executable]) || {};
    return {
      ...item,
      description: detail.description ?? null,
      publisher: detail.publisher ?? null,
      // Explicitly false rather than null: the process snapshot covered
      // every entry, so "not in it" is an answer, not a gap.
      running: detail.running === true
    };
  });

  return items.sort((a, b) => {
    if (a.exists === false && b.exists !== false) return -1;
    if (b.exists === false && a.exists !== false) return 1;
    return a.name.localeCompare(b.name);
  });
}
