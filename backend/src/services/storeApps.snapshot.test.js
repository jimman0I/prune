import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The Store list across launches.
 *
 * The scan behind it walks every package folder for its size (about seven
 * seconds here), and the Applications screen and the icons both waited on it
 * every launch. The finished list is kept beside settings.json now, and the
 * first ask of the next launch is answered from it while a real scan runs
 * behind it. Each "launch" below is a fresh module with the same data folder. */

let dir;
const row = (name) => ({
  name, packageFullName: `${name}_1.0_x64__abc`, publisher: 'CN=X', version: '1.0',
  installLocation: `C:\\WindowsApps\\${name}`, displayName: name, architecture: 'X64', sizeBytes: 10, nonRemovable: false
});

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(join(tmpdir(), 'prune-store-'));
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

async function launch(query) {
  vi.resetModules();
  vi.doMock('./powershell.js', () => ({ runPowerShellJson: query }));
  return import('./storeApps.js');
}
const names = (list) => list.map((a) => a.name);

describe('the Store list across launches', () => {
  it('the first launch scans, and saves the answer', async () => {
    const { getStoreApps } = await launch(vi.fn(async () => [row('Alpha'), row('Beta')]));
    expect(names(await getStoreApps())).toEqual(['Alpha', 'Beta']);
    await vi.waitFor(() => expect(existsSync(join(dir, 'store-apps.json'))).toBe(true));
    expect(JSON.parse(readFileSync(join(dir, 'store-apps.json'), 'utf8')).value).toHaveLength(2);
  });

  it('the next launch answers from the saved list at once, without waiting for the scan', async () => {
    const first = await launch(vi.fn(async () => [row('Alpha'), row('Beta')]));
    await first.getStoreApps();
    await vi.waitFor(() => expect(existsSync(join(dir, 'store-apps.json'))).toBe(true));

    let release;
    const slowScan = vi.fn(() => new Promise((resolve) => { release = () => resolve([row('Beta')]); }));
    const second = await launch(slowScan);
    expect(names(await second.getStoreApps())).toEqual(['Alpha', 'Beta']); // not blocked on the scan
    expect(slowScan).toHaveBeenCalledTimes(1);                              // but one is running

    release();
    await vi.waitFor(async () => expect(names(await second.getStoreApps())).toEqual(['Beta']));
  });

  it('a scan that failed (an empty list) never replaces a good saved list', async () => {
    const first = await launch(vi.fn(async () => [row('Alpha')]));
    await first.getStoreApps();
    await vi.waitFor(() => expect(existsSync(join(dir, 'store-apps.json'))).toBe(true));

    const failing = vi.fn(async () => { throw new Error('appx unavailable'); });
    const second = await launch(failing);
    expect(names(await second.getStoreApps())).toEqual(['Alpha']);
    await vi.waitFor(() => expect(failing).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(names(await second.getStoreApps())).toEqual(['Alpha']);
    expect(JSON.parse(readFileSync(join(dir, 'store-apps.json'), 'utf8')).value).toHaveLength(1);
  });

  it('a removed app is gone from the saved list too, and a late scan cannot bring it back', async () => {
    const first = await launch(vi.fn(async () => [row('Alpha'), row('Beta')]));
    await first.getStoreApps();
    await vi.waitFor(() => expect(existsSync(join(dir, 'store-apps.json'))).toBe(true));

    let release;
    // a scan that began before the removal and reports the app that was just removed
    const scan = vi.fn(() => new Promise((resolve) => { release = () => resolve([row('Alpha'), row('Beta')]); }));
    const second = await launch(scan);
    await second.getStoreApps();
    second.forgetStoreApp('Alpha_1.0_x64__abc');
    expect(names(await second.getStoreApps())).toEqual(['Beta']);

    release();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(names(await second.getStoreApps())).toEqual(['Beta']);
    await vi.waitFor(() => expect(JSON.parse(readFileSync(join(dir, 'store-apps.json'), 'utf8')).value.map((a) => a.name)).toEqual(['Beta']));
  });
});
