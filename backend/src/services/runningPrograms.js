import { runPowerShellJson } from './powershell.js';
import { listInstalledPrograms } from './programs.js';
import { getStoreApps } from './storeApps.js';
import { getSteamApps, parseSteamAppId, steamRootFrom } from './steamApps.js';
import { sizeSourceFor } from './installSize.js';

/** Which installed programs are running right now.
 *
 * Revo warns before uninstalling something that is open, and the warning
 * earns its place: an uninstaller for a running program either fails, or
 * half-succeeds and leaves files behind that the next launch recreates.
 * Prune said nothing at all.
 *
 * Matched by path rather than by name. A process called "Update.exe" or
 * "Launcher.exe" says nothing about which program it belongs to, but the
 * folder it runs from says everything. */
const PROCESS_QUERY = `
$rows = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Path } |
  ForEach-Object {
    [PSCustomObject]@{ name = [string]$_.ProcessName; path = [string]$_.Path }
  }
ConvertTo-Json -InputObject @($rows) -Compress -Depth 3
`;

/** One separator style, lowercase, no trailing slash -- the same
 * normalization the size and launcher matching already use, and for the
 * same reason: the registry mixes the two styles freely. */
function normalize(value) {
  return String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

/** Whether `file` sits inside `folder`.
 *
 * The trailing separator matters. Without it "C:\Program Files\App2"
 * counts as inside "C:\Program Files\App", and one program's processes
 * get attributed to another. */
function isInside(file, folder) {
  if (!folder) return false;
  return file.startsWith(`${folder}\\`);
}

/** Maps running processes onto the programs that own them.
 *
 * The LONGEST matching folder wins, which is the whole trick. Warframe's
 * launcher runs from Steam\steamapps\common\Warframe, which is inside
 * Steam's own folder too -- shortest-match would report every Steam game
 * as "Steam is running", and first-match would depend on list order.
 *
 * Returns { programId: { count, names } }. Names are deduplicated because
 * a browser is thirty processes and "brave ×30" is noise where "brave"
 * is the fact. */
export function matchRunningPrograms(processes, owners) {
  const folders = (owners || [])
    .filter((owner) => owner && owner.folder)
    .map((owner) => ({ id: owner.id, folder: normalize(owner.folder) }))
    .filter((owner) => owner.folder)
    // Longest first, so the first match is the most specific one.
    .sort((a, b) => b.folder.length - a.folder.length);

  const running = {};
  for (const process of processes || []) {
    const path = normalize(process?.path);
    if (!path) continue;

    const owner = folders.find((candidate) => isInside(path, candidate.folder));
    if (!owner) continue;

    if (!running[owner.id]) running[owner.id] = { count: 0, names: [] };
    running[owner.id].count += 1;
    const name = String(process.name || '').trim();
    if (name && !running[owner.id].names.includes(name)) running[owner.id].names.push(name);
  }
  return running;
}

/** Every folder that identifies a program, for the matcher above.
 *
 * InstallLocation where there is one -- which covers Store apps too,
 * since they record their WindowsApps folder -- plus Steam's own manifest
 * path for Steam games, which record no InstallLocation at all.
 *
 * Then the uninstaller's folder, but only where exactly ONE program falls
 * back to it. Steam is the case that makes this worth having: its entry
 * records no InstallLocation, so without the fallback the single most
 * likely program to be running while someone tries to remove it was the
 * one program that could never be detected. The same shared-folder rule
 * the sizing already uses keeps it honest -- a folder several entries
 * point at is a launcher's directory, not any one program's. */
export function ownerFolders(programs, storeApps, steamApps) {
  const owners = [];
  const fallbackUsers = new Map();

  for (const program of programs || []) {
    if (program.installLocation) continue;
    if (parseSteamAppId(program.uninstallString)) continue;
    const folder = sizeSourceFor(program);
    if (folder) fallbackUsers.set(normalize(folder), (fallbackUsers.get(normalize(folder)) || 0) + 1);
  }

  for (const program of programs || []) {
    if (program.installLocation) {
      owners.push({ id: program.id, folder: program.installLocation });
      continue;
    }

    const appId = parseSteamAppId(program.uninstallString);
    const steam = appId ? steamApps?.[appId] : null;
    if (steam?.path) {
      owners.push({ id: program.id, folder: steam.path });
      continue;
    }

    const folder = sizeSourceFor(program);
    if (folder && fallbackUsers.get(normalize(folder)) === 1) {
      owners.push({ id: program.id, folder });
    }
  }

  for (const app of storeApps || []) {
    if (app.installLocation) owners.push({ id: app.id, folder: app.installLocation });
  }

  return owners;
}

/** What is running right now, as { programId: { count, names } }.
 *
 * Never cached. Everything else the program list fetches is stable while
 * the app is open; this is the one thing that is true only at the moment
 * it is asked. */
export async function getRunningPrograms(programs) {
  let raw;
  try {
    raw = await runPowerShellJson(PROCESS_QUERY);
  } catch {
    return {};
  }
  if (!raw) return {};
  const processes = Array.isArray(raw) ? raw : [raw];

  const list = programs ?? await listInstalledPrograms();
  const [storeApps, steamApps] = await Promise.all([
    getStoreApps().catch(() => []),
    getSteamApps(steamRootFrom(list)).catch(() => ({}))
  ]);

  return matchRunningPrograms(processes, ownerFolders(list, storeApps, steamApps));
}
