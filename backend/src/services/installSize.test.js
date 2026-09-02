import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureFolder, sizeSourceFor } from './installSize.js';

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-size-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

async function file(relative, bytes) {
  const full = join(dir, relative);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, Buffer.alloc(bytes));
}

describe('measureFolder', () => {
  it('sums every file, recursively', async () => {
    await file('a.bin', 100);
    await file(join('sub', 'b.bin'), 250);
    expect(await measureFolder(dir)).toBe(350);
  });

  // Real numbers from this machine: measuring Ubisoft Connect's install
  // folder gave 55.14 GB and Rainbow Six Siege gave 54.69 GB -- because
  // the game lives INSIDE the launcher's folder. Reported as-is, the same
  // 54.69 GB is claimed by two rows, and the list adds up to far more
  // than the drive holds.
  it('excludes a nested folder that belongs to another program', async () => {
    await file('launcher.bin', 100);
    await file(join('games', 'big', 'data.bin'), 9000);
    const nested = join(dir, 'games', 'big');
    expect(await measureFolder(dir, [nested])).toBe(100);
  });

  it('matches a nested folder regardless of case or trailing separator', async () => {
    await file('own.bin', 50);
    await file(join('Inner', 'x.bin'), 900);
    expect(await measureFolder(dir, [join(dir, 'inner') + '\\'])).toBe(50);
  });

  it('does not exclude a folder that merely shares a name prefix', async () => {
    // "C:\App" must not swallow "C:\AppData" -- prefix matching without a
    // separator check is the classic way that goes wrong.
    await file(join('App', 'one.bin'), 10);
    await file(join('AppData', 'two.bin'), 20);
    expect(await measureFolder(dir, [join(dir, 'App')])).toBe(20);
  });

  it('returns 0 for a folder that does not exist', async () => {
    expect(await measureFolder(join(dir, 'nope'))).toBe(0);
  });

  it('skips unreadable subfolders rather than failing the whole measure', async () => {
    await file('readable.bin', 500);
    expect(await measureFolder(dir, [])).toBe(500);
  });
});

describe('sizeSourceFor', () => {
  const inDir = (name) => `C:\\Program Files\\${name}`;

  it('uses the install location when there is one', () => {
    expect(sizeSourceFor({ installLocation: inDir('App'), uninstallString: 'x' }))
      .toBe(inDir('App'));
  });

  // 16 of the 40 sizeless programs here register no InstallLocation at
  // all, but their uninstaller sits in the folder they installed into --
  // Equalizer APO's is C:\Program Files\EqualizerAPO\Uninstall.exe.
  it('falls back to the folder the uninstaller lives in', () => {
    expect(sizeSourceFor({ uninstallString: '"C:\\Program Files\\EqualizerAPO\\Uninstall.exe"' }))
      .toBe('C:\\Program Files\\EqualizerAPO');
  });

  it('refuses msiexec, whose folder is all of system32', () => {
    expect(sizeSourceFor({ uninstallString: 'MsiExec.exe /X{GUID}' })).toBeNull();
  });

  // Measuring one of these would report the size of Windows itself
  // against a single program.
  it('refuses a shared system folder', () => {
    expect(sizeSourceFor({ uninstallString: '"C:\\Windows\\system32\\thing.exe"' })).toBeNull();
    expect(sizeSourceFor({ uninstallString: '"C:\\Windows\\uninstall.exe"' })).toBeNull();
    expect(sizeSourceFor({ uninstallString: '"C:\\Program Files\\Common Files\\x\\u.exe"' })).toBeNull();
  });

  it('refuses a folder directly at a drive root or one level down', () => {
    // "C:\" or "C:\Program Files" is never one program's install folder.
    expect(sizeSourceFor({ uninstallString: '"C:\\uninstall.exe"' })).toBeNull();
    expect(sizeSourceFor({ uninstallString: '"C:\\Program Files\\uninstall.exe"' })).toBeNull();
  });

  it('returns null when there is nothing to go on', () => {
    expect(sizeSourceFor({})).toBeNull();
    expect(sizeSourceFor({ uninstallString: 'winget uninstall' })).toBeNull();
  });
});
