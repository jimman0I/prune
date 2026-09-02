import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDiskHealth, getElevatedDiskHealth } from './diskHealth.js';
import * as powershell from './powershell.js';
import * as elevated from '../lib/elevatedPowerShell.js';

const ELEVATED_DISK = {
  deviceId: '0',
  model: 'Micron 2300 NVMe 1024GB',
  mediaType: 'SSD',
  busType: 'NVMe',
  sizeBytes: 1024209543168,
  healthStatus: 'Healthy',
  operationalStatus: 'OK',
  wearPercent: 7,
  temperatureC: 41,
  powerOnHours: 4210,
  readErrorsUncorrected: 0,
  writeErrorsUncorrected: 0,
  reliabilityAvailable: true
};

// The real shape this machine returns unelevated -- identity and
// HealthStatus are readable, every reliability counter is null because
// Get-StorageReliabilityCounter is admin-only (confirmed live: "Access to
// a CIM resource was not available to the client").
const UNELEVATED_DISK = {
  ...ELEVATED_DISK,
  wearPercent: null,
  temperatureC: null,
  powerOnHours: null,
  readErrorsUncorrected: null,
  writeErrorsUncorrected: null,
  reliabilityAvailable: false
};

describe('getDiskHealth', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('derives life remaining from real wear when reliability counters are readable', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([ELEVATED_DISK]);

    const result = await getDiskHealth();

    expect(result.reliabilityAvailable).toBe(true);
    expect(result.disks).toHaveLength(1);
    expect(result.disks[0].lifeRemainingPercent).toBe(93); // 100 - 7% wear
    expect(result.disks[0].wearPercent).toBe(7);
    expect(result.disks[0].temperatureC).toBe(41);
    expect(result.disks[0].model).toBe('Micron 2300 NVMe 1024GB');
  });

  it('reports null life remaining -- never a fabricated number -- when wear is unreadable', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([UNELEVATED_DISK]);

    const result = await getDiskHealth();

    expect(result.reliabilityAvailable).toBe(false);
    // The honest part: no invented percentage. The frontend renders the
    // real healthStatus instead of a made-up gauge value.
    expect(result.disks[0].lifeRemainingPercent).toBeNull();
    expect(result.disks[0].wearPercent).toBeNull();
    // ...but the identity/health that IS readable unelevated survives.
    expect(result.disks[0].healthStatus).toBe('Healthy');
    expect(result.disks[0].mediaType).toBe('SSD');
    expect(result.disks[0].sizeBytes).toBe(1024209543168);
  });

  it('accepts a bare object, not just an array -- PowerShell collapses a one-disk result', async () => {
    // Real gotcha, confirmed live: `@($disks) | ConvertTo-Json` emits a
    // bare object when there is exactly one disk, an array when there are
    // several. The script forces an array via -InputObject, but a single
    // machine-shaped response must never crash this either way.
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(ELEVATED_DISK);

    const result = await getDiskHealth();

    expect(result.disks).toHaveLength(1);
    expect(result.disks[0].deviceId).toBe('0');
  });

  it('marks reliability available when any disk reports wear, not only the first', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([UNELEVATED_DISK, ELEVATED_DISK]);

    const result = await getDiskHealth();

    expect(result.reliabilityAvailable).toBe(true);
    expect(result.disks[0].lifeRemainingPercent).toBeNull();
    expect(result.disks[1].lifeRemainingPercent).toBe(93);
  });

  it('clamps a nonsense wear value rather than reporting a negative life remaining', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([{ ...ELEVATED_DISK, wearPercent: 140 }]);

    const result = await getDiskHealth();

    expect(result.disks[0].lifeRemainingPercent).toBe(0);
  });

  it('returns null when PowerShell returns nothing at all', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(null);
    expect(await getDiskHealth()).toBeNull();
  });

  it('returns null rather than throwing when PowerShell itself fails', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockRejectedValue(new Error('PowerShell command failed'));
    expect(await getDiskHealth()).toBeNull();
  });
});

describe('getElevatedDiskHealth', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns the same shape as getDiskHealth when the elevated read succeeds', async () => {
    vi.spyOn(elevated, 'runElevatedPowerShellJson').mockResolvedValue({ ok: true, data: [ELEVATED_DISK] });

    const result = await getElevatedDiskHealth();

    expect(result.reliabilityAvailable).toBe(true);
    expect(result.disks[0].lifeRemainingPercent).toBe(93);
  });

  it('reports a declined UAC prompt as cancelled, not as a failure', async () => {
    vi.spyOn(elevated, 'runElevatedPowerShellJson').mockResolvedValue({ ok: false, cancelled: true });
    expect(await getElevatedDiskHealth()).toEqual({ cancelled: true });
  });

  it('passes a real elevated failure through as an error', async () => {
    vi.spyOn(elevated, 'runElevatedPowerShellJson').mockResolvedValue({ ok: false, error: 'nope' });
    expect(await getElevatedDiskHealth()).toEqual({ error: 'nope' });
  });

  it('still reports null wear when even an ADMIN read finds no counters -- some drives never expose them', async () => {
    vi.spyOn(elevated, 'runElevatedPowerShellJson').mockResolvedValue({ ok: true, data: [UNELEVATED_DISK] });

    const result = await getElevatedDiskHealth();

    expect(result.reliabilityAvailable).toBe(false);
    expect(result.disks[0].lifeRemainingPercent).toBeNull();
  });
});
