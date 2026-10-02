import { describe, it, expect } from 'vitest';
import { listFixedDrives, profileDrive } from './localDrives.js';

/** The drives the free-space wipe may be pointed at: local fixed disks only.
 * The PowerShell call is stubbed; what is under test is what is done with
 * its answer. */

const GB = 1024 ** 3;

describe('listFixedDrives', () => {
  it('returns each fixed drive with its label and sizes, in drive order', async () => {
    const run = async () => [
      { drive: 'D:', label: 'Games', totalBytes: 1000 * GB, freeBytes: 400 * GB },
      { drive: 'C:', label: 'Windows', totalBytes: 500 * GB, freeBytes: 40 * GB }
    ];
    expect(await listFixedDrives({ run })).toEqual([
      { drive: 'C:', label: 'Windows', totalBytes: 500 * GB, freeBytes: 40 * GB },
      { drive: 'D:', label: 'Games', totalBytes: 1000 * GB, freeBytes: 400 * GB }
    ]);
  });

  it('copes with PowerShell returning one object rather than a list', async () => {
    const run = async () => ({ drive: 'c:', label: ' ', totalBytes: 10, freeBytes: 4 });
    expect(await listFixedDrives({ run })).toEqual([{ drive: 'C:', label: '', totalBytes: 10, freeBytes: 4 }]);
  });

  it('is empty when PowerShell says nothing', async () => {
    expect(await listFixedDrives({ run: async () => null })).toEqual([]);
  });

  it('drops anything that is not a drive letter with a size -- a locked drive reports none', async () => {
    const run = async () => [
      { drive: 'C:', label: 'ok', totalBytes: 10, freeBytes: 1 },
      { drive: 'E:', label: 'locked', totalBytes: null, freeBytes: null },
      { drive: '\\\\server\\share', label: 'net', totalBytes: 10, freeBytes: 1 },
      { drive: 'F:', label: 'zero', totalBytes: 0, freeBytes: 0 },
      null
    ];
    expect((await listFixedDrives({ run })).map((d) => d.drive)).toEqual(['C:']);
  });

  it('clamps free space into 0..total', async () => {
    const run = async () => [{ drive: 'C:', label: '', totalBytes: 10, freeBytes: 99 }];
    expect((await listFixedDrives({ run }))[0].freeBytes).toBe(10);
  });

  it('asks only for local fixed disks (DriveType 3)', async () => {
    let script = '';
    await listFixedDrives({ run: async (s) => { script = s; return []; } });
    expect(script).toMatch(/DriveType\s*=\s*3/);
  });
});

describe('profileDrive', () => {
  it('is a bare drive letter', () => {
    expect(profileDrive()).toMatch(/^[A-Z]:$/);
  });
});
