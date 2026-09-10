/** The order a batch uninstall runs in.
 *
 * A batch used to run in selection order, whatever that happened to be.
 * That breaks as soon as a batch contains a launcher and something that
 * uninstalls THROUGH it: Marvel Rivals' uninstall command is steam.exe
 * with a steam:// URL, so if Steam goes first, Marvel Rivals is left with
 * an uninstaller that no longer exists. It fails, and becomes exactly the
 * orphan the Broken filter exists to find.
 *
 * Measured on the dev machine before any of this was written -- all 345
 * uninstall entries:
 *
 *   8 delegate to another program's executable
 *     4 Steam games           steam.exe steam://uninstall/...
 *     Rainbow Six Siege       upc.exe uplay://uninstall/...
 *     AlecaFrame              OWUninstaller.exe --uninstall-app=...
 *     Instagram, Streamlit    brave.exe --uninstall-app-id=...
 *   8 host relationships, 0 cycles, no dependent with two hosts
 *
 * THE DIRECTION IS THE HARD PART, and two drafts got it wrong. Comparing
 * folders found the Steam games and also concluded that Steam depended on
 * Marvel Rivals, since both uninstallers live in Steam's folder. Deriving
 * a program's folder from its uninstaller produced Brave <-> Instagram and
 * Overwolf <-> AlecaFrame, because those dependents record no folder of
 * their own and so inherited the host's. The asymmetry that holds is in
 * the ARGUMENTS: a dependent names one specific app to someone else's
 * executable, and a host's own uninstaller does not. A program without
 * such a marker is never treated as a dependent -- so the worst this can
 * do when it misses a real relationship is fall back to selection order,
 * which is what happened before it existed.
 *
 * This is frontend code rather than backend because the batch is: the
 * modal owns the queue and runs it one program at a time.
 */

/** Paths as they can be compared.
 *
 * Lower-cased, because Windows paths are case-insensitive and the registry
 * contains both "C:\Program Files" and "C:\PROGRAM FILES". Repeated
 * separators collapsed, because Overwolf's own entry names its uninstaller
 * "Overwolf\\OWUninstaller.exe" while AlecaFrame names the same file with
 * one backslash -- and compared raw, one file on disk is two different
 * strings. Trailing separators dropped, so a folder can be tested as a
 * prefix by adding exactly one. */
function normalizePath(path) {
  if (typeof path !== 'string' || !path.trim()) return '';
  return path.trim().replace(/[\\/]+/g, '\\').toLowerCase().replace(/\\+$/, '');
}

/** The executable an uninstall command runs, normalised.
 *
 * Ported from backend/src/services/uninstallerPath.js, and its test cases
 * are mirrored in the test beside this file. There is no package the two
 * halves of the app share, and ten lines of parsing are cheaper to keep in
 * step than to build one for. The one addition: an unquoted path is also
 * cut at a URL-scheme argument, since "launch.exe steam://..." has no
 * switch to cut at. */
