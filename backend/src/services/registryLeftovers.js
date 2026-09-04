import { runPowerShellJson } from './powershell.js';

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
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce'
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
  ...SOFTWARE_ROOTS, ...CLASSES_ROOTS, ...UNINSTALL_ROOTS, ...APP_PATH_ROOTS, ...RUN_ROOTS,
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

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A PowerShell array literal of single-quoted paths. Several of these
 * contain a space ("App Paths"), so the quoting is not optional -- an
 * unquoted one is two array elements and a parse error, which is the exact
 * shape of the bug that silently took the file scan down for a week. */
function psArray(paths) {
  return `@(${paths.map((p) => `'${p}'`).join(',')})`;
}

/** The whole registry sweep as one script.
 *
 * One call rather than six: each pass is cheap, and six trips through
 * powershell.exe would spend more time starting processes than searching.
 * Exported so a test can run it against real PowerShell -- a mocked test
 * cannot see a script that does not parse. */
export function buildRegistryScript(pattern) {
  return `
$ErrorActionPreference = 'SilentlyContinue'
$pattern = '${pattern}'
$found = New-Object System.Collections.ArrayList
function Add-Found($path, $valueName, $isUninstall) {
  [void]$found.Add([pscustomobject]@{ path = $path; valueName = $valueName; isUninstallEntry = $isUninstall })
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

# The Add/Remove Programs entry. GetValue on the key object rather than
# Get-ItemProperty: this runs for every one of several hundred entries, and
# the cmdlet costs far more per call than the method it wraps.
foreach ($root in ${psArray(UNINSTALL_ROOTS)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    $display = [string]$key.GetValue('DisplayName')
    if ($key.PSChildName -match $pattern -or $display -match $pattern) {
      Add-Found $key.Name $null $true
    }
  }
}

foreach ($root in ${psArray(APP_PATH_ROOTS)}) {
  foreach ($key in (Get-ChildItem -Path $root -ErrorAction SilentlyContinue)) {
    if ($key.PSChildName -match $pattern) { Add-Found $key.Name $null $false }
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
      if ($valueName -match $pattern -or $data -match $pattern) {
        Add-Found $key.Name $valueName $false
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

  for (const entry of raw || []) {
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
    items.push(item);
  }

  return items;
}

/** Searches the registry for one program's leftovers.
 *
 * Same contract as the other leftover scans: { ok, items }, and a failure
 * is the caller's to downgrade rather than this function's to hide. */
export async function scanRegistryLeftovers(name, publisher) {
  const terms = [name, publisher].filter(Boolean).map(escapeForRegex);
  // An empty pattern matches every key on the machine.
  if (terms.length === 0) return { ok: true, items: [] };

  const raw = await runPowerShellJson(buildRegistryScript(terms.join('|')));
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: normalizeRegistryItems(list) };
}
