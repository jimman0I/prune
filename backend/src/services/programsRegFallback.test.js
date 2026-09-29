import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellTextMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellText: (...args) => runPowerShellTextMock(...args) }));

let listInstalledProgramsViaReg, parseRegQueryOutput;
beforeEach(async () => {
  runPowerShellTextMock.mockReset();
  ({ listInstalledProgramsViaReg, parseRegQueryOutput } = await import('./programsRegFallback.js'));
});

// Captured live from `reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s`
// on a real machine (2026-09-29) -- not hand-written, the actual column
// spacing reg.exe prints.
const REAL_SAMPLE = [
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip',
  '    DisplayName    REG_SZ    7-Zip 25.01 (x64)',
  '    DisplayVersion    REG_SZ    25.01',
  '    DisplayIcon    REG_SZ    C:\\Program Files\\7-Zip\\7zFM.exe',
  '    InstallLocation    REG_SZ    C:\\Program Files\\7-Zip\\',
  '    UninstallString    REG_SZ    "C:\\Program Files\\7-Zip\\Uninstall.exe"',
  '    QuietUninstallString    REG_SZ    "C:\\Program Files\\7-Zip\\Uninstall.exe" /S',
  '    NoModify    REG_DWORD    0x1',
  '    NoRepair    REG_DWORD    0x1',
  '    EstimatedSize    REG_DWORD    0x167e',
  '    VersionMajor    REG_DWORD    0x19',
  '    VersionMinor    REG_DWORD    0x1',
  '    Publisher    REG_SZ    Igor Pavlov',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AddressBook',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{HiddenHelper}',
  '    DisplayName    REG_SZ    Background Helper',
  '    SystemComponent    REG_DWORD    0x1'
].join('\r\n');

describe('parseRegQueryOutput', () => {
  it('parses a real reg.exe /s block into the shape normalizeProgram expects', () => {
    const result = parseRegQueryOutput(REAL_SAMPLE);
    expect(result).toEqual([
      {
        id: '7-Zip',
        name: '7-Zip 25.01 (x64)',
        publisher: 'Igor Pavlov',
        version: '25.01',
        installDate: undefined,
        estimatedSizeKb: 0x167e,
        uninstallString: '"C:\\Program Files\\7-Zip\\Uninstall.exe"',
        installLocation: 'C:\\Program Files\\7-Zip\\',
        quietUninstallString: '"C:\\Program Files\\7-Zip\\Uninstall.exe" /S',
        psPath: 'Microsoft.PowerShell.Core\\Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip',
        displayIcon: 'C:\\Program Files\\7-Zip\\7zFM.exe',
        urlInfoAbout: undefined,
        helpLink: undefined
      }
    ]);
  });

  it('skips a subkey with no DisplayName (a bare container key, not a program)', () => {
    const result = parseRegQueryOutput(REAL_SAMPLE);
    expect(result.find((p) => p.id === 'AddressBook')).toBeUndefined();
  });

  it('skips a SystemComponent entry the same way Get-ItemProperty does', () => {
    const result = parseRegQueryOutput(REAL_SAMPLE);
    expect(result.find((p) => p.name === 'Background Helper')).toBeUndefined();
  });

  it('returns an empty array for empty input', () => {
    expect(parseRegQueryOutput('')).toEqual([]);
    expect(parseRegQueryOutput('   ')).toEqual([]);
  });

  it('reads an HKEY_CURRENT_USER key correctly', () => {
    const text = [
      'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PerUserApp',
      '    DisplayName    REG_SZ    Per-User App'
    ].join('\r\n');
    const [program] = parseRegQueryOutput(text);
    expect(program.id).toBe('PerUserApp');
    expect(program.psPath).toBe(
      'Microsoft.PowerShell.Core\\Registry::HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PerUserApp'
    );
  });
});

describe('listInstalledProgramsViaReg', () => {
  it('returns an empty array when reg.exe produces no output', async () => {
    runPowerShellTextMock.mockResolvedValue('');
    expect(await listInstalledProgramsViaReg()).toEqual([]);
  });

  it('queries all three Uninstall hives', async () => {
    runPowerShellTextMock.mockResolvedValue('');
    await listInstalledProgramsViaReg();
    const script = runPowerShellTextMock.mock.calls[0][0];
    expect(script).toContain('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
    expect(script).toContain('HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
    expect(script).toContain('HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
  });

  it('parses a real result end to end', async () => {
    runPowerShellTextMock.mockResolvedValue(REAL_SAMPLE);
    const result = await listInstalledProgramsViaReg();
    expect(result.map((p) => p.name)).toEqual(['7-Zip 25.01 (x64)']);
  });
});
