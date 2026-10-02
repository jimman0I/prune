/** What a leftover scan must never offer for removal.
 *
 * The scan matches on names, and a name is a weak claim: a publisher called
 * "Microsoft" matches half of AppData, a vendor folder holds several of the
 * vendor's products, and a program called "Studio" matches a folder inside
 * somebody else's install. Everything in the review arrives with the person
 * one click from deleting it, so these rules sit between the matching and
 * the review -- and again, in leftoverRemoval.js, between the review and the
 * disk, because the removal route can be called with a list the scan never
 * produced.
 *
 * Pure functions over paths; nothing here touches the disk. */

function norm(path) {
  return String(path).replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function isAtOrUnder(path, parent) {
  const target = norm(path);
  const root = norm(parent);
  return target === root || target.startsWith(`${root}\\`);
}

function segmentsAfterDrive(path) {
  return norm(path).replace(/^[a-z]:/, '').split('\\').filter(Boolean);
}

/** Folders that belong to the operating system or to the runtime every
 * program shares, wherever they turn up in the tree. */
const SHARED_FOLDERS = new Set([
  'microsoft shared', 'reference assemblies', 'dotnet', 'microsoft.net', 'internet explorer',
  'systemapps', 'system32', 'syswow64', 'winsxs'
]);

/** Folders that, directly under a `Microsoft` folder, hold the operating
 * system's own data rather than a Microsoft product's. */
const MICROSOFT_OS_CHILDREN = new Set([
  'crypto', 'protect', 'vault', 'credentials', 'systemcertificates', 'network', 'event viewer',
  'internet explorer', 'clr_v4.0', 'clr_v4.0_32', 'spelling', 'device metadata', 'dpapi'
]);

/** Why this path belongs to Windows or to a Microsoft component, or null.
 *
 * Judged on the path's own folder names, so it holds wherever Windows
 * happens to be installed and whichever spelling of the path arrives. A
 * Microsoft PRODUCT is deliberately not refused -- "Microsoft Office",
 * "Microsoft VS Code" and the product folders under AppData\...\Microsoft
 * are exactly what an uninstall of that product leaves behind. What is
 * refused is the operating system, the shared runtimes, and the bare
 * `Microsoft` container that holds every Microsoft program's data. */
export function osComponentRefusal(path, { env = process.env } = {}) {
  if (typeof path !== 'string' || !/^[a-z]:[\\/]/i.test(path.trim())) {
    return 'Only a full path can be a leftover.';
  }
  const systemRoot = env?.SystemRoot || env?.windir;
  if (systemRoot && isAtOrUnder(path, systemRoot)) return 'That is Windows itself.';

  const parts = segmentsAfterDrive(path);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (/^windows(?: |$)/.test(part) && part !== 'windows kits') return 'That belongs to Windows.';
    if (part === 'windowsapps' || part === 'windowspowershell') return 'That belongs to Windows.';
    if (SHARED_FOLDERS.has(part)) return 'That is shared by many programs and by Windows.';
    if (part === 'microsoft') {
      const next = parts[i + 1];
      if (next === undefined) return 'That folder holds data for every Microsoft program on this machine.';
      if (/^windows(?: |$)/.test(next) && next !== 'windows kits') return 'That belongs to Windows.';
      if (MICROSOFT_OS_CHILDREN.has(next)) return 'That belongs to Windows.';
    }
  }
  return null;
}

/* ------------------------------------------------------------ footprints */

function programsRoots(env) {
  const systemDrive = env?.SystemDrive || 'C:';
  const local = env?.LOCALAPPDATA;
  const roots = [
    env?.ProgramFiles || `${systemDrive}\\Program Files`,
    env?.['ProgramFiles(x86)'] || `${systemDrive}\\Program Files (x86)`
  ];
  if (local) roots.push(`${local}\\Programs`, local);
  if (env?.APPDATA) roots.push(env.APPDATA);
  roots.push(env?.ProgramData || `${systemDrive}\\ProgramData`);
  // Longest first, so LOCALAPPDATA\Programs is tried before LOCALAPPDATA.
  return roots.sort((a, b) => b.length - a.length);
}

/** First folders under a programs root that are containers, not a program. */
const CONTAINER_FOLDERS = new Set([
  'microsoft', 'temp', 'package cache', 'packages', 'programs', 'common files', 'windowsapps',
  'installer', 'downloaded installations', 'crashdumps', 'd3dscache', 'history', 'inetcache'
]);

/** The folder that holds a program, as far as a command line it registered
 * can say. Takes an UninstallString or a DisplayIcon: both are "the path of
 * a file the program owns, with some decoration".
 *
 * Below a programs root (Program Files, AppData\Local\Programs, AppData, and
 * so on) the answer is the first folder under that root -- the program's
 * own -- and not the possibly deeper folder the file sits in. Anywhere else
 * it is the file's folder. Null when there is no path in the command, or
 * when the path is somewhere no program owns: Windows, a drive root, Temp,
 * the shared installer cache. Anchoring on those would offer the system,
 * or every program's installer, as one program's folder. */
