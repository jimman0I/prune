import { runPowerShellJson } from './powershell.js';
import { buildSearchPattern, psQuote } from './leftoverPattern.js';

/** Where a program's registry leftovers actually live.
 *
 * The original scan looked at the immediate children of HKCU:\Software and
 * HKLM:\Software and nothing else. That misses most of what Revo
 * Uninstaller Pro finds, and every miss is a key the user is never offered
 * and so never gets rid of:
 *
 *  - WOW6432Node. A 32-bit program on 64-bit Windows writes its settings
 *    under HKLM:\Software\WOW6432Node, which is a sibling of the vendor
 *    keys the old scan read, not one of them. Most installers on this
 *    machine are 32-bit, so this was the largest hole.
 *  - Vendor\Product. Software often nests: the vendor key named for the
 *    company, the product key beneath it. A scan one level deep only ever
 *    matched whichever of the two happened to be on top.
 *  - The Add/Remove Programs entry. This is the key that makes Windows
 *    list a program at all, and the reason a dead entry never leaves the
 *    list on its own. Its key name is a GUID for anything installed by
 *    MSI, so it has to be matched on its DisplayName instead.
 *  - App Paths. What Windows searches when you type a program's name into
 *    Run; a stale one points at a deleted executable.
 *  - Run and RunOnce. These are VALUES inside a key that every program
 *    shares, so they come out one value at a time -- deleting the key
 *    would take every other program's startup entry with it.
 *  - Classes. File associations and ProgIDs, per-user and machine-wide. */
const SOFTWARE_ROOTS = [
  'HKCU:\\Software',
  'HKLM:\\Software',
  'HKLM:\\Software\\WOW6432Node'
];

const CLASSES_ROOTS = ['HKCU:\\Software\\Classes', 'HKLM:\\Software\\Classes'];

const CLSID_ROOTS = [
  'HKCU:\\Software\\Classes\\CLSID',
  'HKLM:\\Software\\Classes\\CLSID',
  'HKLM:\\Software\\Classes\\WOW6432Node\\CLSID'
];

const REGISTERED_APPLICATIONS_ROOTS = [
  'HKCU:\\Software\\RegisteredApplications',
  'HKLM:\\Software\\RegisteredApplications',
  'HKLM:\\Software\\WOW6432Node\\RegisteredApplications'
];

const UNINSTALL_ROOTS = [
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
];

const APP_PATH_ROOTS = [
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths'
];

const RUN_ROOTS = [
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
  // Revo's Autorun Manager reads these too. The first two are the policy-
  // enforced Run list; RunServices(Once) are legacy keys that old installers
  // still write and nothing ever removes.
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServices',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServices',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServicesOnce',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServicesOnce'
];

/** SharedDLLs: a reference count per shared file, keyed by the file's full
 * path. An installer adds one for every shared DLL it drops and an
 * uninstaller is meant to take it away again; one that does not leaves a
 * count for a file that is gone. Revo's leftover scan reads this list, and
 * so does Prune now. The entries are VALUES inside a key every program
 * shares, so they come out one value at a time, like Run. */
export const SHARED_DLL_ROOTS = [
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\SharedDLLs',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\SharedDLLs'
];

/** Three more places Revo's leftover scan reads, all machine-wide.
 *
 *  - Firewall rules. Installing a networked program usually adds an allow
 *    rule; uninstalling it rarely removes it. Each rule is one VALUE in the
 *    FirewallRules key, whose data is a `|`-separated list that includes the
 *    `App=` executable path and the `Name=` the rule was given.
 *  - MSConfig's disabled-startup records. When a startup entry is switched
 *    off in msconfig the entry moves into one subkey here, and stays after
 *    the program is gone.
 *  - Event Log sources. A program that logs to the Application log registers
 *    a source key naming the file that holds its message text. */
export const FIREWALL_RULE_ROOTS = [
  'HKLM:\\System\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy\\FirewallRules'
];
export const MSCONFIG_STARTUP_ROOTS = [
  'HKLM:\\Software\\Microsoft\\Shared Tools\\MSConfig\\startupreg'
];
export const EVENT_LOG_ROOTS = [
  'HKLM:\\System\\CurrentControlSet\\Services\\EventLog\\Application'
];

/** One comparable spelling for a registry path.
 *
 * The same key has several: PowerShell's providers say HKLM:\Software,
 * Get-ChildItem's own .Name property says HKEY_LOCAL_MACHINE\SOFTWARE, and
 * reg.exe accepts either. Case differs freely between them. Comparing raw
 * strings would let a protected key through under an alias, and would list
 * one leftover twice when two passes reached it by different names. */
