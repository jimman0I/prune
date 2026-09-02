import { describe, it, expect, vi, beforeEach } from 'vitest';

const programs = [
  { id: 'HasVersion', name: 'Already Known', version: '4.2.1', installLocation: 'C:\\Apps\\Known' },
  { id: 'Blank', name: 'Wallpaper Engine', version: '', installLocation: 'C:\\Apps\\Wallpaper' },
  { id: 'Placeholder', name: 'Rainbow Six', version: '', installLocation: 'C:\\Apps\\R6' },
  { id: 'Nothing', name: 'No Folder', version: '' }
];

function mockDeps(versions) {
  vi.doMock('./findMainExecutable.js', () => ({
    findMainExecutable: async (folder) => `${folder}\\app.exe`
  }));
  vi.doMock('./steamApps.js', () => ({
    getSteamApps: async () => ({}),
    parseSteamAppId: () => null,
    steamRootFrom: () => null
  }));
  vi.doMock('./gogApps.js', () => ({ getGogApps: async () => [] }));
  vi.doMock('./powershell.js', () => ({
    runPowerShellJson: async () => versions
  }));
}

describe('getProgramVersions', () => {
  beforeEach(() => { vi.resetModules(); });

  it('fills in only the programs the registry left blank', async () => {
    mockDeps([
      { path: 'C:\\Apps\\Wallpaper\\app.exe', fileVersion: '2.8.0.42', productVersion: '2.8.0.42' },
      { path: 'C:\\Apps\\R6\\app.exe', fileVersion: '9.9.9', productVersion: '9.9.9' }
    ]);
    const { getProgramVersions } = await import('./programVersions.js');
    const versions = await getProgramVersions(programs);

    expect(versions.Blank).toBe('2.8.0.42');
    // A program that already reports a version is never looked up: the
    // registry value is what the vendor declared, and replacing figures
    // the user has already read is a change nobody asked for.
    expect(versions.HasVersion).toBeUndefined();
  });

  it('drops a version the file reports but nobody can use', async () => {
    mockDeps([
      { path: 'C:\\Apps\\Wallpaper\\app.exe', fileVersion: '1.0.0.0', productVersion: '1.0.0.0' },
      { path: 'C:\\Apps\\R6\\app.exe', fileVersion: '6a95c09f1c731857808b405d', productVersion: '' }
    ]);
    const { getProgramVersions } = await import('./programVersions.js');
    const versions = await getProgramVersions(programs);

    expect(versions.Blank).toBeUndefined();
    expect(versions.Placeholder).toBeUndefined();
  });

  it('falls back to the product version when the file version is empty', async () => {
    mockDeps([
      { path: 'C:\\Apps\\Wallpaper\\app.exe', fileVersion: '', productVersion: '3.1.0' }
    ]);
    const { getProgramVersions } = await import('./programVersions.js');
    expect((await getProgramVersions(programs)).Blank).toBe('3.1.0');
  });

  it('leaves a program with nowhere to look alone', async () => {
    mockDeps([]);
    const { getProgramVersions } = await import('./programVersions.js');
    expect((await getProgramVersions(programs)).Nothing).toBeUndefined();
  });

  it('returns what it has rather than throwing when PowerShell fails', async () => {
    vi.doMock('./findMainExecutable.js', () => ({
      findMainExecutable: async (folder) => `${folder}\\app.exe`
    }));
    vi.doMock('./steamApps.js', () => ({
      getSteamApps: async () => ({}),
      parseSteamAppId: () => null,
      steamRootFrom: () => null
    }));
    vi.doMock('./gogApps.js', () => ({ getGogApps: async () => [] }));
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => { throw new Error('powershell unavailable'); }
    }));
    const { getProgramVersions } = await import('./programVersions.js');
    expect(await getProgramVersions(programs)).toEqual({});
  });

  it('handles a single result coming back as a bare object', async () => {
    // ConvertTo-Json collapses a one-element array, which has already
    // broken this project's disk query once.
    mockDeps({ path: 'C:\\Apps\\Wallpaper\\app.exe', fileVersion: '2.8.0.42', productVersion: '' });
    const { getProgramVersions } = await import('./programVersions.js');
    expect((await getProgramVersions(programs)).Blank).toBe('2.8.0.42');
  });
});

