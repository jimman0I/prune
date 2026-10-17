import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildTaskToggleScript, buildServiceToggleScript, setSystemStartupEnabled,
  readServicesSwitchedOff, servicesOffPath
} from './startupSystemToggle.js';

describe('buildTaskToggleScript', () => {
  it('splits the full task path into folder and name, each a quoted literal', () => {
    const script = buildTaskToggleScript("\\Vendor\\O'Brien Updater", false);
    expect(script).toContain("-TaskPath '\\Vendor\\'");
    expect(script).toContain("-TaskName 'O''Brien Updater'");
    expect(script).toContain('Disable-ScheduledTask');
    expect(script).not.toContain('Enable-ScheduledTask');
  });

  it('enables, and handles a task at the root', () => {
    const script = buildTaskToggleScript('\\Updater', true);
    expect(script).toContain("-TaskPath '\\'");
    expect(script).toContain("-TaskName 'Updater'");
    expect(script).toContain('Enable-ScheduledTask');
  });
});

describe('buildServiceToggleScript', () => {
  it('switches between Automatic and Manual, never Disabled', () => {
    expect(buildServiceToggleScript('AcmeSvc', false)).toContain("Set-Service -Name 'AcmeSvc' -StartupType Manual");
    expect(buildServiceToggleScript('AcmeSvc', true)).toContain("Set-Service -Name 'AcmeSvc' -StartupType Automatic");
    expect(buildServiceToggleScript('AcmeSvc', false)).not.toMatch(/Disabled/);
  });
});

describe('setSystemStartupEnabled', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prune-svcoff-'));
    vi.stubEnv('UNREVO_SETTINGS_PATH', join(dir, 'settings.json'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  const task = { source: 'task', key: '\\Vendor\\Updater', name: 'Updater' };
  const service = { source: 'service', key: 'AcmeSvc', name: 'Acme Service' };

  it('switches a task off without elevation when Windows allows it', async () => {
    const run = vi.fn().mockResolvedValue({ state: 'Disabled' });
    const runElevated = vi.fn();
    expect(await setSystemStartupEnabled(task, false, { run, runElevated })).toEqual({ ok: true, enabled: false });
    expect(runElevated).not.toHaveBeenCalled();
  });

  it('elevates a task only when the unelevated attempt is refused', async () => {
    const run = vi.fn().mockRejectedValue(new Error('Access is denied. (0x80070005)'));
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { state: 'Ready' } });
    expect(await setSystemStartupEnabled(task, true, { run, runElevated })).toEqual({ ok: true, enabled: true });
    expect(runElevated).toHaveBeenCalledTimes(1);
  });

  it('passes a declined consent prompt through as cancelled, not an error', async () => {
    const run = vi.fn().mockRejectedValue(new Error('Access is denied.'));
    const runElevated = vi.fn().mockResolvedValue({ ok: false, cancelled: true });
    expect(await setSystemStartupEnabled(task, true, { run, runElevated })).toEqual({ ok: false, cancelled: true });
  });

  it('always elevates a service, and remembers it was switched off so the list keeps showing it', async () => {
    const run = vi.fn();
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { startMode: 'Manual' } });
    expect(await setSystemStartupEnabled(service, false, { run, runElevated })).toEqual({ ok: true, enabled: false });
    expect(run).not.toHaveBeenCalled();
    expect(readServicesSwitchedOff()).toEqual(['AcmeSvc']);

    runElevated.mockResolvedValue({ ok: true, data: { startMode: 'Auto' } });
    expect(await setSystemStartupEnabled(service, true, { run, runElevated })).toEqual({ ok: true, enabled: true });
    expect(readServicesSwitchedOff()).toEqual([]);
    expect(existsSync(servicesOffPath())).toBe(true);
    expect(JSON.parse(readFileSync(servicesOffPath(), 'utf8'))).toEqual([]);
  });

  it('reports a state Windows did not take, instead of claiming success', async () => {
    const run = vi.fn().mockResolvedValue({ state: 'Ready' });
    const result = await setSystemStartupEnabled(task, false, { run, runElevated: vi.fn() });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/still/i);
  });

  it('refuses anything that is not a task or a service', async () => {
    const result = await setSystemStartupEnabled({ source: 'run', key: 'x' }, false, { run: vi.fn(), runElevated: vi.fn() });
    expect(result.ok).toBe(false);
  });
});
