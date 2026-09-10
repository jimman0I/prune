import { describe, it, expect, beforeEach, vi } from 'vitest';

const runPowerShellJson = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...a) => runPowerShellJson(...a) }));

const { storeRemovalRefusal, isValidPackageFullName, removeStoreApp } =
  await import('./removeStoreApp.js');

/** Removing a Store app, which Prune previously refused to do at all.
 *
 * The Applications tab listed 81 of them and every row opened Windows'
 * own Installed Apps page instead, on the grounds that removal is
 * Remove-AppxPackage rather than an uninstaller. That was honest but it
 * left the user with a list they could look at and not act on.
 *
 * The reason this file is mostly about refusals rather than removal is
 * what the measurement turned up: of those 81 apps, two are flagged
 * NonRemovable by Windows itself -- Microsoft.SecHealthUI, which is the
 * Windows Security interface, and Microsoft.DesktopAppInstaller, which is
 * winget. A cleanup tool that offers to remove the Windows Security UI is
 * a cleanup tool nobody should run.
 */

const app = (over = {}) => ({
  packageFullName: 'Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe',
  name: 'Calculator',
  nonRemovable: false,
  ...over
});

beforeEach(() => { runPowerShellJson.mockReset(); });

describe('what it refuses to remove', () => {
  it('refuses a package Windows marks non-removable', () => {
    /* Not a UI concern. The button can be hidden and the route still
     * reached -- by a stale page, a retry, or anything that talks to the
     * API directly -- so the refusal lives here, the same way the
     * quarantine remover re-checks protected registry keys the scanner
     * already refused to offer. */
    const refusal = storeRemovalRefusal(app({ nonRemovable: true, name: 'Windows Security' }));

    expect(refusal).toBeTruthy();
    expect(refusal).toMatch(/Windows/i);
  });

  it('allows an ordinary app', () => {
    expect(storeRemovalRefusal(app())).toBeNull();
  });

  it('refuses when there is no package at all', () => {
    expect(storeRemovalRefusal(null)).toBeTruthy();
    expect(storeRemovalRefusal(app({ packageFullName: '' }))).toBeTruthy();
  });
});

describe('the package name it will accept', () => {
  it('accepts a real package full name', () => {
    expect(isValidPackageFullName('Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe')).toBe(true);
    expect(isValidPackageFullName('Some.App-Name_1.0.0.0_neutral__abc123def456g')).toBe(true);
  });

  it('rejects anything carrying shell punctuation', () => {
    /* This name reaches PowerShell. The route looks the package up fresh
     * and passes back what the machine reported rather than what the
     * caller sent -- the same rule the uninstall route follows -- but the
     * check belongs next to the command as well, because a value being
     * trustworthy today is not a property that survives refactoring.
     */
    for (const bad of [
      "App_1.0_x64__abc'; Remove-Item C:\\ -Recurse; '",
      'App_1.0_x64__abc & calc.exe',
      'App_1.0_x64__abc | Out-File x',
      'App_1.0_x64__abc; whoami',
      'App$(whoami)_1.0',
      'App`whoami`_1.0',
      'App with spaces_1.0',
      'App_1.0\nRemove-Item'
    ]) {
      expect(isValidPackageFullName(bad), `should reject: ${bad}`).toBe(false);
    }
  });

  it('rejects nothing at all', () => {
    expect(isValidPackageFullName('')).toBe(false);
    expect(isValidPackageFullName(null)).toBe(false);
    expect(isValidPackageFullName(undefined)).toBe(false);
  });
});

describe('removing one', () => {
  it('asks PowerShell to remove exactly the package it was given', async () => {
    runPowerShellJson.mockResolvedValue({ ok: true });

    const result = await removeStoreApp(app());

    expect(result.ok).toBe(true);
    const script = runPowerShellJson.mock.calls[0][0];
    expect(script).toContain('Remove-AppxPackage');
    expect(script).toContain('Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe');
  });

  it('does not reach PowerShell at all for a non-removable package', async () => {
    /* The assertion that matters. A refusal that still ran the command and
     * then reported failure would be relying on Windows to say no. */
    const result = await removeStoreApp(app({ nonRemovable: true }));

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(runPowerShellJson).not.toHaveBeenCalled();
  });

  it('does not reach PowerShell for a malformed package name', async () => {
    const result = await removeStoreApp(app({ packageFullName: 'App_1.0; Remove-Item C:\\' }));

    expect(result.ok).toBe(false);
    expect(runPowerShellJson).not.toHaveBeenCalled();
  });

  it('reports the reason when Windows refuses', async () => {
    // Remove-AppxPackage fails for plenty of ordinary reasons -- the app
    // is running, it was provisioned for all users, the package is in a
    // bad state. The row needs to say which.
    runPowerShellJson.mockResolvedValue({ ok: false, error: 'The package is currently in use.' });

    const result = await removeStoreApp(app());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/in use/i);
  });

  it('turns a thrown PowerShell failure into a reported one, not a crash', async () => {
    // Same convention the rest of the app follows: a service that shells
    // out returns its failure rather than throwing it at the route.
    runPowerShellJson.mockRejectedValue(new Error('powershell.exe exited with 1'));

    const result = await removeStoreApp(app());

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/powershell/i);
  });
});
