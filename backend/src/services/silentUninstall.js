import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
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
 * There was no Inno branch because of that zero: every Inno uninstaller on
 * that machine already published its own quiet string. The note here said
 * to add one when a machine was found that needed it, and one was -- see
 * kindFromContents below, which also covers WiX Burn, 7-Zip and WinRAR.
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
  squirrel: ['-s'],
  /* Inno Setup's own uninstaller switches (jrsoftware.org, "Uninstaller
   * Command Line Parameters"). /VERYSILENT hides the progress window too,
   * and on its own reboots WITHOUT ASKING when a restart is needed -- so
   * /NORESTART is not optional here. /SUPPRESSMSGBOXES gives the default
   * answer to the vendor's own message boxes; shared files no longer in use
   * are removed, which is what the visible wizard does too. */
  inno: ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'],
  // WiX Burn bundles: the standard bundle switches, in the form the
  // Package Cache entries' own /uninstall already uses.
  burn: ['/quiet', '/norestart'],
  // 7-Zip's and WinRAR's own uninstallers. Uppercase, as both document it.
  '7zip': ['/S'],
  winrar: ['/S']
};

/** Whether a Burn bundle's command already says how quiet to be: /quiet,
 * /passive, /silent, /q or /s, with either prefix. The same respect for a
 * deliberate choice as hasUiLevel below. */
function hasBurnUiLevel(command) {
  return /(^|\s)[/-](q|quiet|passive|s|silent)(\s|$)/i.test(command);
}

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

/** Real bug, found investigating a report that a program's own uninstaller
 * "never appeared" and the program stayed installed: its UninstallString
 * was `MsiExec.exe /I{GUID}` -- /I, not /X. /I is msiexec's INSTALL verb;
 * against an already-installed product code it reruns the install
 * sequence (a repair, functionally a no-op) rather than removing anything.
 * Clicking it in Control Panel shows the modify/repair/remove dialog where
 * a person picks Remove -- but making the command silent (below) skips
 * straight past that dialog and silently repairs the program instead of
 * uninstalling it. No window, no error, nothing removed: exactly what was
 * reported.
 *
 * This is a known authoring mistake (some WiX-era and vendor-bundled MSI
 * packages publish the Modify path's verb into the Uninstall registry
 * value), not something specific to one program -- any MsiExec entry can
 * have it. Swapping the verb before adding quiet flags is what makes the
 * silent command actually uninstall, matching what a person would get by
 * running it visibly and clicking Remove. `{GUID}` is matched loosely
 * (anything inside the braces) rather than as a strict hex pattern,
 * because msiexec itself does not validate the product code's shape
 * before failing on it -- a tighter regex would just mean dead code for
 * the lookalike-but-wrong `{GUID}` that would still break kept silent. */
function useUninstallVerb(command) {
  return command.replace(/(^|\s)\/I(\{[^}]*\})/i, '$1/X$2');
}

/** The command to actually run, given everything known about the program.
 *
 * `quietUninstallString` is the vendor's own answer and beats anything
 * derived -- it is the string the installer author wrote down as correct.
 * Only when there isn't one does the installer kind decide a flag. */
export function silentUninstallCommand({ uninstallString, quietUninstallString, kind, running } = {}) {
  const vendor = typeof quietUninstallString === 'string' ? quietUninstallString.trim() : '';
  if (vendor) return vendor;

  // Nothing to make silent. Handing back exactly what came in keeps the
  // "no registered uninstall command" error where it belongs, in the
  // caller that knows how to report it.
  if (typeof uninstallString !== 'string' || !uninstallString.trim()) return uninstallString;

  if (kind === 'msi') {
    let command = useUninstallVerb(uninstallString);
    if (!hasUiLevel(command)) command += ' /qn';
    if (!hasFlag(command, '/norestart')) command += ' /norestart';
    return command;
  }

  if (kind === 'chromium') {
    /* --force-uninstall is the only flag here that can do harm on its own.
     * Chromium's uninstall.cc: with it, "we are going to do silent
     * uninstall. Try to close all running Chrome instances." The dialog it
     * skips is the one that asks you to close the browser first -- so on
     * a running browser this flag kills every tab without asking.
     *
     * Added only on an EXPLICIT false. `undefined` and `null` both mean
     * nobody could say whether it is running, and the cost of the two
     * mistakes is not symmetrical: wrong one way shows a dialog that did
     * not need showing, wrong the other kills a browser mid-session.
     *
     * Browsing data is never touched. Chromium deletes the profile only on
     * --delete-profile or the dialog's own checkbox, and this adds neither. */
    if (running !== false) return uninstallString;
    return hasFlag(uninstallString, '--force-uninstall')
      ? uninstallString
      : `${uninstallString} --force-uninstall`;
  }

  const flags = SILENT[kind];
  if (!flags) return uninstallString;
  if (kind === 'burn' && hasBurnUiLevel(uninstallString)) {
    return hasFlag(uninstallString, '/norestart') || hasFlag(uninstallString, '-norestart')
      ? uninstallString
      : `${uninstallString} /norestart`;
  }

  return flags.reduce((command, flag) => (hasFlag(command, flag) ? command : `${command} ${flag}`), uninstallString);
}

