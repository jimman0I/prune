import { runPowerShellJson } from './powershell.js';
import { isValidPackageFullName } from './removeStoreApp.js';
import { defaultSnapshotStore } from '../lib/snapshotStore.js';

/** Store apps live in a different world from the uninstall registry, and
 * programs.js deliberately does not read them -- Get-AppxPackage is a
 * separate mechanism with a separate removal command.
 *
 * The consequence was that 81 installed applications on this machine were
 * invisible to Prune, 6.28 GB of them, while Revo Uninstaller gives them a
 * module of their own. This is that list.
 *
 * Frameworks and system packages are filtered out in the query rather
 * than here: a framework is a shared runtime nobody installed on purpose,
 * and the system packages are Windows itself. What is left is what a
 * person would recognise as an app they have.
 *
 * Sizes are measured in the same pass. WindowsApps is ACL-restricted, but
 * reading it works unelevated on this machine -- 81 packages in 2.7
 * seconds -- and where it does not, the app reports no size rather than
 * zero. */
const STORE_QUERY = `
$apps = Get-AppxPackage -ErrorAction SilentlyContinue |
  Where-Object { -not $_.IsFramework -and $_.SignatureKind -ne 'System' -and $_.InstallLocation }

$rows = foreach ($p in $apps) {
  $display = ''
  $manifest = Join-Path $p.InstallLocation 'AppxManifest.xml'
  if (Test-Path $manifest) {
    try {
      # XmlDocument.Load honours the declaration inside the file. Reading
      # it through Get-Content instead applies the machine's legacy
      # codepage at READ time, which turned a Greek language pack's name
      # into mojibake before any output encoding could matter.
      $doc = New-Object System.Xml.XmlDocument
      $doc.Load($manifest)
      $display = [string]$doc.Package.Properties.DisplayName
    } catch { $display = '' }
  }
  # A manifest DisplayName is whatever the publisher typed, and at least
  # one package on this machine has a newline in it -- which produced a
  # raw control character inside a JSON string and failed the whole parse,
  # taking all 81 apps with it. Stripped here, at the boundary.
  $display = ($display -replace '[\\x00-\\x1F]', ' ').Trim()

  $size = $null
  try {
    $size = (Get-ChildItem $p.InstallLocation -Recurse -File -Force -ErrorAction Stop |
      Measure-Object Length -Sum).Sum
  } catch { $size = $null }

  # Appx records no install date, so the package folder's creation time
  # stands in -- the folder is created when the package is staged, which
  # is the install. Same class of approximation as the registry rows that
  # take theirs from the uninstall key's write time.
  $installed = ''
  try {
    $installed = (Get-Item $p.InstallLocation -ErrorAction Stop).CreationTime.ToString('yyyy-MM-dd')
  } catch { $installed = '' }

  [PSCustomObject]@{
    name = [string]$p.Name
    packageFullName = [string]$p.PackageFullName
    publisher = [string]$p.Publisher
    version = [string]$p.Version
    installLocation = [string]$p.InstallLocation
    displayName = $display
    architecture = [string]$p.Architecture
    sizeBytes = $size
    installDate = $installed
    # Windows' own flag for a package the system will not let go of. Two
    # of the 81 apps this query returns on the dev machine carry it: the
    # Security interface and the app installer. Read here so the row can
    # say so and the remover can refuse, rather than finding out by
    # running Remove-AppxPackage and being told no.
    nonRemovable = [bool]$p.NonRemovable
  }
}
ConvertTo-Json -InputObject @($rows) -Compress -Depth 3
`;

/** A readable name for a Store package.
 *
 * The manifest's DisplayName is the right answer when it is a real name.
 * It is often a resource reference instead ("ms-resource:AppName"), which
 * would need the package's resource map to resolve -- so the package
 * identity is used, which at least contains the name a person would
 * recognise: "Microsoft.XboxGameOverlay" is not pretty, "Xbox Game
 * Overlay" is. */
export function friendlyStoreName(displayName, packageName) {
  const declared = typeof displayName === 'string' ? displayName.trim() : '';
  if (declared && !declared.toLowerCase().startsWith('ms-resource:')) return declared;

  const identity = typeof packageName === 'string' ? packageName.trim() : '';
  if (!identity) return null;

  // The publisher prefix is not part of the app's name.
  const last = identity.split('.').pop();
  if (!last) return null;

  // "XboxGameOverlay" -> "Xbox Game Overlay", while "TCUI" stays put: a
  // capital only starts a new word when it follows a lowercase one.
  return last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim() || null;
}

