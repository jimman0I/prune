import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findMainExecutable } from './findMainExecutable.js';

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-mainexe-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

async function exe(relativePath, sizeBytes = 1024) {
  const full = join(dir, relativePath);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, Buffer.alloc(sizeBytes));
  return full;
}

describe('findMainExecutable', () => {
  it('finds an executable named after the program', async () => {
    const wanted = await exe('EpicGamesLauncher.exe');
    await exe('Other.exe');
    expect(await findMainExecutable(dir, 'Epic Games Launcher')).toBe(wanted);
  });

  // Discord's real binary lives in a versioned Squirrel folder while the
  // registry only points at Update.exe, which carries no icon of its own.
  it('finds the binary inside a versioned subfolder', async () => {
    const wanted = await exe(join('app-1.0.9255', 'Discord.exe'));
    await exe('Update.exe');
    expect(await findMainExecutable(dir, 'Discord')).toBe(wanted);
  });

  it('finds a binary several folders down', async () => {
    const wanted = await exe(join('Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe'));
    expect(await findMainExecutable(dir, 'Epic Games Launcher')).toBe(wanted);
  });

  it('ignores spaces, case and punctuation when matching the name', async () => {
    const wanted = await exe('CPU-Z.exe');
    expect(await findMainExecutable(dir, 'CPUID CPU-Z 2.20')).toBe(wanted);
  });

  it('falls back to the largest executable when nothing matches the name', async () => {
    await exe('helper.exe', 1000);
    const biggest = await exe('MainApp.exe', 90000);
    expect(await findMainExecutable(dir, 'Totally Unrelated Name')).toBe(biggest);
  });

  // These are present in almost every install directory and none of them
  // carries the application's own icon -- picking one would give the row
  // a generic installer glyph, which looks more wrong than a letter.
  it('never falls back to an uninstaller, updater or setup stub', async () => {
    await exe('unins000.exe', 500000);
    await exe('Update.exe', 400000);
    await exe('setup.exe', 300000);
    await exe('vcredist_x64.exe', 200000);
    const real = await exe('Thing.exe', 1000);
    expect(await findMainExecutable(dir, 'Unrelated')).toBe(real);
  });

  it('still matches an uninstaller-looking name if that IS the program name', async () => {
    // A program genuinely called "Update" should not be excluded from
    // matching its own binary.
    const wanted = await exe('Update.exe');
    expect(await findMainExecutable(dir, 'Update')).toBe(wanted);
  });

  it('returns null when the folder has no executables', async () => {
    await writeFile(join(dir, 'readme.txt'), 'x');
    expect(await findMainExecutable(dir, 'Thing')).toBeNull();
  });

  it('returns null for a missing or empty location', async () => {
    expect(await findMainExecutable(join(dir, 'nope'), 'Thing')).toBeNull();
    expect(await findMainExecutable('', 'Thing')).toBeNull();
    expect(await findMainExecutable(null, 'Thing')).toBeNull();
  });

  // Program Files\Epic Games also contains installed games worth many GB.
  // An unbounded walk looking for an icon would traverse all of it.
  it('gives up rather than walking an unbounded tree', async () => {
    let path = 'deep';
    for (let i = 0; i < 12; i++) {
      path = join(path, `level${i}`);
      await exe(join(path, `file${i}.exe`), 10);
    }
    const started = Date.now();
    await findMainExecutable(dir, 'Nothing That Matches');
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
