import { describe, it, expect, vi, beforeEach } from 'vitest';

// Partial passthrough: only existsSync is faked, so anything else this
// module (or its imports) needs from node:fs keeps working.
const existsSyncMock = vi.fn();
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal()),
  existsSync: (...args) => existsSyncMock(...args)
}));

let assessProgramHealth;
beforeEach(async () => {
  existsSyncMock.mockReset();
  ({ assessProgramHealth } = await import('./programHealth.js'));
});

/** Every path exists except the ones named. */
function allExistExcept(...missing) {
  const lowered = missing.map((p) => p.toLowerCase());
  existsSyncMock.mockImplementation((p) => !lowered.includes(String(p).toLowerCase()));
}

describe('assessProgramHealth', () => {
  it('reports a healthy program as not orphaned', () => {
    allExistExcept();
    const result = assessProgramHealth({
      name: 'Good App',
      uninstallString: '"C:\\Program Files\\Good\\uninstall.exe" /S',
      installLocation: 'C:\\Program Files\\Good'
    });
    expect(result).toEqual({
      orphaned: false,
      uninstallerMissing: false,
      installLocationMissing: false,
      reason: null
    });
  });

  it('flags an entry whose uninstaller executable is gone', () => {
    allExistExcept('C:\\Program Files\\Gone\\uninstall.exe');
    const result = assessProgramHealth({
      name: 'Half-Removed App',
      uninstallString: '"C:\\Program Files\\Gone\\uninstall.exe" /S',
      installLocation: 'C:\\Program Files\\Gone2'
    });
    expect(result.uninstallerMissing).toBe(true);
    expect(result.orphaned).toBe(true);
    expect(result.reason).toMatch(/uninstaller/i);
  });

  it('flags an entry with no uninstall command at all', () => {
    allExistExcept();
    const result = assessProgramHealth({ name: 'Registry Ghost', uninstallString: null, installLocation: null });
    expect(result.orphaned).toBe(true);
    expect(result.reason).toMatch(/no uninstall/i);
  });

  it('does not judge an MSI entry by whether msiexec.exe exists', () => {
    // msiexec always exists, so the exe test is meaningless here -- an MSI
    // entry must never be called healthy on that basis alone.
    allExistExcept();
    const result = assessProgramHealth({
      name: 'MSI App',
      uninstallString: 'MsiExec.exe /X{1234}',
      installLocation: null
    });
    expect(result.uninstallerMissing).toBeNull();
    expect(result.orphaned).toBe(false);
  });

  it('flags an MSI entry whose install directory is gone', () => {
    allExistExcept('C:\\Program Files\\MsiGone');
    const result = assessProgramHealth({
      name: 'MSI App',
      uninstallString: 'MsiExec.exe /X{1234}',
      installLocation: 'C:\\Program Files\\MsiGone'
    });
    expect(result.installLocationMissing).toBe(true);
    expect(result.orphaned).toBe(true);
    expect(result.reason).toMatch(/install folder/i);
  });

  it('leaves installLocationMissing null when the entry never declared one', () => {
    allExistExcept();
    const result = assessProgramHealth({
      name: 'No Location',
      uninstallString: '"C:\\Apps\\u.exe"',
      installLocation: null
    });
    expect(result.installLocationMissing).toBeNull();
    expect(result.orphaned).toBe(false);
  });

  it('tolerates an installLocation wrapped in quotes or with a trailing slash', () => {
    // Both forms appear in the real registry and neither should be
    // mistaken for a missing folder.
    existsSyncMock.mockImplementation((p) => p === 'C:\\Program Files\\Quoted');
    const quoted = assessProgramHealth({
      name: 'Quoted', uninstallString: '"C:\\Program Files\\Quoted\\u.exe"',
      installLocation: '"C:\\Program Files\\Quoted"'
    });
    expect(quoted.installLocationMissing).toBe(false);

    const trailing = assessProgramHealth({
      name: 'Trailing', uninstallString: '"C:\\Program Files\\Quoted\\u.exe"',
      installLocation: 'C:\\Program Files\\Quoted\\'
    });
    expect(trailing.installLocationMissing).toBe(false);
  });

  // Real false positive, found running this against this machine's own
  // registry: winget-managed packages (uv, FFmpeg) register the literal
  // string "winget uninstall", and both got flagged as broken because no
  // file called "winget uninstall" exists. It isn't a path -- it's a
  // command Windows resolves through PATH.
  it('does not call a PATH-resolved command missing just because no such file exists', () => {
    existsSyncMock.mockReturnValue(false);
    for (const uninstallString of ['winget uninstall', 'rundll32.exe setupapi,InstallHinfSection']) {
      const result = assessProgramHealth({ name: 'Winget Package', uninstallString, installLocation: null });
      expect(result.uninstallerMissing, uninstallString).toBeNull();
      expect(result.orphaned, uninstallString).toBe(false);
    }
  });

  it('still checks an absolute uninstaller path, including a UNC one', () => {
    existsSyncMock.mockReturnValue(false);
    expect(assessProgramHealth({ name: 'A', uninstallString: 'C:\\Apps\\u.exe' }).uninstallerMissing).toBe(true);
    expect(assessProgramHealth({ name: 'B', uninstallString: '"\\\\server\\share\\u.exe"' }).uninstallerMissing).toBe(true);
  });

  it('never throws on a garbage uninstall string', () => {
    allExistExcept();
    expect(() => assessProgramHealth({ name: 'Weird', uninstallString: '   ', installLocation: '' })).not.toThrow();
  });
});
