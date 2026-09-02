import { describe, it, expect } from 'vitest';
import { parseSteamAppId, parseAppManifest, parseLibraryPaths } from './steamApps.js';

describe('parseSteamAppId', () => {
  // Every Steam game registers the same uninstall command -- steam.exe
  // with a protocol URL. The app id in it is the only thing that
  // distinguishes one game's registry entry from another's.
  it('reads the id out of a steam://uninstall URL', () => {
    expect(parseSteamAppId('"C:\\Program Files (x86)\\Steam\\steam.exe" steam://uninstall/230410'))
      .toBe('230410');
    expect(parseSteamAppId('"C:\\Steam\\steam.exe" steam://uninstall/2767030')).toBe('2767030');
  });

  it('is not fooled by a similar-looking command', () => {
    expect(parseSteamAppId('"C:\\Program Files (x86)\\Steam\\uninstall.exe"')).toBeNull();
    expect(parseSteamAppId('steam://rungameid/440')).toBeNull();
    expect(parseSteamAppId('MsiExec.exe /X{GUID}')).toBeNull();
    expect(parseSteamAppId(null)).toBeNull();
  });
});

describe('parseAppManifest', () => {
  const MANIFEST = `"AppState"
{
\t"appid"\t\t"230410"
\t"universe"\t\t"1"
\t"LauncherPath"\t\t"C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe"
\t"name"\t\t"Warframe"
\t"StateFlags"\t\t"4"
\t"installdir"\t\t"Warframe"
\t"SizeOnDisk"\t\t"55032209698"
\t"StagingSize"\t\t"0"
}`;

  it('reads the fields that identify and size an app', () => {
    const app = parseAppManifest(MANIFEST);
    expect(app.appid).toBe('230410');
    expect(app.name).toBe('Warframe');
    expect(app.installdir).toBe('Warframe');
    // 51.3 GB -- Steam's own figure, not a folder walk.
    expect(app.sizeBytes).toBe(55032209698);
  });

  it('handles a size beyond 32 bits', () => {
    const big = MANIFEST.replace('55032209698', '9007199254000');
    expect(parseAppManifest(big).sizeBytes).toBe(9007199254000);
  });

  // A game that is queued or mid-download reports 0, which is not a size
  // worth showing in place of a blank.
  it('returns null for a zero or missing size', () => {
    expect(parseAppManifest(MANIFEST.replace('55032209698', '0')).sizeBytes).toBeNull();
    expect(parseAppManifest('"AppState"\n{\n\t"appid"\t\t"1"\n}').sizeBytes).toBeNull();
  });

  it('returns null for something that is not a manifest', () => {
    expect(parseAppManifest('')).toBeNull();
    expect(parseAppManifest('not a manifest')).toBeNull();
  });
});

describe('parseLibraryPaths', () => {
  const VDF = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"
\t\t"label"\t\t""
\t}
\t"1"
\t{
\t\t"path"\t\t"D:\\\\SteamLibrary"
\t\t"label"\t\t""
\t}
}`;

  // Steam libraries are routinely spread across drives, and a game on the
  // second one has its manifest there, not next to Steam itself.
  it('finds every library path', () => {
    expect(parseLibraryPaths(VDF)).toEqual([
      'C:\\Program Files (x86)\\Steam',
      'D:\\SteamLibrary'
    ]);
  });

  it('unescapes the doubled backslashes the format uses', () => {
    expect(parseLibraryPaths(VDF)[0]).not.toContain('\\\\');
  });

  it('returns an empty list for junk rather than throwing', () => {
    expect(parseLibraryPaths('')).toEqual([]);
    expect(parseLibraryPaths('{ nonsense')).toEqual([]);
  });
});
