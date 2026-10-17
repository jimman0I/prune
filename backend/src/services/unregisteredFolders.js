import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { measureDirectory } from './leftoverWalk.js';
import { osComponentRefusal, footprintRefusal, anchorRootFromCommand } from './leftoverProtection.js';
import { permanentDeletionRefusal } from './leftoverRemoval.js';
import { productTokens } from './leftoverMatch.js';

/** Programs that live in Program Files with no uninstaller: copied in by
 * hand, left behind by an uninstaller that removed its registry entry and
 * not its folder, or installed by something that never registered at all.
 * Windows' own list cannot see them, so neither could Prune.
 *
 * Shown as "Not registered" programs rather than as junk, on purpose: a
 * portable tool unzipped into Program Files on purpose looks exactly the
 * same. Removing one goes through Forced Uninstall, which scans for the
 * rest of it and has every item reviewed before anything is deleted.
 *
 * Deliberately cautious about what counts, because a false entry here is
 * a working program offered for removal. A first-level folder is skipped
 * when any installed program lives in it (footprints, which already widen
 * to the whole vendor folder), when anything running, scheduled, starting
 * at sign-in or registered as a service or driver points into it (drivers
 * and their helper services often install to Program Files with no entry
 * in Add/Remove at all), when it is Windows' or a shared container, and
 * when it holds no executable at all. */

const SKIP_NAMES = new Set([
  'common files', 'windowsapps', 'modifiablewindowsapps', 'uninstall information', 'internet explorer',
  'microsoft', 'dotnet', 'package cache', 'reference assemblies', 'msbuild', 'windows kits', 'microsoft sdks',
  'iis', 'iis express', 'packagemanagement', 'windowspowershell', 'microsoft.net', 'microsoft update health tools',
  'microsoft office', 'microsoft visual studio', 'microsoft analysis services', 'microsoft sql server',
  // Driver Install Frameworks: what driver installers use to uninstall a driver later.
  'difx'
]);

const norm = (path) => String(path).replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();