describe('the file a version is read from', () => {
  beforeEach(() => { vi.resetModules(); });

  // Found by checking the sources against the list (2026-09-03). The icon
  // ladder happily reads from an uninstaller -- vendors usually give it
  // the application's own icon on purpose -- but its VERSION belongs to
  // the uninstaller, which is a different program. On this machine that
  // handed Ubisoft's anti-cheat its uninstaller's 5.0.2.0, gave a Windows
  // shim database sdbinst.exe's 10.0.26100.8457 (that is Windows' build
  // number), and reported Roblox as 1.6.3.172 -- the bootstrapper --
  // while the player itself reports 0.734.0.7340917.
  it('never reads a version out of an installer or uninstaller', async () => {
    vi.doMock('./findMainExecutable.js', () => ({ findMainExecutable: async () => null }));
    vi.doMock('./steamApps.js', () => ({
      getSteamApps: async () => ({}), parseSteamAppId: () => null, steamRootFrom: () => null
    }));
    vi.doMock('./gogApps.js', () => ({ getGogApps: async () => [] }));
    const asked = [];
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async (script) => { asked.push(script); return []; }
    }));

    const { getProgramVersions } = await import('./programVersions.js');
    await getProgramVersions([
      { id: 'a', name: 'Anti-Cheat', version: '', displayIcon: 'C:\\Apps\\Sentinel\\Uninstall.exe' },
      { id: 'b', name: 'Roblox', version: '', displayIcon: 'C:\\Apps\\Roblox\\RobloxPlayerInstaller.exe' },
      { id: 'c', name: 'OpenAL', version: '', displayIcon: 'C:\\Apps\\OpenAL\\oalinst.exe' },
      { id: 'd', name: 'Canon', version: '', displayIcon: 'C:\\CanonIJ Uninstaller Information\\x\\DELDRV64.exe' },
      {
        id: 'e',
        name: 'Compat DB',
        version: '',
        uninstallString: 'C:\\WINDOWS\\system32\\sdbinst.exe -u "C:\\x.sdb"'
      }
    ]);

    // Nothing was worth asking about, so PowerShell was never run at all.
    expect(asked).toHaveLength(0);
  });

  it('still reads the vendor DisplayIcon when it points at the real binary', async () => {
    vi.doMock('./findMainExecutable.js', () => ({ findMainExecutable: async () => null }));
    vi.doMock('./steamApps.js', () => ({
      getSteamApps: async () => ({}), parseSteamAppId: () => null, steamRootFrom: () => null
    }));
    vi.doMock('./gogApps.js', () => ({ getGogApps: async () => [] }));
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => [{ path: 'C:\\Apps\\7-Zip\\7zFM.exe', fileVersion: '25.01', productVersion: '' }]
    }));
    const { getProgramVersions } = await import('./programVersions.js');
    const versions = await getProgramVersions([
      { id: 'z', name: '7-Zip', version: '', displayIcon: 'C:\\Apps\\7-Zip\\7zFM.exe,0' }
    ]);
    expect(versions.z).toBe('25.01');
  });
});

describe('a launcher that records its own version', () => {
  beforeEach(() => { vi.resetModules(); });

  // GOG is the only launcher here that writes a version. It beats reading
  // a binary, because it is the number GOG itself shows and therefore the
  // one the user will compare against.
  it('prefers the GOG record over the binary', async () => {
    vi.doMock('./findMainExecutable.js', () => ({
      findMainExecutable: async (folder) => `${folder}\app.exe`
    }));
    vi.doMock('./steamApps.js', () => ({
      getSteamApps: async () => ({}), parseSteamAppId: () => null, steamRootFrom: () => null
    }));
    vi.doMock('./gogApps.js', () => ({
      getGogApps: async () => [
        { name: 'Witcher 3', version: '4.0.0.1', installLocation: 'D:\GOG\Witcher 3' }
      ]
    }));
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => [{ path: 'D:\GOG\Witcher 3\app.exe', fileVersion: '1.2.3', productVersion: '' }]
    }));

    const { getProgramVersions } = await import('./programVersions.js');
    const versions = await getProgramVersions([
      { id: 'w', name: 'Witcher 3', version: '', installLocation: 'D:\GOG\Witcher 3' }
    ]);
    expect(versions.w).toBe('4.0.0.1');
  });
});
