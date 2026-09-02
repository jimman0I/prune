import { runPowerShellJson } from './powershell.js';
import { assessProgramHealth } from './programHealth.js';

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
    @{N='uninstallString';E={$_.UninstallString}}, @{N='installLocation';E={$_.InstallLocation}},
    @{N='psPath';E={$_.PSPath}}, @{N='displayIcon';E={$_.DisplayIcon}},
    @{N='urlInfoAbout';E={$_.URLInfoAbout}}, @{N='helpLink';E={$_.HelpLink}} |
  ConvertTo-Json -Compress
`;

/** Real installed programs, normalized. PowerShell's ConvertTo-Json
 * returns a single OBJECT (not an array) when exactly one result
 * matches — normalized to always return an array. */
export async function listInstalledPrograms() {
  const raw = await runPowerShellJson(ENUMERATE_SCRIPT);
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  // The health check is a couple of existsSync calls per program -- a few
  // milliseconds across a whole machine's worth of entries, cheap enough
  // to run on every list rather than making callers ask for it separately.
  return dedupeIds(items.map(normalizeProgram)).map((program) => ({
    ...program,
    health: assessProgramHealth(program)
  }));
}

/** Real bug, found dogfooding (2026-08-29): PSChildName (the registry
 * subkey name used as `id`) is NOT guaranteed unique across the three
 * hives this reads — confirmed live with 7-Zip, whose installer uses the
 * literal key name "7-Zip" in BOTH the native 64-bit Uninstall hive and
 * WOW6432Node for its 32-bit build, so two genuinely different entries
 * (7-Zip 22.01 and 7-Zip 25.01 (x64)) collided on id: '7-Zip'. React
 * (ProgramList.jsx) uses `id` as its list key, and the duplicate produced
 * a real, reproducible rendering bug — a stale row from one entry
 * bleeding into a search-filtered view of the other, plus a console
 * warning naming "7-Zip" specifically. Fixed by guaranteeing uniqueness
 * as a post-processing step regardless of what the source data looks
 * like, rather than trying to derive a naturally-unique key from the
 * registry (there isn't one, and a future collision in some other
 * program is just as plausible) — same "don't trust third-party registry
 * data, defend at the boundary" philosophy parseRegistryDate below
 * already uses. Order-stable: the first program with a given id keeps it
 * unchanged; only later collisions get a suffix, so re-running this on
 * an already-unique list is a no-op. Exported for testing. */
export function dedupeIds(programs) {
  const seen = new Map();
  return programs.map((program) => {
    const count = seen.get(program.id) ?? 0;
    seen.set(program.id, count + 1);
    return count === 0 ? program : { ...program, id: `${program.id}#${count + 1}` };
  });
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
    installLocation: raw.installLocation || null,
    registryKey: toPowerShellRegistryPath(raw.psPath),
    // Where the vendor's own icon lives. Kept raw here -- parsing it is
    // iconSource.js's job, and the icons are fetched separately so the
    // program list never waits on icon extraction.
    displayIcon: raw.displayIcon || null,
    architecture: architectureFrom(raw.psPath),
    website: firstHttpUrl(raw.urlInfoAbout, raw.helpLink)
  };
}

/** 32-bit or 64-bit, read from WHERE the entry lives rather than from any
 * value in it -- Windows records this structurally. A 32-bit program on
 * 64-bit Windows is registered under WOW6432Node; anything else in HKLM
 * is native.
 *
 * A per-user HKCU entry carries no architecture information at all, and
 * returns null rather than a guess: a wrong "64-bit" badge on a row is a
 * fact stated confidently and incorrectly, which is worse than a blank
 * cell. */
function architectureFrom(psPath) {
  if (typeof psPath !== 'string') return null;
  if (!/HKEY_LOCAL_MACHINE/i.test(psPath)) return null;
  return /WOW6432Node/i.test(psPath) ? '32-bit' : '64-bit';
}

/** The program's website. URLInfoAbout is the vendor's own product page;
 * HelpLink is the support page and a reasonable second choice.
 *
 * Both are third-party-controlled and genuinely do hold things that
 * aren't URLs, so anything that isn't http(s) is dropped rather than
 * rendered as a dead link. */
function firstHttpUrl(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^https?:\/\/\S/i.test(candidate.trim())) {
      return candidate.trim();
    }
  }
  return null;
}

/** Converts the registry provider's own PSPath into the `HKLM:\...` form
 * quarantine.js's toRegExeKeyPath understands. PowerShell reports the key
 * as `Microsoft.PowerShell.Core\Registry::HKEY_LOCAL_MACHINE\SOFTWARE\...`
 * (confirmed live against this machine's registry, not assumed).
 *
 * This is what makes a dead Uninstall entry removable at all -- without
 * the key's own path there is nothing to hand the quarantine system, and
 * an orphaned entry would stay in Add/Remove Programs forever.
 *
 * Returns null for an unrecognized hive instead of guessing. The output
 * goes to `reg delete /f`, and a half-understood registry path is far
 * more dangerous than admitting we don't know this one. */
export function toPowerShellRegistryPath(psPath) {
  if (typeof psPath !== 'string') return null;
  const match = psPath.match(/Registry::(HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER)\\(.+)$/i);
  if (!match) return null;
  const hive = match[1].toUpperCase() === 'HKEY_LOCAL_MACHINE' ? 'HKLM:' : 'HKCU:';
  return `${hive}\\${match[2]}`;
}

/** Registry InstallDate is YYYYMMDD (a plain string) or absent. Returns an
 * ISO date string or null — never throws on a malformed value, since this
 * is third-party-controlled data. */
function parseRegistryDate(raw) {
  if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;
  const year = raw.slice(0, 4), month = raw.slice(4, 6), day = raw.slice(6, 8);
  return `${year}-${month}-${day}`;
}
