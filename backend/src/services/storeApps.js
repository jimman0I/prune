import { runPowerShellJson } from './powershell.js';

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

  [PSCustomObject]@{
    name = [string]$p.Name
    packageFullName = [string]$p.PackageFullName
    publisher = [string]$p.Publisher
    version = [string]$p.Version
    installLocation = [string]$p.InstallLocation
    displayName = $display
    architecture = [string]$p.Architecture
    sizeBytes = $size
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
    packageFullName: raw.packageFullName,
    packageName: raw.name || null,
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
  // 81 package folders takes about five seconds and the answer does not
  // change while the app is open.
  if (!fresh) {
    if (!cached) {
      cached = resolveStoreApps().catch((error) => {
        cached = null;
        throw error;
      });
    }
    return cached;
  }
  return resolveStoreApps();
}

let cached = null;

/** Testing seam -- the cache is process-wide. */
export function clearStoreAppCache() {
  cached = null;
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
