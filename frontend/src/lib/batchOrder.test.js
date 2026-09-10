import { describe, it, expect } from 'vitest';
import { uninstallerExecutable, delegates, ownFolder, orderBatch } from './batchOrder.js';

/** The order a batch uninstall runs in.
 *
 * It used to run in selection order, whatever that happened to be. That
 * is fine until a batch contains a launcher AND something that uninstalls
 * through it: Marvel Rivals' uninstall command is steam.exe with a
 * steam:// URL, so removing Steam first leaves the game with an
 * uninstaller that no longer exists -- it fails, and becomes the orphan
 * the Broken filter exists to find.
 *
 * Every fixture below is a real uninstall entry from the dev machine,
 * copied verbatim, including Overwolf's doubled backslash. The rule was
 * checked against all 345 entries there before any of this was written:
 * 8 programs delegate, 8 host relationships, 0 cycles.
 *
 * Getting the DIRECTION right is most of the work. A first version that
 * compared folders found the Steam games -- and also concluded that Steam
 * depended on Marvel Rivals, because both live in Steam's folder. A second
 * produced Brave <-> Instagram and Overwolf <-> AlecaFrame. The asymmetry
 * that held up is in the arguments: a dependent names ONE specific app to
 * someone else's executable, and the host's own uninstaller does not.
 */

// Real entries from the dev machine's uninstall registry.
const steam = {
  id: 'steam', name: 'Steam', installLocation: null,
  uninstallString: 'C:\\Program Files (x86)\\Steam\\uninstall.exe'
};
const marvel = {
  id: 'mr', name: 'Marvel Rivals', installLocation: null,
  uninstallString: '"C:\\Program Files (x86)\\Steam\\steam.exe" steam://uninstall/2767030'
};
const warframe = {
  id: 'wf', name: 'Warframe', installLocation: null,
  uninstallString: '"C:\\Program Files (x86)\\Steam\\steam.exe" steam://uninstall/230410'
};
const ubisoft = {
  id: 'ubi', name: 'Ubisoft Connect',
  installLocation: 'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\',
  uninstallString: 'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\Uninstall.exe'
};
const siege = {
  id: 'r6', name: "Tom Clancy's Rainbow Six Siege", installLocation: null,
  uninstallString: '"C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\upc.exe" uplay://uninstall/635'
};
// Overwolf's registry entry really does double the last backslash.
const overwolf = {
  id: 'ow', name: 'Overwolf', installLocation: 'C:\\Program Files (x86)\\Overwolf\\',
  uninstallString: '"C:\\Program Files (x86)\\Overwolf\\\\OWUninstaller.exe" /S'
};
const alecaframe = {
  id: 'af', name: 'AlecaFrame', installLocation: null,
  uninstallString: 'C:\\Program Files (x86)\\Overwolf\\OWUninstaller.exe --uninstall-app=afmcagbpgggkpdkokjhjkllpegnadmkignlonpjm'
};
const brave = {
  id: 'brave', name: 'Brave',
  installLocation: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application',
  uninstallString: '"C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\152.1.94.121\\Installer\\setup.exe" --uninstall --system-level'
};
const instagram = {
  id: 'ig', name: 'Instagram', installLocation: null,
  uninstallString: '"C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" --profile-directory=Default --uninstall-app-id=akpamiohjfcnimfljfndmaldlcfphjmp'
};
const sevenZip = {
  id: '7z', name: '7-Zip', installLocation: 'C:\\Program Files\\7-Zip\\',
  uninstallString: '"C:\\Program Files\\7-Zip\\Uninstall.exe"'
};
const msi = { id: 'msi', name: 'Some MSI', installLocation: null, uninstallString: 'MsiExec.exe /X{GUID}' };

const ids = (list) => list.map((p) => p.id);

