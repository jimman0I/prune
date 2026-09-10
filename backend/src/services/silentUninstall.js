import { readFileSync } from 'node:fs';
import { parseUninstallerPath } from './uninstallerPath.js';

/** Running a program's uninstaller without a person at the keyboard.
 *
 * This exists because batch uninstall was only batch in name. Every
 * non-MSI program stopped on its own wizard, so "uninstall these six
 * things" meant sitting through six dialogs -- which is the single thing
 * Bulk Crap Uninstaller does better than Prune did, and it does it by
 * knowing that different installer systems take different silent flags.
 *
 * The previous code appended /qn to MsiExec strings and left everything
 * else alone, with a comment warning that guessing a silent flag risks
 * passing one the installer does not understand. That warning was right
 * and is kept. What changes is that this no longer guesses: every branch
 * below is reached only on evidence, and anything unidentified still runs
 * exactly as registered.
 *
 * MEASURED FIRST, on a real machine with 345 installed programs, because
 * the distribution decides which branches are worth writing:
 *
 *   52  publish QuietUninstallString
 *   245 are MsiExec
 *   10  are Squirrel
 *   0   are Inno Setup uninstallers WITHOUT a quiet string
 *   38  are something else, mostly NSIS
 *
 * There is no Inno branch because of that zero. Every Inno uninstaller on
 * that machine already published its own quiet string, so a detector for
 * `unins000.exe` would have been code that never ran. If that turns out to
 * be a quirk of one machine, the branch is three lines -- but it should be
 * added when a machine is found that needs it, not on the assumption that
 * one exists.
 */

/** Silent flags per installer system, and why each is what it is. */
const SILENT = {
  /* Quiet, and explicitly no reboot. /norestart is the half the old code
   * was missing: an MSI that wants a restart will otherwise prompt for
   * one, or on some packages simply take it, in the middle of a batch the
   * user has walked away from. */
  msi: ['/qn', '/norestart'],
  // Case-sensitive in NSIS: /s is not /S.
  nsis: ['/S'],
  squirrel: ['-s']
};

/** Whether a flag is already on the command line.
 *
 * Word-bounded so that /S does not match inside a path, and case-sensitive
 * for NSIS specifically -- /s and /S are different flags there, and
 * treating them as the same would leave a wizard open while reporting the
 * command as already silent. */
function hasFlag(command, flag) {
  const pattern = new RegExp(`(^|\\s)${flag.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\s|$)`,
    flag === '/S' ? '' : 'i');
  return pattern.test(command);
}

/** Whether an MsiExec command already states a UI level.
 *
 * /q, /qn, /qb, /quiet and the rest are all the same decision expressed
 * differently, and one that whoever wrote the registry entry made on
 * purpose. Adding /qn on top would override a deliberate choice. */
function hasUiLevel(command) {
  return /(^|\s)\/(q[nbrf!+-]*|quiet|passive)(\s|$)/i.test(command);
}

/** The command to actually run, given everything known about the program.
 *
 * `quietUninstallString` is the vendor's own answer and beats anything
 * derived -- it is the string the installer author wrote down as correct.
 * Only when there isn't one does the installer kind decide a flag. */
export function silentUninstallCommand({ uninstallString, quietUninstallString, kind } = {}) {
  const vendor = typeof quietUninstallString === 'string' ? quietUninstallString.trim() : '';
  if (vendor) return vendor;

  // Nothing to make silent. Handing back exactly what came in keeps the
  // "no registered uninstall command" error where it belongs, in the
  // caller that knows how to report it.
  if (typeof uninstallString !== 'string' || !uninstallString.trim()) return uninstallString;

  if (kind === 'msi') {
    let command = uninstallString;
    if (!hasUiLevel(command)) command += ' /qn';
    if (!hasFlag(command, '/norestart')) command += ' /norestart';
    return command;
  }

  const flags = SILENT[kind];
  if (!flags) return uninstallString;

  return flags.reduce((command, flag) => (hasFlag(command, flag) ? command : `${command} ${flag}`), uninstallString);
}

/** What kind of installer produced this uninstaller.
 *
 * MsiExec and Squirrel are readable from the command line itself. NSIS is
 * not, and this is the part that earns the file read: NSIS uninstallers
 * are conventionally called uninstall.exe or uninst.exe, but so are plenty
 * of others. Measured on the reference machine, four of five uninstallers
 * with those names were NSIS and one -- SQLiteStudio's, six megabytes --
 * was not. A detector keyed on the name would have sent /S to it.
 *
 * So the name is not consulted at all. The file is opened and searched for
 * the Nullsoft signature that every NSIS-built binary carries.
 *
 * Synchronous, and deliberately: this runs once per program immediately
 * before spawning its uninstaller, on a file of a few hundred kilobytes,
 * in a route that is already about to block on a process that takes
 * seconds. Making it async would spread the change across the caller for
 * no measurable gain.
 */
export function detectInstallerKind(uninstallString) {
  if (typeof uninstallString !== 'string' || !uninstallString.trim()) return 'unknown';

  if (/(^|[\s"'\\/])msiexec(\.exe)?($|[\s"'])/i.test(uninstallString)) return 'msi';

  // Squirrel hands uninstallation to its own updater stub. The flag is
  // what identifies it -- Update.exe alone is also how Squirrel apps
  // check for updates.
  if (/--uninstall\b/i.test(uninstallString) && /update\.exe/i.test(uninstallString)) return 'squirrel';

  // Returns { executable, isMsi }, not a bare string. Passing the object
  // straight to readFileSync throws into the catch below and produces a
  // confident "unknown" for every NSIS uninstaller on the machine, which
  // is precisely the silent-wrong-answer this module exists to avoid.
  const { executable } = parseUninstallerPath(uninstallString);
  if (!executable) return 'unknown';

  try {
    /* Read the whole file rather than a header slice. The signature sits
     * in the data block, not at a fixed offset, and these binaries are
     * small -- the largest NSIS uninstaller on the reference machine was
     * 3.3MB. A partial read would produce a confident "unknown" for a file
     * that is NSIS, which is the wrong way for this to fail. */
    const contents = readFileSync(executable);
    if (contents.includes('NullsoftInst') || contents.includes('Nullsoft Install')) return 'nsis';
  } catch {
    /* Gone, locked, or not readable. Reachable in normal use: the list on
     * screen is a snapshot and an uninstaller can be missing by the time a
     * batch reaches it -- the same orphan the Applications tab flags. An
     * unknown kind runs the command unchanged, which is the safe default. */
    return 'unknown';
  }

  return 'unknown';
}

/** Both steps together, for a caller that just has a program. */
export function resolveSilentCommand({ uninstallString, quietUninstallString } = {}) {
  const vendor = typeof quietUninstallString === 'string' ? quietUninstallString.trim() : '';
  // Skip the file read entirely when the vendor already answered.
  if (vendor) return vendor;
  return silentUninstallCommand({ uninstallString, kind: detectInstallerKind(uninstallString) });
}
