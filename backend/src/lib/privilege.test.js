import { describe, it, expect, vi } from 'vitest';
import { createElevationCheck } from './privilege.js';

const csv = (sid) => `"BUILTIN\\Users","Alias","S-1-5-32-545","Group used for deny only"\r\n"Mandatory Label\\X Mandatory Level","Label","${sid}",""\r\n`;
const execReturning = (stdout) => vi.fn(async () => ({ stdout }));

describe('isElevated', () => {
  it('is true at High integrity (an elevated Administrator)', async () => {
    const check = createElevationCheck({ exec: execReturning(csv('S-1-16-12288')), platform: 'win32' });
    expect(await check()).toBe(true);
  });

  it('is true at System integrity, such as a service', async () => {
    const check = createElevationCheck({ exec: execReturning(csv('S-1-16-16384')), platform: 'win32' });
    expect(await check()).toBe(true);
  });

  // The everyday case. An administrator account that has not been elevated
  // runs at Medium and still cannot open a raw volume.
  it('is false at Medium integrity, even for an administrator account', async () => {
    const check = createElevationCheck({ exec: execReturning(csv('S-1-16-8192')), platform: 'win32' });
    expect(await check()).toBe(false);
  });

  it('is false at Low integrity', async () => {
    const check = createElevationCheck({ exec: execReturning(csv('S-1-16-4096')), platform: 'win32' });
    expect(await check()).toBe(false);
  });

  // Unknown must read as "not elevated": the cost of a wrong "yes" is a
  // scan that fails with "access denied", the cost of a wrong "no" is one
  // UAC prompt that was not strictly needed.
  it('is false when the check itself fails', async () => {
    const check = createElevationCheck({ exec: vi.fn(async () => { throw new Error('whoami not found'); }), platform: 'win32' });
    expect(await check()).toBe(false);
  });

  it('is false when the output carries no integrity level at all', async () => {
    const check = createElevationCheck({ exec: execReturning('garbage'), platform: 'win32' });
    expect(await check()).toBe(false);
  });

  it('is false on a platform without UAC, without running anything', async () => {
    const exec = execReturning(csv('S-1-16-12288'));
    const check = createElevationCheck({ exec, platform: 'linux' });
    expect(await check()).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  // A process's token cannot change while it runs, so asking once is enough.
  it('asks once and remembers', async () => {
    const exec = execReturning(csv('S-1-16-12288'));
    const check = createElevationCheck({ exec, platform: 'win32' });
    await check();
    await check();
    await Promise.all([check(), check()]);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('does not remember a failure, so a later attempt can succeed', async () => {
    const exec = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ stdout: csv('S-1-16-12288') });
    const check = createElevationCheck({ exec, platform: 'win32' });
    expect(await check()).toBe(false);
    expect(await check()).toBe(true);
  });
});
