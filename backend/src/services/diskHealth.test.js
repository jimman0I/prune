import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDiskHealth, getElevatedDiskHealth } from './diskHealth.js';
import * as powershell from './powershell.js';
import * as elevated from '../lib/elevated.js';
import * as nvme from './nvmeSmart.js';

// The NVMe SMART read is real and unelevated, so without this it runs
// during every test and overrides the mocked Windows figures with this
// machine's actual drive. These cases are about the Windows-reported
// path; the SMART merge has its own tests at the bottom.
beforeEach(() => {
  vi.spyOn(nvme, 'getNvmeSmart').mockResolvedValue({});
});

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


describe('NVMe SMART enrichment', () => {
  const WINDOWS_DISK = {
    deviceId: '0', model: 'Micron 2300 NVMe 1024GB', mediaType: 'SSD', busType: 'NVMe',
    sizeBytes: 1024209543168, healthStatus: 'Healthy', operationalStatus: 'OK',
    wearPercent: null, temperatureC: null, powerOnHours: null,
    readErrorsUncorrected: null, writeErrorsUncorrected: null, reliabilityAvailable: false
  };

  // The reason this exists. Measured on this machine:
  // Get-StorageReliabilityCounter reported Wear = 0 while the drive's own
  // SMART log reported 12% used, after 12,428 hours and 126 TB written.
  // The dashboard was showing "100% life remaining" for a drive that has
  // spent an eighth of its rated endurance.
  it('prefers the drive-reported wear figure over the Windows counter', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([{ ...WINDOWS_DISK, wearPercent: 0 }]);
    vi.spyOn(nvme, 'getNvmeSmart').mockResolvedValue({
      0: { percentageUsed: 12, temperatureC: 52, powerOnHours: 12428 }
    });

    const result = await getDiskHealth();
    expect(result.disks[0].wearPercent).toBe(12);
    expect(result.disks[0].lifeRemainingPercent).toBe(88);
  });

  it('fills in the counters Windows left null', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([WINDOWS_DISK]);
    vi.spyOn(nvme, 'getNvmeSmart').mockResolvedValue({
      0: { percentageUsed: 12, temperatureC: 52, powerOnHours: 12428, mediaErrors: 0 }
    });

    const disk = (await getDiskHealth()).disks[0];
    expect(disk.powerOnHours).toBe(12428);
    expect(disk.temperatureC).toBe(52);
    expect(disk.smart.mediaErrors).toBe(0);
    expect(disk.smartAvailable).toBe(true);
  });

  // SATA SSDs and spinning disks have no such log page, and an NVMe
  // behind a controller that refuses the passthrough has none either.
  it('leaves a drive untouched when it reports no SMART log', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([{ ...WINDOWS_DISK, wearPercent: 3 }]);
    vi.spyOn(nvme, 'getNvmeSmart').mockResolvedValue({});

    const disk = (await getDiskHealth()).disks[0];
    expect(disk.wearPercent).toBe(3);
    expect(disk.smartAvailable).toBeUndefined();
  });

  it('still returns the Windows view when the SMART read throws', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([WINDOWS_DISK]);
    vi.spyOn(nvme, 'getNvmeSmart').mockRejectedValue(new Error('passthrough refused'));

    const result = await getDiskHealth();
    expect(result.disks[0].model).toBe('Micron 2300 NVMe 1024GB');
  });
});
