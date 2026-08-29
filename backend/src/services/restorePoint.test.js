import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let tryCreateRestorePoint;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ tryCreateRestorePoint } = await import('./restorePoint.js'));
});

describe('tryCreateRestorePoint', () => {
  it('returns created:true when the checkpoint succeeds', async () => {
    runPowerShellJsonMock.mockResolvedValue({ created: true });
    expect(await tryCreateRestorePoint('Uninstall OldApp')).toEqual({ created: true });
  });

  it('returns created:false with a reason when PowerShell reports failure (e.g. throttled)', async () => {
    runPowerShellJsonMock.mockResolvedValue({ created: false, reason: 'System Restore points can only be created once every 24 hours.' });
    const result = await tryCreateRestorePoint('Uninstall OldApp');
    expect(result.created).toBe(false);
    expect(result.reason).toMatch(/24 hours/);
  });

  it('never throws — a PowerShell exec failure degrades to created:false', async () => {
    runPowerShellJsonMock.mockRejectedValue(new Error('powershell.exe not found'));
    const result = await tryCreateRestorePoint('Uninstall OldApp');
    expect(result).toEqual({ created: false, reason: 'powershell.exe not found' });
  });
});