/** The common name out of a certificate subject.
 *
 * Store publishers are full distinguished names -- "CN=Realtek
 * Semiconductor Corp, O=Realtek, L=Hsinchu, C=TW" -- and only the CN is
 * the company a person would recognise. */
export function publisherFromDn(publisher) {
  const value = typeof publisher === 'string' ? publisher.trim() : '';
  if (!value) return null;

  const quoted = value.match(/CN="([^"]*)"/i);
  if (quoted) return quoted[1].trim() || null;

  const plain = value.match(/CN=([^,]*)/i);
  if (plain) return plain[1].trim() || null;

  return value;
}

/** Architecture in the same words the registry rows already use, so the
 * Type column reads the same whichever list a row came from. `Neutral`
 * genuinely has no architecture, and a blank is the honest answer. */
function architectureOf(value) {
  const arch = String(value || '').toLowerCase();
  if (arch === 'x64' || arch === 'arm64') return '64-bit';
  if (arch === 'x86' || arch === 'arm') return '32-bit';
  return null;
}

/** One package as the program list already renders programs. */
export function normalizeStoreApp(raw) {
  if (!raw?.packageFullName) return null;
  const name = friendlyStoreName(raw.displayName, raw.name);
  if (!name) return null;

  const size = Number(raw.sizeBytes);

  return {
    // Prefixed so a package can never collide with a registry key name,
    // and keyed on the full name because two versions of one package are
    // two different installs.
    id: `store:${raw.packageFullName}`,
    name,
    publisher: publisherFromDn(raw.publisher) || 'Unknown Publisher',
    version: typeof raw.version === 'string' ? raw.version : '',
    installLocation: raw.installLocation || null,
    // Zero would read as "this app is free". WindowsApps is
    // ACL-restricted and a folder we could not open has no known size.
    sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    architecture: architectureOf(raw.architecture),
    // Marked approximate for the same reason the registry rows are: it is
    // when the package folder appeared, not a date anyone declared.
    installDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.installDate || '') ? raw.installDate : null,
    installDateApproximate: /^\d{4}-\d{2}-\d{2}$/.test(raw.installDate || '') || undefined,
    packageFullName: raw.packageFullName,
    packageName: raw.name || null,
    // Defaults to true when the query said nothing. An unknown answer
    // here should mean "do not offer to remove it", not "go ahead" --
    // the cost of the two mistakes is not remotely symmetrical.
    nonRemovable: raw.nonRemovable !== false,
    source: 'store'
  };
}

/** Every Store app installed for this user.
 *
 * Returns [] when the query fails, which on a machine with the Appx
 * cmdlets disabled is not an error worth breaking the program list over. */
export async function getStoreApps({ fresh = false } = {}) {
  // Held as the in-flight promise, like the versions: the start-up warm
  // and a request arriving while it still runs share one pass. Measuring
  // 81 package folders takes about five seconds, so the answer is kept --
  // but not forever. An app removed outside Prune (Windows Settings, the
  // Store itself) never reached forgetStoreApp, and a list that was only ever
  // read once kept showing it until the next launch.
  //
  // The finished list is also kept on disk, and the first ask of a launch is
  // answered from it at once while a real scan runs behind it: the scan walks
  // every package folder for its size, about seven seconds here, and the icons
  // and the Applications screen both waited on it.
  if (!fresh) {
    if (cached && Date.now() - cachedAt > STORE_LIST_TTL_MS) {
      // Expired: keep showing the old list while a new one is made.
      cachedAt = Date.now();
      refreshStoreList();
    }
    if (!cached) {
      const saved = snapshotChecked ? null : await readSnapshot();
      snapshotChecked = true;
      if (saved && !cached) {
        cachedAt = Date.now();
        cached = Promise.resolve(saved);
        refreshStoreList();
        return cached;
      }
      if (!cached) {
        cachedAt = Date.now();
        cached = resolveStoreApps().then((list) => {
          if (list.length > 0) snapshot.write(list).catch(() => {});
          return list;
        }).catch((error) => {
          cached = null;
          throw error;
        });
      }
    }
    return cached;
  }
  return resolveStoreApps();
}

const snapshot = defaultSnapshotStore('store-apps.json');
let snapshotChecked = false;

async function readSnapshot() {
  const saved = await snapshot.read().catch(() => null);
  return Array.isArray(saved) && saved.length > 0 ? saved : null;
}