export function uninstallerExecutable(uninstallString) {
  if (typeof uninstallString !== 'string' || !uninstallString.trim()) return null;
  const trimmed = uninstallString.trim();

  let executable;
  if (trimmed.startsWith('"')) {
    const closing = trimmed.indexOf('"', 1);
    executable = closing === -1 ? trimmed.slice(1) : trimmed.slice(1, closing);
  } else {
    const cutAt = trimmed.search(/\s[/-]|\s[a-z][a-z0-9+.-]*:\/\//i);
    executable = cutAt === -1 ? trimmed : trimmed.slice(0, cutAt);
  }

  return normalizePath(executable) || null;
}

/** A URL scheme, or an argument that selects one app out of several. The
 * four markers every delegating entry on the dev machine uses. */
const DELEGATION = /[a-z][a-z0-9+.-]*:\/\/|--uninstall-app(?:-id)?=/i;

/** Whether this command removes a program by asking ANOTHER program to.
 *
 * Deliberately not "has arguments": Brave's own uninstaller takes
 * --uninstall and --system-level, and a rule that counted flags would make
 * Brave depend on its own web apps. */
export function delegates(uninstallString) {
  return typeof uninstallString === 'string' && DELEGATION.test(uninstallString);
}

/** The folder a program owns, or null when that is not knowable.
 *
 * InstallLocation when it records one. Otherwise the folder of its own
 * uninstaller -- which is how Steam, which records no InstallLocation at
 * all, is found -- but only for a program that does not delegate. A
 * delegating program's uninstaller is someone else's executable, and
 * taking its folder hands it the host's: that is precisely the bug that
 * made Steam look like it depended on Marvel Rivals.
 *
 * Nothing shorter than a real folder is trusted. An InstallLocation of
 * "C:\" would otherwise make every program on the drive its dependent. */
export function ownFolder(program) {
  const recorded = normalizePath(program?.installLocation);
  if (recorded.length > 3) return recorded;

  if (delegates(program?.uninstallString)) return null;

  const executable = uninstallerExecutable(program?.uninstallString);
  // MsiExec lives in System32 and belongs to Windows, not the product.
  if (!executable || /(^|\\)msiexec(\.exe)?$/.test(executable)) return null;

  const cut = executable.lastIndexOf('\\');
  return cut > 2 ? executable.slice(0, cut) : null;
}

/** The program in `candidates` this one uninstalls through, or null.
 *
 * The most specific match wins when more than one folder contains the
 * executable. The dev machine has no such case, but nested installs exist,
 * and the innermost folder is the one that actually owns the file. */
function hostOf(program, candidates) {
  if (!delegates(program?.uninstallString)) return null;
  const executable = uninstallerExecutable(program.uninstallString);
  if (!executable) return null;

  let best = null;
  let bestLength = -1;
  for (const candidate of candidates) {
    if (candidate === program) continue;
    const folder = ownFolder(candidate);
    if (folder && executable.startsWith(`${folder}\\`) && folder.length > bestLength) {
      best = candidate;
      bestLength = folder.length;
    }
  }
  return best;
}

/** The batch, ordered so nothing is removed before what it depends on.
 *
 * Returns `ordered` -- every program exactly once -- and `runsBefore`,
 * `{ dependentId: hostName }`, so the confirm list can say why a program
 * moved. A list that comes back in a different order from the one ticked
 * looks like a bug unless it says why.
 *
 * A stable topological sort: at every step it takes the EARLIEST-selected
 * program that is ready, so programs with no relationship keep exactly the
 * places they were given, and only a host waiting on its dependents moves.
 *
 * The real data has no cycles and the rule is built so that it should not
 * produce one. This still refuses to hang or drop a program if it ever
 * meets one, because it decides the order of destructive operations: any
 * programs left in a cycle are appended in selection order, which is what
 * the batch would have done without any of this. */
export function orderBatch(programs) {
  const list = Array.isArray(programs) ? programs.filter(Boolean) : [];
  if (list.length === 0) return { ordered: [], runsBefore: {} };

  const hostFor = new Map();
  const waitingOn = new Map(list.map((program) => [program, 0]));
  for (const program of list) {
    const host = hostOf(program, list);
    if (host) {
      hostFor.set(program, host);
      waitingOn.set(host, waitingOn.get(host) + 1);
    }
  }

  const ordered = [];
  const placed = new Set();
  while (ordered.length < list.length) {
    const next = list.find((program) => !placed.has(program) && waitingOn.get(program) === 0);
    if (!next) {
      for (const program of list) {
        if (!placed.has(program)) { ordered.push(program); placed.add(program); }
      }
      break;
    }
    ordered.push(next);
    placed.add(next);
    const host = hostFor.get(next);
    if (host) waitingOn.set(host, waitingOn.get(host) - 1);
  }

  /* Only reasons the final order actually honours. After a cycle fallback
   * a dependent can end up after its host, and telling the user "runs
   * before Steam" about a program that does not would be worse than
   * saying nothing. */
  const position = new Map(ordered.map((program, index) => [program, index]));
  const runsBefore = {};
  for (const [dependent, host] of hostFor) {
    if (position.get(dependent) < position.get(host)) runsBefore[dependent.id] = host.name;
  }

  return { ordered, runsBefore };
}