describe('reading the executable out of an uninstall command', () => {
  /* Ported from backend/src/services/uninstallerPath.js, whose tests these
   * mirror. There is no shared package between the two halves of the app,
   * and ten lines of parsing are cheaper to keep in step than to share. */
  it('takes a quoted path and drops what follows it', () => {
    expect(uninstallerExecutable('"C:\\Program Files\\App\\uninstall.exe" /S'))
      .toBe('c:\\program files\\app\\uninstall.exe');
  });

  it('keeps spaces in an unquoted path, cutting only at a real switch', () => {
    expect(uninstallerExecutable('C:\\Program Files (x86)\\Overwolf\\OWUninstaller.exe --uninstall-app=abc'))
      .toBe('c:\\program files (x86)\\overwolf\\owuninstaller.exe');
  });

  it('cuts an unquoted path at a URL-scheme argument too', () => {
    expect(uninstallerExecutable('C:\\Launcher\\launch.exe steam://uninstall/1'))
      .toBe('c:\\launcher\\launch.exe');
  });

  it('collapses doubled separators, which a real entry contains', () => {
    // Overwolf's own uninstall string. Without this, the same file on disk
    // compares unequal to itself depending on which entry named it.
    expect(uninstallerExecutable(overwolf.uninstallString))
      .toBe('c:\\program files (x86)\\overwolf\\owuninstaller.exe');
  });

  it('returns null for nothing', () => {
    expect(uninstallerExecutable('')).toBeNull();
    expect(uninstallerExecutable(null)).toBeNull();
  });
});

describe('which programs uninstall through someone else', () => {
  it('recognises a URL-scheme handoff', () => {
    expect(delegates(marvel.uninstallString)).toBe(true);
    expect(delegates(siege.uninstallString)).toBe(true);
  });

  it('recognises an argument that names one specific app', () => {
    expect(delegates(alecaframe.uninstallString)).toBe(true);
    expect(delegates(instagram.uninstallString)).toBe(true);
  });

  it('does not count a host\'s own uninstaller, whatever flags it takes', () => {
    /* The asymmetry. Brave's uninstaller takes --uninstall and
     * --system-level, which look like the kind of thing a dependent
     * passes, and a rule keyed on "has flags" would make Brave depend on
     * its own web apps. */
    expect(delegates(brave.uninstallString)).toBe(false);
    expect(delegates(steam.uninstallString)).toBe(false);
    expect(delegates(overwolf.uninstallString)).toBe(false);
    expect(delegates(sevenZip.uninstallString)).toBe(false);
  });
});

describe('a program\'s own folder', () => {
  it('is its InstallLocation when it has one', () => {
    expect(ownFolder(ubisoft)).toBe('c:\\program files (x86)\\ubisoft\\ubisoft game launcher');
  });

  it('is the folder of its own uninstaller when it has none', () => {
    // Steam records no InstallLocation at all -- which is why the first
    // measurement missed every Steam game.
    expect(ownFolder(steam)).toBe('c:\\program files (x86)\\steam');
  });

  it('is unknown for a program that delegates, rather than the host\'s folder', () => {
    /* The bug that produced "Steam depends on Marvel Rivals". Marvel
     * Rivals' uninstaller lives in Steam's folder, so deriving its folder
     * from its uninstaller hands it Steam's -- and then Steam's own
     * uninstaller appears to live inside Marvel Rivals. */
    expect(ownFolder(marvel)).toBeNull();
    expect(ownFolder(instagram)).toBeNull();
  });

  it('is unknown for an MSI entry, whose uninstaller is Windows\' own', () => {
    expect(ownFolder(msi)).toBeNull();
  });
});

