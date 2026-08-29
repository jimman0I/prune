import { runPowerShellJson } from './powershell.js';

// Reads all three Uninstall registry locations Windows actually uses:
// HKLM 64-bit (machine-wide), HKLM WOW6432Node (32-bit apps on 64-bit
// Windows), and HKCU (per-user installs). One PowerShell call combining
// all three, not three separate calls — halves the PowerShell-process-
// spawn cost this pays on every program-list load. Store/UWP apps are NOT
// read here (Get-AppxPackage, a different mechanism) — out of scope for
// Phase A, see the design spec.
const ENUMERATE_SCRIPT = `
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\*'
)
Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -and -not $_.SystemComponent } |
  Select-Object @{N='id';E={$_.PSChildName}}, @{N='name';E={$_.DisplayName}},
    @{N='publisher';E={$_.Publisher}}, @{N='version';E={$_.DisplayVersion}},
    @{N='installDate';E={$_.InstallDate}}, @{N='estimatedSizeKb';E={$_.EstimatedSize}},
    @{N='uninstallString';E={$_.UninstallString}}, @{N='installLocation';E={$_.InstallLocation}} |
  ConvertTo-Json -Compress
`;

/** Real installed programs, normalized. PowerShell's ConvertTo-Json
 * returns a single OBJECT (not an array) when exactly one result
 * matches — normalized to always return an array. */
export async function listInstalledPrograms() {
  const raw = await runPowerShellJson(ENUMERATE_SCRIPT);
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map(normalizeProgram);
}

/** Exported for direct testing — the raw-registry-shape-to-app-shape
 * mapping is the part worth unit-testing on its own. */
export function normalizeProgram(raw) {
  return {
    id: raw.id,
    name: raw.name,
    publisher: raw.publisher || 'Unknown Publisher',
    version: raw.version || '',
    installDate: parseRegistryDate(raw.installDate),
    // EstimatedSize is KB in the registry; the rest of the app works in bytes.
    sizeBytes: typeof raw.estimatedSizeKb === 'number' ? raw.estimatedSizeKb * 1024 : null,
    uninstallString: raw.uninstallString || null,
    installLocation: raw.installLocation || null
  };
}

/** Registry InstallDate is YYYYMMDD (a plain string) or absent. Returns an
 * ISO date string or null — never throws on a malformed value, since this
 * is third-party-controlled data. */
function parseRegistryDate(raw) {
  if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;
  const year = raw.slice(0, 4), month = raw.slice(4, 6), day = raw.slice(6, 8);
  return `${year}-${month}-${day}`;
}
