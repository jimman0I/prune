import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let getStartupDetails, cleanDetail;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ getStartupDetails, cleanDetail } = await import('./startupDetails.js'));
});

describe('cleanDetail', () => {
  it('keeps a real value', () => {
    expect(cleanDetail('Realtek Semiconductor')).toBe('Realtek Semiconductor');
  });

  it('is null for a field the file does not carry', () => {
    // An empty string on screen looks like a bug; a dash reads as absence.
    expect(cleanDetail('')).toBeNull();
    expect(cleanDetail('   ')).toBeNull();
    expect(cleanDetail(null)).toBeNull();
    expect(cleanDetail(undefined)).toBeNull();
  });

  it('strips control characters rather than printing them', () => {
    expect(cleanDetail('NVIDIA\u0000 Broadcast')).toBe('NVIDIA  Broadcast');
  });
});

describe('getStartupDetails', () => {
  it('never runs PowerShell for an empty list', async () => {
    expect(await getStartupDetails([])).toEqual({});
    expect(await getStartupDetails(null)).toEqual({});
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });

  it('asks about each path once', async () => {
    // The same executable behind two Run values is one file, and asking
    // twice costs a Get-Item for no new information.
    runPowerShellJsonMock.mockResolvedValueOnce({});
    await getStartupDetails(['C:\\a.exe', 'C:\\a.exe', 'C:\\b.exe']);
    const script = runPowerShellJsonMock.mock.calls[0][0];
    expect(script.match(/C:\\\\a\.exe/g) ?? script.match(/a\.exe/g)).toHaveLength(1);
  });

  it('ignores blanks in the list', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({});
    await getStartupDetails(['', '   ', null, undefined, 'C:\\real.exe']);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain('real.exe');
  });

  it('reads description, publisher and running state back', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({
      'C:\\rtk.exe': { description: 'Realtek Audio Service', publisher: 'Realtek Semiconductor', running: true }
    });
    expect(await getStartupDetails(['C:\\rtk.exe'])).toEqual({
      'C:\\rtk.exe': { description: 'Realtek Audio Service', publisher: 'Realtek Semiconductor', running: true }
    });
  });

  it('turns a missing field into null rather than an empty string', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({
      'C:\\bare.exe': { description: '', publisher: '   ', running: false }
    });
    expect(await getStartupDetails(['C:\\bare.exe'])).toEqual({
      'C:\\bare.exe': { description: null, publisher: null, running: false }
    });
  });

  it('treats anything other than an explicit true as not running', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({ 'C:\\x.exe': { running: 'yes' } });
    expect((await getStartupDetails(['C:\\x.exe']))['C:\\x.exe'].running).toBe(false);
  });

  it('escapes an apostrophe in a path instead of breaking the script', async () => {
    // "C:\Users\O'Brien\app.exe" would otherwise close the PowerShell
    // string early and turn the rest of the array into syntax.
    runPowerShellJsonMock.mockResolvedValueOnce({});
    await getStartupDetails(["C:\\Users\\O'Brien\\app.exe"]);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain("O''Brien");
  });

  it('degrades to an empty map rather than taking the list down with it', async () => {
    // The names and commands are already known and are the load-bearing
    // part. Dashes in three columns beat an empty screen.
    runPowerShellJsonMock.mockRejectedValueOnce(new Error('powershell died'));
    expect(await getStartupDetails(['C:\\a.exe'])).toEqual({});
  });

  it('copes with a non-object result', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce(null);
    expect(await getStartupDetails(['C:\\a.exe'])).toEqual({});
  });
});
