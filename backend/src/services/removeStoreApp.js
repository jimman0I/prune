import { runPowerShellJson } from './powershell.js';

/** Removing a Store app.
 *
 * Prune listed 81 of these and could remove none of them: every row
 * opened Windows' own Installed Apps page instead, because removal is
 * Remove-AppxPackage rather than running an uninstaller. That was honest
 * and it was also a list you could look at and not act on, which is the
 * one thing Bulk Crap Uninstaller does here that Prune did not.
 *
 * MEASURED FIRST, on the 81 packages this machine lists: two of them are
 * flagged NonRemovable by Windows itself --
 *
 *   Microsoft.SecHealthUI        the Windows Security interface
 *   Microsoft.DesktopAppInstaller  winget
 *
 * -- which is why most of this file is about refusing rather than
 * removing. A cleanup tool that offers to delete the Windows Security UI
 * is one nobody should run, and Windows already publishes the flag that
 * says so.
 *
 * Note what this does NOT do: -AllUsers. That variant needs administrator
 * and removes the package for every account on the machine, which is a
 * different and much larger act than the row implies. Per-user removal is
 * what "uninstall this app" means to the person looking at their own
 * installed list.
 */

/** Characters a package full name is allowed to contain.
 *
 * A real one looks like
 * `Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe` --
 * name, version, architecture and publisher id, joined by underscores.
 * Letters, digits, dot, dash, plus and underscore cover every package on
 * this machine and exclude every character that means something to
 * PowerShell: quotes, semicolons, ampersands, pipes, backticks, $, and
 * whitespace of any kind.
 *
 * The route hands back the name the machine reported rather than the one
 * the caller sent, so this should never fire in normal use. It is here
 * anyway, because "the value is trustworthy" is a property of today's
 * call sites and not of the function. */
const PACKAGE_FULL_NAME = /^[A-Za-z0-9.\-+_]+$/;

export function isValidPackageFullName(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && PACKAGE_FULL_NAME.test(value);
}

/** Why this package may not be removed, or null when it may.
 *
 * A string rather than a boolean for the same reason the startup screen's
 * refusals are: every one of these has to be shown to somebody, and an
 * inert button with no explanation is what this app gets criticised for.
 */
export function storeRemovalRefusal(app) {
  if (!app || !app.packageFullName) return 'There is no package to remove.';

  if (!isValidPackageFullName(app.packageFullName)) {
    return 'That package name is not one Windows could have produced.';
  }

  if (app.nonRemovable) {
    /* Windows' own flag, not a list Prune maintains. On this machine it
     * covers the Security interface and the app installer -- components
     * the system depends on, which is exactly why the flag exists. */
    return 'Windows marks this app as part of the system and does not allow it to be removed.';
  }

  return null;
}

/** Removes one Store app for the current user.
 *
 * Returns rather than throws, the same convention setStartupItemEnabled
 * follows: a failure here is something the row has to display, not an
 * exception for the route to translate. */
export async function removeStoreApp(app) {
  const refusal = storeRemovalRefusal(app);
  // Checked BEFORE the command is built, so a refused package never
  // reaches PowerShell at all. Relying on Remove-AppxPackage to decline
  // would make Windows the only thing standing between the user and a
  // removed Security UI.
  if (refusal) return { ok: false, error: refusal };

  /* The name is interpolated rather than passed as a parameter because
   * runPowerShellJson takes a script. It has been checked against
   * PACKAGE_FULL_NAME above, so it cannot close the quote it sits in.
   *
   * -ErrorAction Stop so a failure lands in catch as an error with a
   * message, rather than writing to the error stream and letting the
   * script report success. */
  const script = `
try {
  Remove-AppxPackage -Package '${app.packageFullName}' -ErrorAction Stop
  [PSCustomObject]@{ ok = $true } | ConvertTo-Json -Compress
} catch {
  [PSCustomObject]@{ ok = $false; error = [string]$_.Exception.Message } | ConvertTo-Json -Compress
}
`;

  try {
    const result = await runPowerShellJson(script);
    if (result?.ok === true) return { ok: true };
    return { ok: false, error: result?.error || 'Windows did not remove the app, and did not say why.' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