export function canonicalKeyPath(path) {
  if (typeof path !== 'string') return '';
  const collapsed = path.trim().replace(/[\\/]+/g, '\\').replace(/\\+$/, '');
  return collapsed
    .replace(/^HKEY_LOCAL_MACHINE/i, 'HKLM')
    .replace(/^HKEY_CURRENT_USER/i, 'HKCU')
    .replace(/^HKEY_CLASSES_ROOT/i, 'HKCR')
    .replace(/^HKEY_USERS/i, 'HKU')
    .replace(/^HKEY_CURRENT_CONFIG/i, 'HKCC')
    .replace(/^(HKLM|HKCU|HKCR|HKU|HKCC):/i, '$1')
    .toUpperCase();
}

/** Keys that belong to Windows, or to every program at once.
 *
 * The scan matches key names against the program's name and its publisher,
 * and some publishers are short, common words. Anything published by
 * "Microsoft" matches HKLM:\Software\Microsoft exactly -- and that key is
 * most of what Windows knows about itself. Offering it with a checkbox
 * already ticked is a machine-destroying default, so no pass may ever emit
 * one of these as a whole-key deletion.
 *
 * Every container the scan reads is in here too, for the same reason from
 * the other direction: a match INSIDE one of them is a leftover, the
 * container itself never is. Values are exempt from the rule -- removing
 * one value out of the Run key is the entire point of reading it. */
const PROTECTED_KEYS = new Set([
  ...SOFTWARE_ROOTS, ...CLASSES_ROOTS, ...UNINSTALL_ROOTS, ...APP_PATH_ROOTS, ...RUN_ROOTS, ...SHARED_DLL_ROOTS,
  ...FIREWALL_RULE_ROOTS, ...MSCONFIG_STARTUP_ROOTS, ...EVENT_LOG_ROOTS,
  'HKLM:\\System\\CurrentControlSet\\Services\\EventLog',
  'HKLM:\\System\\CurrentControlSet\\Services',
  ...CLSID_ROOTS, ...REGISTERED_APPLICATIONS_ROOTS,
  'HKLM:\\Software\\Classes\\Installer',
  'HKLM:\\Software\\Classes\\Interface',
  'HKLM:\\Software\\Classes\\TypeLib',
  'HKLM:\\Software\\Classes\\AppID',
  'HKLM:\\Software\\Classes\\WOW6432Node',
  'HKLM:\\Software\\Microsoft',
  'HKCU:\\Software\\Microsoft',
  'HKLM:\\Software\\WOW6432Node\\Microsoft',
  'HKLM:\\Software\\Policies',
  'HKCU:\\Software\\Policies',
  'HKLM:\\Software\\Microsoft\\Windows',
  'HKCU:\\Software\\Microsoft\\Windows',
  'HKLM:\\Software\\Microsoft\\Windows NT',
  'HKCU:\\Software\\Microsoft\\Windows NT',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion',
  'HKLM:\\Software\\Microsoft\\Windows NT\\CurrentVersion'
].map(canonicalKeyPath));

/** Whether this key must never be offered for deletion on its own.
 *
 * Depth is half the rule: a path shorter than hive\Software\Something
 * cannot name one program's own key whatever it is called. */
export function isProtectedKey(path) {
  const canonical = canonicalKeyPath(path);
  if (canonical.split('\\').filter(Boolean).length < 3) return true;
  return PROTECTED_KEYS.has(canonical);
}

/** A PowerShell array literal of single-quoted paths. Several of these
 * contain a space ("App Paths"), so the quoting is not optional -- an
 * unquoted one is two array elements and a parse error, which is the exact
 * shape of the bug that silently took the file scan down for a week. */
function psArray(paths) {
  return `@(${paths.map((p) => `'${p}'`).join(',')})`;
}

/** The extra passes only the Advanced scan makes.
 *
 *  - A third level under each vendor key, for software that nests deeper
 *    than Vendor\Product. Microsoft and the policy hive are not entered:
 *    they hold every other program's keys and a name match inside them is
 *    far more likely to be Windows than a leftover.
 *  - COM registrations. A program's CLSIDs outlive it and are named by GUID,
 *    so they are matched on their label and on the path of the server they
 *    load, which is where the program's name actually appears.
 *  - RegisteredApplications, a list of values rather than keys. */