/** The roots programs install into, for this machine. */
export function unregisteredRoots(env = process.env) {
  return [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Programs') : null]
    .filter(Boolean)
    .filter((root, i, all) => all.findIndex((other) => norm(other) === norm(root)) === i);
}

/** Lower-cased top folders that something running, scheduled, starting or
 * registered as a service or driver points into. */
export function inUseFolders(commands, env = process.env) {
  const set = new Set();
  for (const command of commands || []) {
    const top = anchorRootFromCommand(typeof command === 'string' ? command : '', { env });
    if (top) set.add(norm(top));
  }
  return set;
}

/** The first-level folder `path` is in, under one of the programs roots, or null. */
function topFolderOf(path, env) {
  const target = norm(path);
  for (const root of unregisteredRoots(env).map(norm)) {
    if (!target.startsWith(`${root}\\`)) continue;
    const first = target.slice(root.length + 1).split('\\')[0];
    return first ? `${root}\\${first}` : null;
  }
  return null;
}

/** The top folders of every folder Windows Installer tracks. An MSI install
 * usually registers no folder in Add/Remove at all -- its uninstall string is
 * just "MsiExec /X{GUID}" -- so without these, Python, GitHub CLI and every
 * other MSI-installed program would look unregistered. Found live: Python's
 * 1 GB folder was offered. */
export function msiTopFolders(folders, env = process.env) {
  const set = new Set();
  for (const folder of folders || []) {
    const top = typeof folder === 'string' ? topFolderOf(folder, env) : null;
    if (top) set.add(top);
  }
  return set;
}

const letters = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The installed program this folder's name says it belongs to, or null.
 *
 * A shared leading run of four or more letters ("MuMuVMMVbox" beside
 * "MuMuPlayer", "blitz-delta-updater" beside "Blitz"), or a distinctive word
 * of the program's name or publisher in the folder's name. Generous on
 * purpose: missing an orphan costs a little disk, offering a working
 * program's helper for removal could cost the program. */
function relatedProgram(folderName, programs) {
  const folder = letters(folderName);
  const folderWords = new Set(productTokens(folderName));
  for (const program of programs || []) {
    const name = letters(program?.name);
    let shared = 0;
    while (shared < folder.length && shared < name.length && folder[shared] === name[shared]) shared += 1;
    if (shared >= 4) return program.name;
    if (productTokens(program?.name, program?.publisher).some((word) => folderWords.has(word))) return program.name;
  }
  return null;
}

/** Why this first-level folder is not offered, or null when it is. */
export function unregisteredReason(dir, { footprints, inUse, msiFolders, programs, env = process.env }) {
  const folderName = String(dir).replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  if (SKIP_NAMES.has(folderName.toLowerCase())) return 'That folder is shared by many programs or by Windows.';
  const refusal = osComponentRefusal(dir, { env }) || permanentDeletionRefusal(dir);
  if (refusal) return refusal;
  const footprint = footprintRefusal(dir, footprints);
  if (footprint) return footprint;
  if (inUse?.has(norm(dir))) return 'Something running, scheduled or registered as a service is in use from that folder.';
  if (msiFolders?.has(norm(dir))) return 'Windows Installer tracks that folder as part of an installed program.';
  const related = relatedProgram(folderName, programs);
  if (related) return `That folder looks like part of ${related}.`;
  return null;
}

const EXECUTABLE = /\.(exe|com|bat|cmd)$/i;

/** Whether a folder holds an executable anywhere, looking at no more than
 * `budget` entries -- a folder of data files is not a program. */
async function holdsExecutable(dir, budget = 4000) {
  const queue = [dir];
  let seen = 0;
  while (queue.length && seen < budget) {
    let entries;
    try { entries = await readdir(queue.shift(), { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      seen += 1;
      if (entry.isFile() && EXECUTABLE.test(entry.name)) return true;
      if (entry.isDirectory() && !entry.isSymbolicLink()) queue.push(join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  return false;
}

/** Every unclaimed first-level folder that holds a program, as program rows. */
export async function scanUnregisteredFolders({ roots = unregisteredRoots(), footprints, inUse, msiFolders, programs, env = process.env }) {
  const rows = [];
  for (const root of roots) {
    let entries;
    try { entries = await readdir(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const dir = join(root, entry.name);
      if (unregisteredReason(dir, { footprints, inUse, msiFolders, programs, env })) continue;
      if (!(await holdsExecutable(dir))) continue;
      rows.push({
        // Prefixed like the Store and Chocolatey rows: never a registry key name.
        id: `unregistered:${dir}`,
        name: entry.name,
        publisher: '',
        version: '',
        installLocation: dir,
        sizeBytes: await measureDirectory(dir),
        source: 'unregistered'
      });
    }
  }
  return rows;
}

/* ------------------------------------------------------------ live inputs */

/** What the machine is using, in one PowerShell call: every executable path
 * of a service or driver (its registered image path), a running process, a
 * scheduled-task action or a Run value; and every folder Windows Installer
 * tracks (Installer\Folders, one value per folder). */
export const MACHINE_USE_QUERY = `
$ErrorActionPreference = 'SilentlyContinue'
$commands = New-Object System.Collections.ArrayList
foreach ($s in Get-CimInstance Win32_Service) { [void]$commands.Add([string]$s.PathName) }
foreach ($d in Get-CimInstance Win32_SystemDriver) { [void]$commands.Add([string]$d.PathName) }
foreach ($p in Get-Process) { if ($p.Path) { [void]$commands.Add([string]$p.Path) } }
foreach ($t in Get-ScheduledTask) { foreach ($a in $t.Actions) { if ($a.Execute) { [void]$commands.Add([Environment]::ExpandEnvironmentVariables([string]$a.Execute)) } } }
foreach ($k in 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run') {
  $key = Get-Item -Path $k
  if ($key) { foreach ($n in $key.GetValueNames()) { [void]$commands.Add([Environment]::ExpandEnvironmentVariables([string]$key.GetValue($n))) } }
}
$folders = @()
$msi = Get-Item -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Installer\\Folders'
if ($msi) { $folders = @($msi.GetValueNames()) }
ConvertTo-Json -Compress -Depth 3 -InputObject ([PSCustomObject]@{ commands = @($commands); folders = $folders })
`;

/** { commands, folders }, or null when the machine could not be read. */
export async function readMachineUse({ run } = {}) {
  const runner = run ?? (await import('./powershell.js')).runPowerShellJson;
  try {
    const data = await runner(MACHINE_USE_QUERY, { timeoutMs: 60000 });
    if (!data || !Array.isArray(data.commands)) return null;
    return { commands: data.commands, folders: Array.isArray(data.folders) ? data.folders : [] };
  } catch {
    return null;
  }
}

/** The "Not registered" rows for the program list. Returns [] rather than
 * guessing when what is in use could not be read: without that, a driver's
 * folder would be offered for removal. */
export async function listUnregisteredPrograms(installedPrograms, { env = process.env } = {}) {
  const { buildFootprints } = await import('./leftoverProtection.js');
  const use = await readMachineUse();
  if (use === null) return [];
  return scanUnregisteredFolders({
    footprints: buildFootprints(installedPrograms, { env }),
    inUse: inUseFolders(use.commands, env),
    msiFolders: msiTopFolders(use.folders, env),
    programs: installedPrograms,
    env
  });
}
