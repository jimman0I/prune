import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getProgramSizes, clearSizeCache } from './programSizes.js';

let root;
beforeEach(async () => {
  clearSizeCache();
  root = await mkdtemp(join(tmpdir(), 'prune-sizes-'));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function file(relative, bytes) {
  const full = join(root, relative);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, Buffer.alloc(bytes));
}

describe('getProgramSizes', () => {
  it('measures a program whose registry entry has no size', async () => {
    await file(join('AppA', 'data.bin'), 4096);
    const sizes = await getProgramSizes([
      { id: 'a', sizeBytes: null, installLocation: join(root, 'AppA') }
    ]);
    expect(sizes.a).toBe(4096);
  });

  it('leaves a program that already reports a size alone', async () => {
    await file(join('AppB', 'data.bin'), 4096);
    const sizes = await getProgramSizes([
      { id: 'b', sizeBytes: 999, installLocation: join(root, 'AppB') }
    ]);
    expect(sizes.b).toBeUndefined();
  });

  // The case that makes this worth doing carefully. On this machine
  // Ubisoft Connect measured 55.14 GB and Rainbow Six Siege 54.69 GB,
  // because the game sits inside the launcher's folder -- so the same
  // bytes appeared twice and the column summed past the drive's capacity.
  it('does not count a nested program\'s bytes against the folder above it', async () => {
    await file(join('Launcher', 'launcher.bin'), 1000);
    await file(join('Launcher', 'Games', 'Big', 'game.bin'), 90000);

    const sizes = await getProgramSizes([
      { id: 'launcher', sizeBytes: null, installLocation: join(root, 'Launcher') },
      { id: 'game', sizeBytes: null, installLocation: join(root, 'Launcher', 'Games', 'Big') }
    ]);

    expect(sizes.launcher).toBe(1000);
    expect(sizes.game).toBe(90000);
  });

  // The nested program usually reports its own size perfectly well, and
  // that's exactly when the outer one must still not re-count it.
  it('excludes a nested folder even when that program already had a size', async () => {
    await file(join('Launcher2', 'own.bin'), 500);
    await file(join('Launcher2', 'Game', 'huge.bin'), 70000);

    const sizes = await getProgramSizes([
      { id: 'launcher', sizeBytes: null, installLocation: join(root, 'Launcher2') },
      { id: 'game', sizeBytes: 70000, installLocation: join(root, 'Launcher2', 'Game') }
    ]);

    expect(sizes.launcher).toBe(500);
  });

  // The real reason the first version of this didn't work. The registry
  // mixes separator styles between entries: Ubisoft Connect records its
  // location with backslashes, and Rainbow Six Siege -- installed inside
  // it -- records "C:/Program Files (x86)/Ubisoft/..." with forward
  // slashes. Compared raw the nested folder doesn't look nested, so the
  // exclusion silently did nothing and both rows claimed 54.69 GB.
  it('sees a nested folder recorded with the other separator style', async () => {
    await file(join('Mixed', 'own.bin'), 700);
    await file(join('Mixed', 'Inner', 'big.bin'), 50000);

    const sizes = await getProgramSizes([
      { id: 'outer', sizeBytes: null, installLocation: join(root, 'Mixed') },
      { id: 'inner', sizeBytes: null, installLocation: `${join(root, 'Mixed').replace(/\\/g, '/')}/Inner/` }
    ]);

    expect(sizes.outer).toBe(700);
    expect(sizes.inner).toBe(50000);
  });

  it('omits a program with no safe folder to measure', async () => {
    const sizes = await getProgramSizes([
      { id: 'msi', sizeBytes: null, uninstallString: 'MsiExec.exe /X{G}' },
      { id: 'none', sizeBytes: null }
    ]);
    expect(sizes).toEqual({});
  });

  // Zero reads as "this program is free to remove", which is a claim, and
  // usually a wrong one -- an empty folder generally means a stale entry.
  it('omits a folder that measures zero rather than showing 0 B', async () => {
    await mkdir(join(root, 'Empty'), { recursive: true });
    const sizes = await getProgramSizes([
      { id: 'empty', sizeBytes: null, installLocation: join(root, 'Empty') }
    ]);
    expect(sizes.empty).toBeUndefined();
  });

  it('measures a shared folder once across two programs', async () => {
    await file(join('Shared', 'x.bin'), 2048);
    const location = join(root, 'Shared');
    const sizes = await getProgramSizes([
      { id: 'one', sizeBytes: null, installLocation: location },
      { id: 'two', sizeBytes: null, installLocation: location }
    ]);
    expect(sizes.one).toBe(2048);
    expect(sizes.two).toBe(2048);
  });
});

describe('shared launcher folders', () => {
  // The bug that made this obvious: Warframe, Marvel Rivals and Spacewar
  // all register the SAME uninstall command -- steam.exe with a protocol
  // URL -- so the "measure the uninstaller's folder" fallback handed each
  // of them the entire 152.7 GB Steam directory, and the list showed
  // three different games at an identical, wildly wrong size.
  it('refuses a fallback folder that several programs would share', async () => {
    await file(join('Launcher3', 'launcher.exe'), 100);
    await file(join('Launcher3', 'games', 'a', 'big.bin'), 60000);
    const shared = `"${join(root, 'Launcher3', 'launcher.exe')}" launch://uninstall/1`;

    const sizes = await getProgramSizes([
      { id: 'g1', sizeBytes: null, uninstallString: shared },
      { id: 'g2', sizeBytes: null, uninstallString: shared },
      { id: 'g3', sizeBytes: null, uninstallString: shared }
    ]);

    expect(sizes).toEqual({});
  });

  it('still measures a folder only one program points at', async () => {
    await file(join('Solo', 'app.bin'), 700);
    const sizes = await getProgramSizes([
      { id: 'solo', sizeBytes: null, uninstallString: `"${join(root, 'Solo', 'uninstall.exe')}"` }
    ]);
    expect(sizes.solo).toBe(700);
  });

  // An InstallLocation is per-program and recorded by the installer, so a
  // genuinely shared one (two components of the same suite) is a real
  // statement rather than an artefact of a launcher's uninstall command.
  it('does not apply the rule to a shared InstallLocation', async () => {
    await file(join('Suite', 'x.bin'), 1234);
    const location = join(root, 'Suite');
    const sizes = await getProgramSizes([
      { id: 'part1', sizeBytes: null, installLocation: location },
      { id: 'part2', sizeBytes: null, installLocation: location }
    ]);
    expect(sizes.part1).toBe(1234);
    expect(sizes.part2).toBe(1234);
  });
});

describe('the launcher itself', () => {
  // Regression: the first version of the shared-folder rule counted Steam
  // games toward Steam's own folder, so Steam refused to measure itself
  // and showed a blank. Games are sized from their manifests and never
  // use the folder route, so they must not count toward its share.
  it('measures the launcher even though its games name the same folder', async () => {
    await file(join('SteamLike', 'steam.exe'), 400);
    const gameCommand = `"${join(root, 'SteamLike', 'steam.exe')}" steam://uninstall/999`;

    const sizes = await getProgramSizes([
      { id: 'steam', name: 'Steam', sizeBytes: null, uninstallString: `"${join(root, 'SteamLike', 'uninstall.exe')}"` },
      { id: 'game1', sizeBytes: null, uninstallString: gameCommand },
      { id: 'game2', sizeBytes: null, uninstallString: gameCommand }
    ]);

    expect(sizes.steam).toBe(400);
  });
});