const advancedRegistryPasses = ({ firewallRoots, eventLogRoots }) => `
# Advanced: Vendor\\Product\\Sub, still without entering Microsoft.
foreach ($root in ${psArray(SOFTWARE_ROOTS)}) {
  foreach ($vendor in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    if ($vendor.PSChildName -match '^(Classes|WOW6432Node|Microsoft|Policies)$') { continue }
    foreach ($product in (Get-ChildItem -Path $vendor.PSPath -ErrorAction SilentlyContinue)) {
      foreach ($key in (Get-ChildItem -Path $product.PSPath -ErrorAction SilentlyContinue)) {
        if ($key.PSChildName -match $pattern) { Add-Found $key.Name $null $false }
      }
    }
  }
}

# Advanced: COM registrations, on the label and on the server they load.
foreach ($root in ${psArray(CLSID_ROOTS)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    $label = [string]$key.GetValue('')
    $hit = $label -match $pattern
    $how = 'name'
    foreach ($server in 'InprocServer32','LocalServer32') {
      $sub = $key.OpenSubKey($server)
      if ($sub) {
        $command = [string]$sub.GetValue('')
        $sub.Close()
        if (Test-Anchored $command) { $hit = $true; $how = 'anchor'; break }
        if (-not $hit -and $command -match $pattern) { $hit = $true }
      }
    }
    if ($hit) { Add-Found $key.Name $null $false $how $label }
  }
}

# Advanced: RegisteredApplications values.
foreach ($root in ${psArray(REGISTERED_APPLICATIONS_ROOTS)}) {
  $key = Get-Item -Path $root -ErrorAction SilentlyContinue
  if ($key) {
    foreach ($valueName in $key.GetValueNames()) {
      if ($valueName -match $pattern -or ([string]$key.GetValue($valueName)) -match $pattern) {
        Add-Found $key.Name $valueName $false 'name' $valueName
      }
    }
  }
}

# Advanced: a firewall rule that matches by the name it was given, but only when
# the program it points at is gone. A rule for an executable that still exists
# belongs to something installed, whatever it is called.
foreach ($root in ${psArray(firewallRoots)}) {
  $key = Get-Item -Path $root -ErrorAction SilentlyContinue
  if ($key) {
    foreach ($valueName in $key.GetValueNames()) {
      $data = [string]$key.GetValue($valueName)
      $name = [regex]::Match($data, '(?:^|\\|)Name=([^|]*)').Groups[1].Value
      $app = [regex]::Match($data, '(?:^|\\|)App=([^|]*)').Groups[1].Value
      if (-not (Test-Anchored $app) -and $app -and $name -match $pattern -and -not (Test-Path -LiteralPath ([Environment]::ExpandEnvironmentVariables($app)))) {
        Add-Found $key.Name $valueName $false 'name' ($name + ' ' + $app)
      }
    }
  }
}

# Advanced: Event Log sources. A source is the program's name for itself in the
# Application log. Anchored when the file holding its message text is in the
# program's own folder; otherwise matched by name only when that file is gone.
foreach ($root in ${psArray(eventLogRoots)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    $message = [string]$key.GetValue('EventMessageFile')
    if (Test-Anchored $message) {
      Add-Found $key.Name $null $false 'anchor' $key.PSChildName
    } elseif ($key.PSChildName -match $pattern -and $message) {
      $first = [Environment]::ExpandEnvironmentVariables(($message -split ';')[0].Trim('"'))
      if ($first -and -not (Test-Path -LiteralPath $first)) { Add-Found $key.Name $null $false 'name' $key.PSChildName }
    }
  }
}
`;

/** The whole registry sweep as one script.
 *
 * One call rather than six: each pass is cheap, and six trips through
 * powershell.exe would spend more time starting processes than searching.
 * Exported so a test can run it against real PowerShell -- a mocked test
 * cannot see a script that does not parse. */
