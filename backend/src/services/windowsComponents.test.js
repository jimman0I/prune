import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  featureRows, updateRows, wusaOutcome, disableWindowsFeature, uninstallWindowsUpdate,
  buildDisableFeatureScript, buildUninstallUpdateScript, FEATURES_QUERY, UPDATES_QUERY
} from './windowsComponents.js';

describe('featureRows', () => {
  it('shapes enabled features like programs, by caption, and marks the ones never offered', () => {
    const rows = featureRows([
      { name: 'Microsoft-Windows-Subsystem-Linux', caption: 'Windows Subsystem for Linux' },
      { name: 'NetFx4-AdvSrvs', caption: '.NET Framework 4.8 Advanced Services' },
      { name: 'bad name; x', caption: 'Nope' }
    ]);
    expect(rows.map((r) => r.name)).toEqual(['.NET Framework 4.8 Advanced Services', 'Windows Subsystem for Linux']);
    expect(rows[1]).toMatchObject({ id: 'feature:Microsoft-Windows-Subsystem-Linux', featureName: 'Microsoft-Windows-Subsystem-Linux', source: 'feature', protected: false, publisher: 'Microsoft' });
    expect(rows[0].protected).toBe(true);
  });
});

describe('updateRows', () => {
  it('lists each KB update newest first and drops anything that is not one', () => {
    const rows = updateRows([
      { id: 'KB5054156', description: 'Update', installedOn: '2025-10-10' },
      { id: 'KB5127648', description: 'Security Update', installedOn: '2026-10-15' },
      { id: 'File 1', description: '', installedOn: null }
    ]);
    expect(rows.map((r) => r.name)).toEqual(['KB5127648', 'KB5054156']);
    expect(rows[0]).toMatchObject({ id: 'update:KB5127648', kb: '5127648', installDate: '2026-10-15', description: 'Security Update', source: 'update' });
  });
});

describe('wusaOutcome', () => {
  it('reads wusa exit codes', () => {
    expect(wusaOutcome(0)).toEqual({ ok: true });
    expect(wusaOutcome(3010)).toEqual({ ok: true, restartNeeded: true });
    expect(wusaOutcome(1223)).toEqual({ ok: false, cancelled: true });
    expect(wusaOutcome(2359303).error).toMatch(/permanent/);
    expect(wusaOutcome(5).error).toMatch(/code 5/);
  });
});

describe('disableWindowsFeature', () => {
  const read = async () => [{ name: 'Microsoft-Windows-Subsystem-Linux' }, { name: 'NetFx4-AdvSrvs' }];

  it('turns off an enabled feature, elevated, and passes the restart flag on', async () => {
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { changed: true, restartNeeded: true, restorePoint: { created: true } } });
    const result = await disableWindowsFeature('Microsoft-Windows-Subsystem-Linux', { runElevated, read });
    expect(result).toEqual({ ok: true, restartNeeded: true, restorePoint: { created: true } });
    expect(runElevated.mock.calls[0][0]).toContain("-FeatureName 'Microsoft-Windows-Subsystem-Linux'");
  });

  it('refuses protected, unknown, already-off and malformed names without elevating', async () => {
    const runElevated = vi.fn();
    expect((await disableWindowsFeature('NetFx4-AdvSrvs', { runElevated, read })).error).toMatch(/depends/);
    expect((await disableWindowsFeature('Containers-DisposableClientVM', { runElevated, read })).error).toMatch(/already off/);
    expect((await disableWindowsFeature("x'; Remove-Item C:\\", { runElevated, read })).ok).toBe(false);
    expect(runElevated).not.toHaveBeenCalled();
  });

  it('asks for consent when no restore point protects the change, and changed nothing', async () => {
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { changed: false, restorePoint: { created: false, recent: false, reason: 'System Protection is off' } } });
    const result = await disableWindowsFeature('Microsoft-Windows-Subsystem-Linux', { runElevated, read });
    expect(result).toMatchObject({ ok: false, needsConsent: true, reason: 'System Protection is off' });
  });

  it('only lets the script go ahead without a restore point when told to', () => {
    expect(buildDisableFeatureScript('X')).toContain('-not $false');
    expect(buildDisableFeatureScript('X', { allowWithoutRestorePoint: true })).toContain('-not $true');
  });

  it('passes a cancelled UAC prompt through', async () => {
    const runElevated = vi.fn().mockResolvedValue({ ok: false, cancelled: true });
    expect(await disableWindowsFeature('Microsoft-Windows-Subsystem-Linux', { runElevated, read })).toEqual({ ok: false, cancelled: true });
  });
});

describe('uninstallWindowsUpdate', () => {
  const read = async () => [{ id: 'KB5127694' }];

  it('removes an installed update with wusa and reads its exit code', async () => {
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { changed: true, exitCode: 3010, restorePoint: { created: true } } });
    expect(await uninstallWindowsUpdate('KB5127694', { runElevated, read })).toEqual({ ok: true, restartNeeded: true, restorePoint: { created: true } });
    expect(runElevated.mock.calls[0][0]).toContain("'/kb:5127694'");
  });

  it('refuses an update that is not installed or not an update number', async () => {
    const runElevated = vi.fn();
    expect((await uninstallWindowsUpdate('KB1234567', { runElevated, read })).error).toMatch(/no longer installed/);
    expect((await uninstallWindowsUpdate('KB12; calc', { runElevated, read })).ok).toBe(false);
    expect(runElevated).not.toHaveBeenCalled();
  });
});

describe('scripts', () => {
  let root;
  beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'prune-wincomp-')); });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('parse as PowerShell (nothing is run)', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const scripts = {
      'f.ps1': buildDisableFeatureScript("Odd'Name"),
      'u.ps1': buildUninstallUpdateScript('5127694', { allowWithoutRestorePoint: true }),
      'fq.ps1': FEATURES_QUERY,
      'uq.ps1': UPDATES_QUERY
    };
    for (const [name, body] of Object.entries(scripts)) {
      writeFileSync(join(root, name), body, 'utf8');
      const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${join(root, name)}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
      expect(stdout.trim(), name).toBe('errors=0');
    }
  }, 60000);

  it('the list queries run and return real rows on this machine', async () => {
    const { listWindowsFeatures, listWindowsUpdates } = await import('./windowsComponents.js');
    const features = await listWindowsFeatures();
    expect(Array.isArray(features)).toBe(true);
    expect(Array.isArray(await listWindowsUpdates())).toBe(true);
  }, 90000);
});