export function anchorRootFromCommand(command, { env = process.env } = {}) {
  if (typeof command !== 'string' || !command.trim()) return null;
  const text = command.trim();

  let file;
  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1);
    file = end > 0 ? text.slice(1, end) : null;
  } else {
    const match = /^([a-z]:\\.*?\.(?:exe|ico|dll|msi|bat|cmd|com|lnk))(?=$|[\s,"])/i.exec(text);
    file = match ? match[1] : null;
  }
  if (!file) return null;
  file = file.replace(/,-?\d+$/, '').trim();
  if (!/^[a-z]:\\/i.test(file)) return null;

  const dir = file.replace(/[\\/][^\\/]*$/, '');
  if (!/^[a-z]:\\.+/i.test(dir)) return null; // a file in a drive root has no folder of its own

  const systemRoot = env?.SystemRoot || env?.windir || 'C:\\Windows';
  if (isAtOrUnder(dir, systemRoot)) return null;

  for (const root of programsRoots(env)) {
    if (!root || !isAtOrUnder(dir, root) || norm(dir) === norm(root)) continue;
    const first = dir.slice(root.length + 1).split('\\')[0];
    if (!first || CONTAINER_FOLDERS.has(first.toLowerCase()) || /^windows(?: |$)/i.test(first)) return null;
    return `${root}\\${first}`;
  }

  // Not under a root a program installs into: the folder of the file itself,
  // unless that is a Windows component by its own name.
  if (osComponentRefusal(dir, { env })) return null;
  return dir;
}

function cleanFolder(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/^"+|"+$/g, '').replace(/[\\/]+$/, '');
  return /^[a-z]:[\\/]/i.test(trimmed) ? trimmed : null;
}

/** Every folder one installed program says is its own: the InstallLocation it
 * registered and the folders its icon and uninstaller live in. */
export function footprintsOf(program, { env = process.env } = {}) {
  const found = [];
  const add = (dir) => {
    if (dir && !found.some((known) => norm(known) === norm(dir))) found.push(dir);
  };
  add(cleanFolder(program?.installLocation));
  add(anchorRootFromCommand(program?.displayIcon, { env }));
  add(anchorRootFromCommand(program?.uninstallString, { env }));
  return found;
}

function canonicalKey(key) {
  return String(key || '').toLowerCase().replace(/^hkey_local_machine/, 'hklm').replace(/^hkey_current_user/, 'hkcu').replace(/^(hklm|hkcu):/, '$1').replace(/[\\/]+/g, '\\');
}

/** The folders of every installed program EXCEPT the one being uninstalled,
 * as { dir, program } so a refusal can name the program it protects.
 * The program is left out by id or by its own registry key: it is still in
 * the list when a broken entry is being force-removed, and its own folder is
 * exactly what that scan is for. */
export function buildFootprints(programs, { selfId, selfRegistryKey, env = process.env } = {}) {
  const footprints = [];
  for (const program of otherPrograms(programs, { selfId, selfRegistryKey })) {
    for (const dir of footprintsOf(program, { env })) footprints.push({ dir, program: program.name || program.id || 'another program' });
  }
  return footprints;
}

/** Every installed program except the one being uninstalled, which is
 * recognised by id or by its own registry key. */
export function otherPrograms(programs, { selfId, selfRegistryKey } = {}) {
  const selfKey = selfRegistryKey ? canonicalKey(selfRegistryKey) : null;
  return (Array.isArray(programs) ? programs : []).filter((program) => {
    if (selfId && program.id === selfId) return false;
    if (selfKey && program.registryKey && canonicalKey(program.registryKey) === selfKey) return false;
    return true;
  });
}

/** Why this path would damage another installed program, or null.
 *
 * Refused: the program's own folder, and any folder that CONTAINS it (a
 * publisher match for "Vendor" finds C:\Program Files\Vendor, and removing
 * it removes every Vendor product). A folder strictly INSIDE another
 * program's is refused too, unless the caller has the program's own word
 * for it (`certain`) -- a name match inside somebody else's install is not
 * evidence of anything. Certain never excuses the first two. */
export function footprintRefusal(path, footprints, { certain = false } = {}) {
  for (const { dir, program } of footprints || []) {
    if (norm(path) === norm(dir) || isAtOrUnder(dir, path)) {
      return `That is where ${program} is installed.`;
    }
    if (!certain && isAtOrUnder(path, dir)) return `That is inside the folder ${program} is installed in.`;
  }
  return null;
}