export function buildRegistryScript(pattern, {
  advanced = false, anchors = [], sharedDllRoots = SHARED_DLL_ROOTS,
  firewallRoots = FIREWALL_RULE_ROOTS, msconfigRoots = MSCONFIG_STARTUP_ROOTS, eventLogRoots = EVENT_LOG_ROOTS
} = {}) {
  return `
$ErrorActionPreference = 'SilentlyContinue'
$pattern = '${psQuote(pattern)}'
# The program's own folders, lower-cased with a trailing separator, so that a
# command line merely CONTAINING one is anchored and "...\\foo\\" never matches
# "...\\foobar\\".
$anchors = ${anchors.length > 0 ? `@(${anchors.map((a) => `'${psQuote(String(a).toLowerCase().replace(/[\\/]+$/, ''))}\\'`).join(',')})` : '@()'}
$found = New-Object System.Collections.ArrayList
function Add-Found($path, $valueName, $isUninstall, $how, $text) {
  [void]$found.Add([pscustomobject]@{ path = $path; valueName = $valueName; isUninstallEntry = $isUninstall; how = $how; text = $text })
}
function Test-Anchored($value) {
  if (-not $value) { return $false }
  # A trailing separator is added so that a value naming the folder itself
  # ("C:\\Apps\\Foo") is anchored by "c:\\apps\\foo\\" too.
  $lower = ([string]$value).ToLowerInvariant().TrimEnd('\\') + '\\'
  foreach ($anchor in $anchors) { if ($lower.Contains($anchor)) { return $true } }
  return $false
}

# Vendor and product keys named for the program, one level down.
foreach ($root in ${psArray([...SOFTWARE_ROOTS, ...CLASSES_ROOTS])}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    if ($key.PSChildName -match $pattern) { Add-Found $key.Name $null $false }
  }
}

# And two levels down, for software that nests its product under its
# vendor. WOW6432Node and Classes are skipped here only because they are
# already roots in their own right above.
foreach ($root in ${psArray(SOFTWARE_ROOTS)}) {
  foreach ($vendor in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    if ($vendor.PSChildName -match '^(Classes|WOW6432Node)$') { continue }
    foreach ($key in (Get-ChildItem -Path $vendor.PSPath -ErrorAction SilentlyContinue)) {
      if ($key.PSChildName -match $pattern) { Add-Found $key.Name $null $false }
    }
  }
}
${advanced ? advancedRegistryPasses({ firewallRoots, eventLogRoots }) : ''}
# The Add/Remove Programs entry. GetValue on the key object rather than
# Get-ItemProperty: this runs for every one of several hundred entries, and
# the cmdlet costs far more per call than the method it wraps.
foreach ($root in ${psArray(UNINSTALL_ROOTS)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    $display = [string]$key.GetValue('DisplayName')
    if ((Test-Anchored $key.GetValue('InstallLocation')) -or (Test-Anchored $key.GetValue('UninstallString')) -or (Test-Anchored $key.GetValue('DisplayIcon'))) {
      Add-Found $key.Name $null $true 'anchor' $display
    } elseif ($key.PSChildName -match $pattern -or $display -match $pattern) {
      Add-Found $key.Name $null $true 'name' $display
    }
  }
}

foreach ($root in ${psArray(APP_PATH_ROOTS)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    if (Test-Anchored $key.GetValue('')) { Add-Found $key.Name $null $false 'anchor' $null }
    elseif ($key.PSChildName -match $pattern) { Add-Found $key.Name $null $false 'name' $null }
  }
}

# Startup entries, which are values rather than keys. Matched on the
# command line as well as the value name: roughly half are named for the
# vendor and half for the executable they launch.
foreach ($root in ${psArray(RUN_ROOTS)}) {
  $key = Get-Item -Path $root -ErrorAction SilentlyContinue
  if ($key) {
    foreach ($valueName in $key.GetValueNames()) {
      $data = [string]$key.GetValue($valueName)
      if (Test-Anchored $data) {
        Add-Found $key.Name $valueName $false 'anchor' ($valueName + ' ' + $data)
      } elseif ($valueName -match $pattern -or $data -match $pattern) {
        Add-Found $key.Name $valueName $false 'name' ($valueName + ' ' + $data)
      }
    }
  }
}

# Firewall rules whose program lives in the program's own folder. The rule is a
# value; its data carries the executable as App=<path>.
foreach ($root in ${psArray(firewallRoots)}) {
  $key = Get-Item -Path $root -ErrorAction SilentlyContinue
  if ($key) {
    foreach ($valueName in $key.GetValueNames()) {
      $data = [string]$key.GetValue($valueName)
      $app = [regex]::Match($data, '(?:^|\\|)App=([^|]*)').Groups[1].Value
      if ($app -and (Test-Anchored ([Environment]::ExpandEnvironmentVariables($app)))) {
        $name = [regex]::Match($data, '(?:^|\\|)Name=([^|]*)').Groups[1].Value
        Add-Found $key.Name $valueName $false 'anchor' ($name + ' ' + $app)
      }
    }
  }
}

# Records msconfig keeps for startup entries it switched off. One subkey per
# entry, so the whole subkey goes; matched on its name or on a command that
# points into the program's own folder.
foreach ($root in ${psArray(msconfigRoots)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    $command = [string]$key.GetValue('command')
    if (Test-Anchored $command) { Add-Found $key.Name $null $false 'anchor' ($key.PSChildName + ' ' + $command) }
    elseif ($key.PSChildName -match $pattern -or $command -match $pattern) { Add-Found $key.Name $null $false 'name' ($key.PSChildName + ' ' + $command) }
  }
}

# Shared-file reference counts. The value NAME is the file's full path. One in
# the program's own folder is anchored; one that only matches by name must also
# be a file that no longer exists, because a shared DLL that is still on disk
# may well be in use by something else.
foreach ($root in ${psArray(sharedDllRoots)}) {
  $key = Get-Item -Path $root -ErrorAction SilentlyContinue
  if ($key) {
    foreach ($valueName in $key.GetValueNames()) {
      if (Test-Anchored $valueName) {
        Add-Found $key.Name $valueName $false 'anchor' $valueName
      } elseif ($valueName -match $pattern -and -not (Test-Path -LiteralPath $valueName)) {
        Add-Found $key.Name $valueName $false 'name' $valueName
      }
    }
  }
}

$found | ConvertTo-Json -Compress
`;
}

