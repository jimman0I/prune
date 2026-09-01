import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSystemDriveSpace } from './diskSpace.js';
import * as powershell from './powershell.js';

describe('getSystemDriveSpace', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns freeBytes and totalBytes from a real-shaped PowerShell response', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({
      freeBytes: 214748364800,
      totalBytes: 1073741824000
    });
    const result = await getSystemDriveSpace();
    expect(result).toEqual({ freeBytes: 214748364800, totalBytes: 1073741824000 });
  });

  it('returns null when PowerShell returns nothing (drive query failed)', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(null);
    const result = await getSystemDriveSpace();
    expect(result).toBeNull();
  });

  it('returns null rather than dividing by zero when totalBytes is 0', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({ freeBytes: 0, totalBytes: 0 });
    const result = await getSystemDriveSpace();
    expect(result).toBeNull();
  });
});