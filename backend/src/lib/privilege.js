import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** SIDs of the mandatory integrity levels that can open a raw volume:
 * High (an elevated Administrator) and System. Medium -- what an
 * administrator account runs at until a UAC prompt is accepted -- cannot. */
const ELEVATED_INTEGRITY_SIDS = ['S-1-16-12288', 'S-1-16-16384'];

/** Builds the "is this process elevated" check, with the shell-out and the
 * platform injectable.
 *
 * Why integrity level and not "is the user in Administrators": a plain
 * administrator account is a member of that group while running
 * unelevated, and asking the group would say "yes" about a process that
 * still gets Access Denied on `\\.\C:`. The token's integrity level is what
 * Windows actually checks, and `whoami /groups` prints it as a SID
 * regardless of the display language.
 *
 * Remembered after the first successful answer, because a running process's
 * token never changes -- relaunching as administrator is a new process.
 * A failed check is NOT remembered and reads as "not elevated": the cost of
 * a wrong "no" is one UAC prompt that was not strictly needed, the cost of
 * a wrong "yes" is a scan that dies with Access Denied. */
export function createElevationCheck({ exec = execFileAsync, platform = process.platform } = {}) {
  let remembered = null;

  return async function isElevated() {
    if (platform !== 'win32') return false;
    if (remembered) return remembered;

    remembered = (async () => {
      const { stdout } = await exec('whoami', ['/groups', '/fo', 'csv', '/nh'], { windowsHide: true, timeout: 10_000 });
      const text = String(stdout ?? '');
      if (!/S-1-16-\d+/.test(text)) throw new Error('No integrity level in the output.');
      return ELEVATED_INTEGRITY_SIDS.some((sid) => text.includes(`"${sid}"`));
    })();

    try {
      return await remembered;
    } catch {
      remembered = null;
      return false;
    }
  };
}

export const isElevated = createElevationCheck();