describe('the order a batch runs in', () => {
  it('runs a game before the launcher it uninstalls through', () => {
    const { ordered, runsBefore } = orderBatch([steam, marvel]);

    expect(ids(ordered)).toEqual(['mr', 'steam']);
    expect(runsBefore).toEqual({ mr: 'Steam' });
  });

  it('runs every Steam game before Steam, keeping their own order', () => {
    const { ordered } = orderBatch([steam, warframe, marvel]);
    expect(ids(ordered)).toEqual(['wf', 'mr', 'steam']);
  });

  it('finds a host through its InstallLocation', () => {
    expect(ids(orderBatch([ubisoft, siege]).ordered)).toEqual(['r6', 'ubi']);
  });

  it('finds a host whose folder comes from a doubled-backslash uninstaller', () => {
    /* The normalisation test that is not vacuous. Overwolf WITH its
     * InstallLocation would be found without collapsing anything; this is
     * Overwolf with only its real, doubled uninstaller path to go on. */
    const bareOverwolf = { ...overwolf, installLocation: null };
    expect(ids(orderBatch([bareOverwolf, alecaframe]).ordered)).toEqual(['af', 'ow']);
  });

  it('compares paths without regard to case', () => {
    const shouty = { ...steam, uninstallString: 'C:\\PROGRAM FILES (X86)\\STEAM\\uninstall.exe' };
    expect(ids(orderBatch([shouty, marvel]).ordered)).toEqual(['mr', 'steam']);
  });

  it('never makes a host depend on its own dependent', () => {
    // Already in the right order, it stays; the reverse edge that the
    // second draft produced would have flipped it.
    expect(ids(orderBatch([instagram, brave]).ordered)).toEqual(['ig', 'brave']);
    expect(ids(orderBatch([marvel, steam]).ordered)).toEqual(['mr', 'steam']);
    expect(orderBatch([marvel, steam]).runsBefore.steam).toBeUndefined();
  });

  it('leaves a batch with no relationships exactly as selected', () => {
    const { ordered, runsBefore } = orderBatch([sevenZip, msi, brave]);
    expect(ids(ordered)).toEqual(['7z', 'msi', 'brave']);
    expect(runsBefore).toEqual({});
  });

  it('ignores a dependent whose host is not in the batch', () => {
    // Removing Marvel Rivals alone needs Steam present, and it is -- it
    // just is not being removed. Nothing to reorder.
    const { ordered, runsBefore } = orderBatch([sevenZip, marvel]);
    expect(ids(ordered)).toEqual(['7z', 'mr']);
    expect(runsBefore).toEqual({});
  });

  it('moves only what has to move', () => {
    // Unrelated programs keep their relative places around the pair.
    expect(ids(orderBatch([sevenZip, steam, msi, marvel]).ordered))
      .toEqual(['7z', 'msi', 'mr', 'steam']);
  });

  it('returns every program exactly once, even if the data contains a cycle', () => {
    /* The real data has none, and the rule is built so that it cannot.
     * But this decides the order of destructive operations, and a
     * topological sort that met a cycle it did not expect must neither
     * hang nor drop a program from the batch. */
    const a = { id: 'a', name: 'A', installLocation: 'C:\\A', uninstallString: '"C:\\B\\b.exe" --uninstall-app=a' };
    const b = { id: 'b', name: 'B', installLocation: 'C:\\B', uninstallString: '"C:\\A\\a.exe" --uninstall-app=b' };
    const { ordered, runsBefore } = orderBatch([a, b, sevenZip]);

    expect(ordered).toHaveLength(3);
    expect(new Set(ids(ordered))).toEqual(new Set(['a', 'b', '7z']));

    /* And it must not claim an order it did not keep. In a cycle each of
     * the pair "runs before" the other, so at most one of those claims can
     * be true of the final order -- and telling the user a program runs
     * before one it actually runs after is worse than saying nothing. */
    const position = (id) => ids(ordered).indexOf(id);
    const hostId = { A: 'a', B: 'b' };
    for (const [dependentId, hostName] of Object.entries(runsBefore)) {
      expect(position(dependentId)).toBeLessThan(position(hostId[hostName]));
    }
  });

  it('copes with nothing', () => {
    expect(orderBatch([])).toEqual({ ordered: [], runsBefore: {} });
    expect(orderBatch(null)).toEqual({ ordered: [], runsBefore: {} });
  });
});