/** The Application folder of a Chromium-based browser, read from its
 * uninstall command's shape, or null.
 *
 * Every Chromium-style entry on the dev machine has the same structure --
 * <Application>\<version>\Installer\setup.exe --uninstall -- and the
 * browser's own processes run from <Application>, two levels above the
 * uninstaller. That is the folder a "is it running" check has to look in:
 * the uninstaller's own folder is the one place the browser never runs
 * from, so checking there would report a running browser as idle.
 *
 * Shape only, and cheap -- the route uses it to decide whether a running
 * check is worth paying for at all. detectInstallerKind adds the evidence.
 *
 * Two exclusions, both explicit because both binaries DO carry the switch:
 *   --msedgewebview  the WebView2 runtime. Shared: when measured, six
 *                    WebView2 processes were running, hosted by
 *                    SearchHost.exe -- Windows Search itself.
 *   --msedge         Microsoft Edge, the system browser.
 * Both keep running exactly as registered, with Microsoft's own dialog.
 *
 * `--uninstall` is matched as a whole flag so a Brave web app's
 * --uninstall-app-id= is not mistaken for the browser's own uninstaller. */
export function chromiumApplicationFolder(uninstallString) {
  if (typeof uninstallString !== 'string') return null;
  if (!/(^|\s)--uninstall(\s|$)/i.test(uninstallString)) return null;
  if (/(^|\s)--msedge(webview)?(\s|=|$)/i.test(uninstallString)) return null;

  const { executable } = parseUninstallerPath(uninstallString);
  if (!executable) return null;
  const path = executable.replace(/[\\/]+/g, '\\').toLowerCase();
  const match = /^(.+)\\[^\\]+\\installer\\setup\.exe$/.exec(path);
  return match ? match[1] : null;
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

  /* Chromium: the shape says it might be one, and the binary has to say
   * it supports the switch -- the same evidence rule as the NSIS check
   * below. All four setup.exe binaries on the dev machine carried it, but
   * a setup.exe under an Installer folder is a convention, not proof, and
   * passing a switch the binary does not know is the failure the old
   * comment in this file warned about. */
  if (chromiumApplicationFolder(uninstallString)) {
    const { executable: setupExe } = parseUninstallerPath(uninstallString);
    try {
      if (readFileSync(setupExe).includes('force-uninstall')) return 'chromium';
    } catch {
      // Unreadable or gone: nothing to say it supports the switch.
    }
    return 'unknown';
  }

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
    return kindFromContents(executable, contents, uninstallString);
  } catch {
    /* Gone, locked, or not readable. Reachable in normal use: the list on
     * screen is a snapshot and an uninstaller can be missing by the time a
     * batch reaches it -- the same orphan the Applications tab flags. An
     * unknown kind runs the command unchanged, which is the safe default. */
    return 'unknown';
  }

  return 'unknown';
}

/** The installer systems recognised from more than the NSIS signature.
 *
 * Added after measuring a second machine, where 79 of 130 programs still
 * ran their uninstaller as registered -- not the one in ten the first
 * machine had. 38 of those were these four, each with documented switches:
 *
 *   22  WiX Burn bundles (every .NET runtime, SDK and VC++ redistributable,
 *       Python, PowerShell 7) -- the .wixburn section is Burn's own
 *   13  Inno Setup (Git, CPU-Z, GPU-Z, NordVPN, Telegram...) -- which the
 *       header above once had no branch for, because the first machine had
 *       none without a quiet string. This one had thirteen.
 *    2  7-Zip,  1  WinRAR -- their own uninstallers, not an installer system
 *
 * Each needs two pieces of evidence, never a name alone: a signature in the
 * binary AND the shape around it (Inno's unins000.exe naming and its .dat
 * beside it; Burn's /uninstall verb; 7-Zip's and WinRAR's own program files
 * in the same folder). "7-Zip" or "WinRAR" appear in plenty of other
 * binaries' strings -- a license text, a bundled extractor. */
function kindFromContents(executable, contents, uninstallString) {
  const dir = dirname(executable);
  const name = basename(executable).toLowerCase();
  if (contents.includes('.wixburn') && /(^|\s)[/-]uninstall(\s|$)/i.test(uninstallString)) return 'burn';
  if (/^unins\d{3}\.exe$/.test(name) && contents.includes('Inno Setup')
    && existsSync(join(dir, name.replace(/\.exe$/, '.dat')))) return 'inno';
  if (name === 'uninstall.exe' && contents.includes('7-Zip') && existsSync(join(dir, '7z.exe')) && existsSync(join(dir, '7z.dll'))) return '7zip';
  if (name === 'uninstall.exe' && contents.includes('WinRAR') && existsSync(join(dir, 'WinRAR.exe'))) return 'winrar';
  return 'unknown';
}

/** Both steps together, for a caller that just has a program. */
export function resolveSilentCommand({ uninstallString, quietUninstallString, running } = {}) {
  const vendor = typeof quietUninstallString === 'string' ? quietUninstallString.trim() : '';
  // Skip the file read entirely when the vendor already answered.
  if (vendor) return vendor;
  return silentUninstallCommand({ uninstallString, kind: detectInstallerKind(uninstallString), running });
}
