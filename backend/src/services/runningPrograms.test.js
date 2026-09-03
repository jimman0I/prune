import { describe, it, expect } from 'vitest';
import { matchRunningPrograms, ownerFolders } from './runningPrograms.js';

describe('matchRunningPrograms', () => {
  const owners = [
    { id: 'steam', folder: 'C:\\Program Files (x86)\\Steam' },
    { id: 'warframe', folder: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Warframe' },
    { id: 'brave', folder: 'C:\\Program Files\\BraveSoftware\\Brave-Browser' }
  ];

  it('matches a process to the program it runs from', () => {
    const running = matchRunningPrograms(
      [{ name: 'brave', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' }],
      owners
    );
    expect(running.brave.count).toBe(1);
    expect(running.brave.names).toEqual(['brave']);
  });

  // The whole trick. Warframe's launcher lives inside Steam's folder too,
  // so a shortest- or first-match would report "Steam is running" for
  // every game installed through it.
  it('attributes a nested folder to the more specific program', () => {
    const running = matchRunningPrograms(
      [{ name: 'Launcher', path: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Warframe\\Tools\\Launcher.exe' }],
      owners
    );
    expect(running.warframe.count).toBe(1);
    expect(running.steam).toBeUndefined();
  });

  it('still matches Steam itself', () => {
    const running = matchRunningPrograms(
      [{ name: 'steamwebhelper', path: 'C:\\Program Files (x86)\\Steam\\bin\\cef\\cef.win64\\steamwebhelper.exe' }],
      owners
    );
    expect(running.steam.count).toBe(1);
  });

  it('counts every process but names each one once', () => {
    // A browser is thirty processes. "brave" is the fact; "brave x30" is
    // noise.
    const running = matchRunningPrograms(
      [
        { name: 'brave', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' },
        { name: 'brave', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' },
        { name: 'brave', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' }
      ],
      owners
    );
    expect(running.brave.count).toBe(3);
    expect(running.brave.names).toEqual(['brave']);
  });

  it('does not match a folder that merely shares a prefix', () => {
    // "Brave-Browser2" is not inside "Brave-Browser".
    const running = matchRunningPrograms(
      [{ name: 'other', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser2\\app.exe' }],
      owners
    );
    expect(running).toEqual({});
  });

  it('matches across separator styles', () => {
    // The registry mixes forward and back slashes between entries.
    const running = matchRunningPrograms(
      [{ name: 'brave', path: 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe' }],
      [{ id: 'brave', folder: 'C:\\Program Files\\BraveSoftware\\Brave-Browser' }]
    );
    expect(running.brave.count).toBe(1);
  });

  it('ignores processes and owners with nothing usable', () => {
    expect(matchRunningPrograms([{ name: 'x' }], owners)).toEqual({});
    expect(matchRunningPrograms(null, owners)).toEqual({});
    expect(matchRunningPrograms([{ name: 'x', path: 'C:\\a\\b.exe' }], null)).toEqual({});
  });
});

describe('ownerFolders', () => {
  it('uses InstallLocation where a program has one', () => {
    const owners = ownerFolders([{ id: 'a', installLocation: 'C:\\Apps\\A' }], [], {});
    expect(owners).toEqual([{ id: 'a', folder: 'C:\\Apps\\A' }]);
  });

  it('falls back to the Steam manifest folder for a Steam game', () => {
    // Steam games record no InstallLocation at all.
    const owners = ownerFolders(
      [{ id: 'wf', uninstallString: '"C:\\Steam\\steam.exe" steam://uninstall/230410' }],
      [],
      { 230410: { path: 'C:\\Steam\\steamapps\\common\\Warframe' } }
    );
    expect(owners).toEqual([{ id: 'wf', folder: 'C:\\Steam\\steamapps\\common\\Warframe' }]);
  });

  it('includes Store apps, which record their package folder', () => {
    const owners = ownerFolders([], [{ id: 'store:x', installLocation: 'C:\\WindowsApps\\X' }], {});
    expect(owners).toEqual([{ id: 'store:x', folder: 'C:\\WindowsApps\\X' }]);
  });

  // The uninstaller's folder is a guess even for sizing. Here it would put
  // every Steam game's processes under Steam itself.
  // Steam's own entry records no InstallLocation, so without this the one
  // program most likely to be running while someone tries to remove it
  // was the one program that could never be detected.
  it('falls back to the uninstaller folder when only one program uses it', () => {
    const owners = ownerFolders(
      [{ id: 'steam', uninstallString: '"C:\\Program Files (x86)\\Steam\\uninstall.exe"' }],
      [],
      {}
    );
    expect(owners).toEqual([{ id: 'steam', folder: 'C:\\Program Files (x86)\\Steam' }]);
  });

  // A folder several entries point at is a launcher's directory, not any
  // one program's -- the same rule the sizing already applies.
  it('refuses a folder more than one program falls back to', () => {
    const owners = ownerFolders(
      [
        { id: 'a', uninstallString: '"C:\\Shared\\uninstall.exe" /a' },
        { id: 'b', uninstallString: '"C:\\Shared\\uninstall.exe" /b' }
      ],
      [],
      {}
    );
    expect(owners).toEqual([]);
  });
});
