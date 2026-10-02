import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let buildRegistryScript, scanRegistryLeftovers, scanRegistryAnchor, isProtectedKey;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ buildRegistryScript, scanRegistryLeftovers, scanRegistryAnchor, isProtectedKey } =
    await import('./registryLeftovers.js'));
});

describe('the Advanced registry sweep', () => {
  it('adds the deeper passes only when asked for', () => {
    const moderate = buildRegistryScript('Acme');
    const advanced = buildRegistryScript('Acme', { advanced: true });
    for (const marker of ['CLSID', 'RegisteredApplications', 'InprocServer32']) {
      expect(moderate, marker).not.toContain(marker);
      expect(advanced, marker).toContain(marker);
    }
  });

  it('does not enter Microsoft or the policy hive when it goes a level deeper', () => {
    expect(buildRegistryScript('Acme', { advanced: true })).toContain("^(Classes|WOW6432Node|Microsoft|Policies)$");
  });

  it('parses as PowerShell (nothing is run)', async () => {
    // Created, never invoked: a quoting mistake in a generated script is a
    // parse error that reads as "this program left nothing behind".
    const dir = mkdtempSync(join(tmpdir(), 'prune-parse-'));
    try {
      const file = join(dir, 'sweep.ps1');
      writeFileSync(file, buildRegistryScript("Ac'me", { advanced: true }), 'utf8');
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command',
          `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`],
        { timeout: 30000 }
      );
      expect(stdout.trim()).toBe('errors=0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 40000);

  it('gives the sweep a long timeout and no retry, and passes the extra token pattern in', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    await scanRegistryLeftovers('Acme Tool', 'Acme Inc', { advanced: true, extraPattern: 'photoshop' });
    const [script, options] = runPowerShellJsonMock.mock.calls[0];
    expect(script).toContain('photoshop');
    expect(options).toEqual({ timeoutMs: 120000, retries: 0 });
  });

  it('keeps the COM containers themselves out of reach of a deletion', () => {
    for (const key of [
      'HKLM:\\Software\\Classes\\CLSID',
      'HKCU:\\Software\\Classes\\CLSID',
      'HKLM:\\Software\\RegisteredApplications',
      'HKLM:\\Software\\Classes\\Installer'
    ]) expect(isProtectedKey(key), key).toBe(true);
  });
});

describe('scanRegistryAnchor', () => {
  it('reports the program\'s own key when it is still there', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({
      path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme',
      valueName: null,
      isUninstallEntry: true
    });
    const result = await scanRegistryAnchor('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme');
    expect(result.items).toEqual([{
      path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme',
      isUninstallEntry: true
    }]);
  });

  it('is empty when the key is gone, which is what a clean uninstall leaves', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    expect(await scanRegistryAnchor('HKCU:\\Software\\Gone')).toEqual({ ok: true, items: [] });
  });

  it('never calls PowerShell for something that is not a user-hive key path', async () => {
    for (const bad of [undefined, null, '', 'HKLM:', 'C:\\Windows', 'HKCR:\\Foo', 'HKLM:\\Software\\a\u0000b']) {
      expect(await scanRegistryAnchor(bad)).toEqual({ ok: true, items: [] });
    }
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });

  it('quotes the path as a literal, so an apostrophe in a key name cannot end the string', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    await scanRegistryAnchor("HKCU:\\Software\\Bob's App");
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain("'HKCU:\\Software\\Bob''s App'");
  });

  it('still refuses a protected key, whatever it was asked for', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({ path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft', valueName: null, isUninstallEntry: true });
    expect((await scanRegistryAnchor('HKLM:\\SOFTWARE\\Microsoft')).items).toEqual([]);
  });
});
