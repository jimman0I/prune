import { existsSync } from 'node:fs';
import { parseUninstallerPath } from './uninstallerPath.js';

/** Whether a registry Uninstall entry can still uninstall itself.
 *
 * Windows never cleans these up: a program removed by deleting its folder,
 * an installer that crashed halfway, a drive that no longer exists -- all
 * leave an entry behind that Add/Remove Programs still lists and that
 * fails, silently or loudly, when you click Uninstall. This is what Revo
 * Uninstaller means by a "leftover entry", and it's the one case where the
 * normal uninstall path CAN'T work, so the app has to offer something else.
 *
 * Deliberately conservative: `orphaned` is true only on positive evidence
 * that something is gone. Where the question is unanswerable -- an MSI
 * entry, whose uninstaller is msiexec.exe and therefore always present;
 * an entry that simply never declared an InstallLocation -- the
 * corresponding field is null, not false, and the program is left alone.
 * A false "broken" badge on healthy software would push someone toward
 * force-removing a program that was fine, which is worse than missing a
 * genuinely dead entry. */
export function assessProgramHealth(program) {
  const { executable, isMsi } = parseUninstallerPath(program.uninstallString);

  // Null, not false: msiexec.exe existing tells us nothing about this
  // program, and a PATH-resolved command isn't a filesystem path at all,
  // so in both cases there is no honest answer to "is its uninstaller
  // missing" -- only "we can't tell from here".
  const checkable = executable && !isMsi && isAbsolutePath(executable);
  const uninstallerMissing = checkable ? !existsSync(executable) : null;

  const location = normalizeLocation(program.installLocation);
  const installLocationMissing = location ? !existsSync(location) : null;

  if (!executable) {
    return orphan(uninstallerMissing, installLocationMissing, 'No uninstall command is registered for this program.');
  }
  if (uninstallerMissing) {
    return orphan(uninstallerMissing, installLocationMissing, `Its uninstaller is missing (${executable}).`);
  }
  if (isMsi && installLocationMissing) {
    return orphan(uninstallerMissing, installLocationMissing, `Its install folder is missing (${location}).`);
  }
  return { orphaned: false, uninstallerMissing, installLocationMissing, reason: null };
}

function orphan(uninstallerMissing, installLocationMissing, reason) {
  return { orphaned: true, uninstallerMissing, installLocationMissing, reason };
}

/** Whether a parsed uninstaller string names a file we could actually go
 * look for. `C:\Apps\u.exe` and `\\server\share\u.exe` do; `winget
 * uninstall` and `rundll32.exe ...` don't -- those are commands Windows
 * resolves through PATH, and existsSync on them always answers false no
 * matter how healthy the program is.
 *
 * Real false positive this fixes, found running the check against this
 * machine's registry: every winget-managed package (uv, FFmpeg) registers
 * the literal UninstallString "winget uninstall" and got badged broken. */
function isAbsolutePath(executable) {
  return /^[a-z]:[\\/]/i.test(executable) || executable.startsWith('\\\\');
}

/** InstallLocation is free-form third-party data: it turns up wrapped in
 * quotes, with a trailing separator, or as an empty string standing in for
 * "not set". All three are the same directory as far as existence goes. */
function normalizeLocation(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
  return cleaned || null;
}