/** Turns what PowerShell reported into the list the UI and the remover
 * take: no duplicates, no protected keys, and no fields that say nothing.
 *
 * A key and a value inside that key are different targets and both
 * survive: the pair (path, valueName) is what makes an entry unique, not
 * the path on its own. */
export function normalizeRegistryItems(raw) {
  const seen = new Set();
  const items = [];

  // An entry the program's own folder vouches for comes first, so when the
  // same key was also reached by name it is the anchored one that survives.
  const ordered = [...(raw || [])].sort((a, b) => (b?.how === 'anchor') - (a?.how === 'anchor'));
  for (const entry of ordered) {
    const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
    if (!path) continue;
    const valueName = typeof entry?.valueName === 'string' && entry.valueName !== '' ? entry.valueName : null;
    if (valueName === null && isProtectedKey(path)) continue;

    const identity = `${canonicalKeyPath(path)}||${valueName === null ? '' : valueName.toUpperCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const item = { path };
    if (valueName !== null) item.valueName = valueName;
    if (entry.isUninstallEntry === true) item.isUninstallEntry = true;
    // What the scan matched on, for the confidence tier. `anchored` means the
    // program's own folder is named in it; `text` is the label or command
    // that matched. Both are consumed by leftoverScan and not shown.
    if (entry.how === 'anchor') item.anchored = true;
    if (typeof entry.text === 'string' && entry.text.trim() !== '') item.text = entry.text.slice(0, 300);
    items.push(item);
  }

  return items;
}

/** Searches the registry for one program's leftovers.
 *
 * Same contract as the other leftover scans: { ok, items }, and a failure
 * is the caller's to downgrade rather than this function's to hide. */
export async function scanRegistryLeftovers(name, publisher, { advanced = false, extraPattern = null, anchorDirs = [] } = {}) {
  const base = buildSearchPattern(name, publisher);
  // An empty pattern matches every key on the machine. With nothing to match
  // on by name the sweep can still run on the program's folders alone, with a
  // pattern that matches nothing.
  if (base === null && anchorDirs.length === 0) return { ok: true, items: [] };
  const named = base ?? '(?!)';
  const pattern = advanced && extraPattern ? `${named}|${extraPattern}` : named;

  // The Advanced sweep reads thousands of COM keys; the default 15 seconds
  // and a retry would time it out and then do the whole thing over again.
  const options = advanced ? { timeoutMs: 120000, retries: 0 } : undefined;
  const raw = await runPowerShellJson(buildRegistryScript(pattern, { advanced, anchors: anchorDirs }), options);
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: normalizeRegistryItems(list) };
}

/** Whether a key path is one this module may hand to PowerShell: a PowerShell
 * drive path in one of the two hives a user program registers itself in. The
 * path becomes a single-quoted literal, so the only character that needs
 * care is the quote; control characters never occur in a real key path. */
function isScannableKeyPath(path) {
  return typeof path === 'string' && /^HK(LM|CU):\\[^\u0000-\u001f]+$/i.test(path);
}

/** The Safe scan's registry half: the program's own key and nothing else,
 * reported only if it is still there. A working uninstaller removes its own
 * key, so on a clean uninstall this is usually empty -- which is the
 * correct, honest answer for a scan that guesses nothing. */
export async function scanRegistryAnchor(registryKey) {
  if (!isScannableKeyPath(registryKey)) return { ok: true, items: [] };
  const literal = registryKey.replace(/'/g, "''");
  const raw = await runPowerShellJson(`
$key = Get-Item -LiteralPath '${literal}' -ErrorAction SilentlyContinue
if ($key) { [pscustomobject]@{ path = $key.Name; valueName = $null; isUninstallEntry = $true } | ConvertTo-Json -Compress }
`);
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: normalizeRegistryItems(list) };
}