/** Packages removed through Prune, and when. A background scan that began before
 * a removal can still report the package; this keeps it from coming back. */
const removedAt = new Map();
let refreshing = false;

/** Re-scans in the background and swaps the answer in when it arrives. A scan
 * that failed (it reports that as an empty list) never replaces a good list. */
function refreshStoreList() {
  if (refreshing) return;
  refreshing = true;
  const startedAt = Date.now();
  resolveStoreApps()
    .then((list) => {
      const live = list.filter((entry) => !(removedAt.get(entry.packageFullName) > startedAt - 1));
      if (live.length === 0) return;
      cached = Promise.resolve(live);
      cachedAt = Date.now();
      snapshot.write(live).catch(() => {});
    })
    .catch(() => { /* the list on screen stays */ })
    .finally(() => { refreshing = false; });
}

/** How long the measured list is trusted. The folders it measured do not
 * change in minutes, so this costs one re-measure every few minutes at most,
 * and only when something asks. */
export const STORE_LIST_TTL_MS = 5 * 60 * 1000;

let cached = null;
let cachedAt = 0;

/** Asks for a new scan now, behind the list that is already held, instead of
 * waiting for the five minutes to pass. The screen calls this when the person
 * comes back to the window, because that is when an app installed or removed in
 * Windows has most likely changed. Nothing held yet means nothing to refresh:
 * the first ask makes the list anyway. */
export function refreshStoreAppsNow() {
  if (!cached) return false;
  cachedAt = Date.now();
  refreshStoreList();
  return true;
}

/** Testing seam -- the cache is process-wide. */
export function clearStoreAppCache() {
  cached = null;
  snapshotChecked = true; // a test clearing the cache wants a real scan, not the disk
  removedAt.clear();
}

/** Takes one package out of the cached list after it was removed.
 *
 * The list is cached for the life of the process because measuring 81 package
 * folders takes seconds and nothing changes it from outside. A removal made
 * through Prune is the one change Prune makes itself, and without this the
 * app stayed on screen: the screen re-read the list and was handed the stale
 * copy. Filtering the cache keeps every other row's measured size and costs
 * nothing, where clearing it would re-measure all of them. */
export function forgetStoreApp(packageFullName) {
  removedAt.set(packageFullName, Date.now());
  if (!cached) return;
  cached = cached.then((list) => {
    const kept = list.filter((entry) => entry.packageFullName !== packageFullName);
    if (kept.length > 0) snapshot.write(kept).catch(() => {});
    return kept;
  });
}

/** One installed package, or null: the identity and the NonRemovable flag
 * Windows reports for it right now.
 *
 * Removal needs exactly this and nothing the full list measures. Re-running
 * the whole Store query first (every package folder walked for its size) made
 * the Uninstall button sit for seconds before Remove-AppxPackage even started.
 * The name is checked against the same pattern the remover enforces, since it
 * becomes part of a PowerShell script, and the lookup is narrowed by the
 * package name (the part before the first underscore) so Windows is asked
 * about one package rather than all of them. */
export async function getStorePackage(packageFullName) {
  if (!isValidPackageFullName(packageFullName)) return null;
  const packageName = packageFullName.split('_')[0];
  if (!packageName) return null;

  let raw;
  try {
    raw = await runPowerShellJson(`
$p = Get-AppxPackage -Name '${packageName}' -ErrorAction SilentlyContinue |
  Where-Object { $_.PackageFullName -eq '${packageFullName}' } | Select-Object -First 1
if ($p) {
  [PSCustomObject]@{
    name = [string]$p.Name
    packageFullName = [string]$p.PackageFullName
    nonRemovable = [bool]$p.NonRemovable
  } | ConvertTo-Json -Compress
}
`);
  } catch {
    return null;
  }
  if (!raw || raw.packageFullName !== packageFullName) return null;
  return {
    name: friendlyStoreName(null, raw.name) || raw.name,
    packageFullName: raw.packageFullName,
    // Same default as normalizeStoreApp: unknown means "do not offer to remove".
    nonRemovable: raw.nonRemovable !== false
  };
}

async function resolveStoreApps() {
  let raw;
  try {
    raw = await runPowerShellJson(STORE_QUERY);
  } catch {
    return [];
  }
  if (!raw) return [];

  // ConvertTo-Json collapses a single-element array to a bare object.
  const rows = Array.isArray(raw) ? raw : [raw];
  return rows.map(normalizeStoreApp).filter(Boolean);
}
