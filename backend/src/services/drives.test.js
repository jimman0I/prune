import { describe, it, expect, vi, afterEach } from 'vitest';
import { listDrives } from './drives.js';
import * as powershell from './powershell.js';

const GB = 1024 ** 3;

describe('listDrives', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('lists fixed and removable local drives with their sizes', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([
      { letter: 'C:', label: 'Windows', fileSystem: 'NTFS', totalBytes: 953 * GB, freeBytes: 140 * GB, driveType: 3 },
      { letter: 'E:', label: 'USB STICK', fileSystem: 'exFAT', totalBytes: 64 * GB, freeBytes: 60 * GB, driveType: 2 }
    ]);

    const result = await listDrives({ env: { SystemDrive: 'C:' } });

    expect(result.systemDrive).toBe('C');
    expect(result.drives).toEqual([
      { letter: 'C', label: 'Windows', fileSystem: 'NTFS', totalBytes: 953 * GB, freeBytes: 140 * GB, removable: false, system: true, ntfs: true },
      { letter: 'E', label: 'USB STICK', fileSystem: 'exFAT', totalBytes: 64 * GB, freeBytes: 60 * GB, removable: true, system: false, ntfs: false }
    ]);
  });

  // ConvertTo-Json unwraps a one-element array into a bare object, so a
  // single-drive machine (very common) would otherwise break the list.
  it('accepts the bare object PowerShell prints for a single drive', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(
      { letter: 'D:', label: '', fileSystem: 'NTFS', totalBytes: 10 * GB, freeBytes: 5 * GB, driveType: 3 }
    );
    const { drives } = await listDrives({ env: { SystemDrive: 'D:' } });
    expect(drives).toHaveLength(1);
    expect(drives[0].letter).toBe('D');
    expect(drives[0].label).toBe('');
  });

  it('follows the real system drive rather than assuming C', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([
      { letter: 'C:', label: 'Old', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 },
      { letter: 'D:', label: 'Windows', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 }
    ]);
    const result = await listDrives({ env: { SystemDrive: 'd:' } });
    expect(result.systemDrive).toBe('D');
    expect(result.drives.find((d) => d.letter === 'D').system).toBe(true);
    expect(result.drives.find((d) => d.letter === 'C').system).toBe(false);
  });

  it('drops drives with no readable size, such as an empty card reader', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([
      { letter: 'C:', label: 'Windows', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 },
      { letter: 'F:', label: '', fileSystem: null, totalBytes: null, freeBytes: null, driveType: 2 }
    ]);
    const { drives } = await listDrives({ env: { SystemDrive: 'C:' } });
    expect(drives.map((d) => d.letter)).toEqual(['C']);
  });

  it('sorts by drive letter regardless of the order Windows listed them', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([
      { letter: 'D:', label: '', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 },
      { letter: 'C:', label: '', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 }
    ]);
    const { drives } = await listDrives({ env: {} });
    expect(drives.map((d) => d.letter)).toEqual(['C', 'D']);
  });

  it('falls back to C as the system drive when the environment names none', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([]);
    expect((await listDrives({ env: {} })).systemDrive).toBe('C');
  });

  it('returns an empty list rather than throwing when PowerShell prints nothing', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(null);
    expect((await listDrives({ env: {} })).drives).toEqual([]);
  });

  it('ignores a row whose letter is not a single drive letter', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue([
      { letter: 'C:', label: '', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 },
      { letter: '\\\\server\\share', label: '', fileSystem: 'NTFS', totalBytes: GB, freeBytes: 1, driveType: 3 }
    ]);
    const { drives } = await listDrives({ env: {} });
    expect(drives.map((d) => d.letter)).toEqual(['C']);
  });
});
