import { listInstalledPrograms } from './programs.js';
import { runPowerShellJson } from './powershell.js';
import { findMainExecutable } from './findMainExecutable.js';
import { getSteamApps, parseSteamAppId, steamRootFrom } from './steamApps.js';
import { iconSourceForProgram } from './iconSource.js';
import { normalizeFileVersion } from './versionText.js';
import { getGogApps } from './gogApps.js';
import { matchLauncherApp } from './launcherMatch.js';

/** Files that carry a version resource. A DisplayIcon often points at a
 * .ico, which has no version in it. */
const HAS_VERSION_INFO = /\.(exe|dll)$/i;

/** An installer or uninstaller, which carries its own version and not the
 * application's.
 *
 * This is where the version ladder has to part company with the icon
 * ladder even though they walk the same files. An uninstaller is a fine
 * icon source -- vendors usually give it the application's own icon on
 * purpose -- but its version belongs to the uninstaller.
 *
 * Found by checking the sources against the real list (2026-09-03).
 * Reading them handed Ubisoft's anti-cheat its uninstaller's 5.0.2.0,
 * gave a Windows shim database sdbinst.exe's 10.0.26100.8457 (which is
 * Windows' own build number), pointed a Canon printer driver at
 * DELDRV64.exe, and reported Roblox as 1.6.3.172 -- the bootstrapper --
 * while the player beside it correctly reports 0.734.0.7340917.
 *
 * `inst` rather than `install` so that oalinst.exe and sdbinst.exe are
 * caught too. It costs an application genuinely named like one of these
 * ("Instagram") its DisplayIcon rung, but not its version: the install
 * folder is searched next, and that search matches on the program's name,
 * so the real binary still wins. A blank is the worst case here, and a
 * blank is honest. */
const INSTALLER_BINARY = /inst|setup|deldrv/i;

/** Whether a path is the application itself rather than the tooling that
 * put it there or takes it away. The whole path is checked, not just the
 * file: Canon's DisplayIcon names DELDRV64.exe inside a directory called
 * "CanonIJ Uninstaller Information". */
function isApplicationBinary(path) {
  return HAS_VERSION_INFO.test(path) && !INSTALLER_BINARY.test(path);
}

/** Reads the version resource off a batch of files.
 *
 * One PowerShell call for every path rather than one per program: the
 * lookup runs for a dozen or so entries, and a dozen process launches
 * would cost more than the work.
 *
 * Both fields are returned and the caller decides. They usually agree,
 * but where they differ one is often empty -- Riot Client reports
 * FileVersion 138.0.0 and ProductVersion 138.0.0.0 -- so having both
 * beats picking blind. */
async function readVersionResources(paths) {
  if (paths.length === 0) return [];

  const list = paths.map((path) => `'${path.replace(/'/g, "''")}'`).join(',\n  ');
  const script = `
$paths = @(
  ${list}
)
$found = foreach ($p in $paths) {
  $item = Get-Item -LiteralPath $p -ErrorAction SilentlyContinue
  if ($item) {
    [PSCustomObject]@{
      path = $p
      fileVersion = [string]$item.VersionInfo.FileVersion
      productVersion = [string]$item.VersionInfo.ProductVersion
    }
  }
}
ConvertTo-Json -InputObject @($found) -Compress -Depth 3
`;

  try {
    const raw = await runPowerShellJson(script);
    if (!raw) return [];
    // ConvertTo-Json collapses a single-element array to a bare object.
    return Array.isArray(raw) ? raw : [raw];
  } catch {
    return [];
  }
}

/** The file to read a version out of for one program, or null.
 *
 * Two rungs where the icons have three: the vendor's own DisplayIcon when
 * it names the application, then the real binary inside the install
 * folder. The icons' last resort -- the uninstaller -- is deliberately
 * absent, because an uninstaller reports its own version and the whole
 * point of this lookup is the application's.
 *
 * A program left with neither keeps its blank. That is the honest answer:
 * we found no application binary to ask. */
async function versionSourceFor(program, folder) {
  const declared = iconSourceForProgram(program);
  if (declared && isApplicationBinary(declared.path)) return declared.path;

  if (folder) {
    const executable = await findMainExecutable(folder, program.name);
    if (executable && isApplicationBinary(executable)) return executable;
  }

  return null;
}

/** Versions for the programs whose registry entry never recorded one, as
 * { programId: version }.
 *
 * 15 of the 130 entries on this machine have no DisplayVersion. It's an
 * optional value, and the ones that skip it are overwhelmingly games and
 * clients a launcher installed -- Steam, Ubisoft and Riot titles -- which
 * is exactly the set someone scanning this list wants to identify.
 *
 * Every one of those is a real program with a real binary, and that
 * binary carries the version in its resource table. That's where this
 * looks, which is also where Windows' own Properties dialog looks.
 *
 * Its own endpoint, like the icons and the sizes, and for the same
 * reason: finding the binaries means walking install folders and the
 * program list must not wait on it. Anything that can't be read, or that
 * reads back as a placeholder or a build hash, is simply absent and the
 * row keeps its blank. */
export async function getProgramVersions(programs) {
  // Held as the in-flight promise rather than the result, so the start-up
  // warm and the request that arrives while it is still running share one
  // pass instead of both doing the work. An explicit list is a caller
  // asking about specific programs, so it always runs fresh.
  if (!programs) {
    if (!cached) {
      cached = resolveVersions(null).catch((error) => {
        cached = null; // a failed lookup shouldn't be remembered as empty
        throw error;
      });
    }
    return cached;
  }
  return resolveVersions(programs);
}

let cached = null;

/** Testing seam -- the cache is process-wide. */
export function clearVersionCache() {
  cached = null;
}

async function resolveVersions(programs) {
  const list = programs ?? await listInstalledPrograms();
  const wanted = list.filter((program) => !program.version);
  if (wanted.length === 0) return {};

  // Steam titles record no InstallLocation at all -- their uninstall
  // command is a steam:// URL -- so the folder has to come from Steam's
  // own manifest, the same source their sizes come from.
  let steamApps = {};
  try {
    steamApps = await getSteamApps(steamRootFrom(list));
  } catch {
    // No Steam, or an unreadable library. Everything else still resolves.
  }

  // GOG records a version per game in its own registry keys, and it is
  // the only launcher here that does. A launcher's own record beats
  // reading a binary: it is what the launcher shows and what the user
  // will compare against. Absent GOG, this is an empty list.
  const gogApps = await getGogApps().catch(() => []);
  const versions = {};

  const sources = new Map();
  for (const program of wanted) {
    const fromLauncher = matchLauncherApp(program, gogApps)?.version;
    const declared = fromLauncher ? normalizeFileVersion(fromLauncher) : null;
    if (declared) {
      versions[program.id] = declared;
      continue;
    }

    const appId = parseSteamAppId(program.uninstallString);
    const folder = program.installLocation || (appId ? steamApps[appId]?.path : null) || null;
    const path = await versionSourceFor(program, folder);
    if (path) sources.set(program.id, path);
  }

  const rows = await readVersionResources([...new Set(sources.values())]);

  const byPath = new Map();
  for (const row of rows) {
    if (!row?.path) continue;
    const version = normalizeFileVersion(row.fileVersion) || normalizeFileVersion(row.productVersion);
    if (version) byPath.set(row.path, version);
  }

  for (const [id, path] of sources) {
    const version = byPath.get(path);
    if (version) versions[id] = version;
  }
  return versions;
}
