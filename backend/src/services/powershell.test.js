import { describe, it, expect, vi, beforeEach } from 'vitest';

const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({ execFile: (...args) => execFileMock(...args) }));

let runPowerShellJson;
beforeEach(async () => {
  execFileMock.mockReset();
  ({ runPowerShellJson } = await import('./powershell.js'));
});

describe('runPowerShellJson', () => {
  it('parses valid JSON stdout', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, '{"a":1}', ''));
    const result = await runPowerShellJson('Get-Something | ConvertTo-Json');
    expect(result).toEqual({ a: 1 });
  });

  it('resolves null for empty stdout (no matches)', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, '   ', ''));
    const result = await runPowerShellJson('Get-Nothing | ConvertTo-Json');
    expect(result).toBeNull();
  });

  it('rejects with a clear message on non-JSON stdout', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, 'not json', ''));
    await expect(runPowerShellJson('bad')).rejects.toThrow(/non-JSON/);
  });

  it('retries once on failure before succeeding', async () => {
    execFileMock
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(new Error('boom'), '', 'stderr text'))
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(null, '{"ok":true}', ''));
    const result = await runPowerShellJson('script', { retries: 1 });
    expect(result).toEqual({ ok: true });
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with a clear message after exhausting retries', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(new Error('boom'), '', 'stderr text'));
    await expect(runPowerShellJson('script', { retries: 0 })).rejects.toThrow(/PowerShell command failed/);
  });
});