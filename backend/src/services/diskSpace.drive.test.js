import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDriveSpace } from './diskSpace.js';
import * as powershell from './powershell.js';

describe('getDriveSpace', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('reads the named drive, not always C', async () => {
    const run = vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({ freeBytes: 10, totalBytes: 100 });
    expect(await getDriveSpace('d')).toEqual({ freeBytes: 10, totalBytes: 100 });
    expect(run.mock.calls[0][0]).toContain('Get-PSDrive -Name D ');
  });

  // The letter ends up in a PowerShell command line.
  it('refuses anything that is not one letter without running anything', async () => {
    const run = vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({ freeBytes: 1, totalBytes: 2 });
    for (const bad of ['', 'CD', 'C:', '1', 'C; calc', null, undefined, '..']) {
      expect(await getDriveSpace(bad), String(bad)).toBeNull();
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('is null when the query fails to produce a total', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(null);
    expect(await getDriveSpace('E')).toBeNull();
  });
});
