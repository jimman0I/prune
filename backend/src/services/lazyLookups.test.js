import { describe, it, expect, beforeEach, vi } from 'vitest';

// The program lookups that decorate the Applications screen (icons, install
// dates, Store/extension icons) are no longer warmed at start-up; they are
// computed the first time the window asks. These tests pin the two things that
// makes safe: asked cold they answer correctly, and asked together they share
// one run.

let gate = null; // when set, the registry read waits on it
const runPowerShellJson = vi.fn(async () => {
  if (gate) await gate;
  return [{ key: 'HKLM:\\SOFTWARE\\X\\app', written: '2025-05-06T10:00:00Z' }];
});
vi.mock('./powershell.js', () => ({
  runPowerShellJson: (...a) => runPowerShellJson(...a),
  runPowerShellText: async () => ''
}));

const programs = [
  { id: 'app', name: 'App', registryKey: 'HKLM:\\SOFTWARE\\X\\app', installDate: null, uninstallString: '' }
];
const listInstalledPrograms = vi.fn(async () => programs.map((p) => ({ ...p })));
vi.mock('./programs.js', () => ({ listInstalledPrograms: (...a) => listInstalledPrograms(...a) }));

const getStoreApps = vi.fn(async () => []);
vi.mock('./storeApps.js', () => ({ getStoreApps: (...a) => getStoreApps(...a) }));
const getBrowserExtensions = vi.fn(async () => []);
vi.mock('./browserExtensions.js', () => ({ getBrowserExtensions: (...a) => getBrowserExtensions(...a) }));

const { getProgramInstallDates, clearInstallDateCache } = await import('./installDates.js');
const { getPackageIcons, clearPackageIconCache } = await import('./packageIcons.js');
const { getProgramIcons, clearIconCache } = await import('./programIcons.js');

const later = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.clearAllMocks();
  gate = null;
  clearInstallDateCache();
  clearPackageIconCache();
  clearIconCache();
});

describe('getProgramInstallDates, asked cold', () => {
  it('answers from the registry on the first request', async () => {
    const dates = await getProgramInstallDates();
    expect(dates).toEqual({ app: '2025-05-06' });
  });

  it('shares one registry pass between requests that overlap', async () => {
    let open;
    gate = new Promise((resolve) => { open = resolve; });
    const a = getProgramInstallDates();
    const b = getProgramInstallDates();
    await later();
    open();
    expect(await a).toEqual(await b);
    expect(runPowerShellJson).toHaveBeenCalledTimes(1);
    expect(listInstalledPrograms).toHaveBeenCalledTimes(1);
  });

  it('keeps the answer for a short while, then reads again', async () => {
    await getProgramInstallDates();
    await getProgramInstallDates();
    expect(runPowerShellJson).toHaveBeenCalledTimes(1);
    clearInstallDateCache();
    await getProgramInstallDates();
    expect(runPowerShellJson).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failure as an answer', async () => {
    listInstalledPrograms.mockRejectedValueOnce(new Error('registry unavailable'));
    await expect(getProgramInstallDates()).rejects.toThrow('registry unavailable');
    expect(await getProgramInstallDates()).toEqual({ app: '2025-05-06' });
  });

  it('still runs fresh for an explicit list', async () => {
    await getProgramInstallDates();
    await getProgramInstallDates(programs);
    expect(runPowerShellJson).toHaveBeenCalledTimes(2);
  });
});

describe('getPackageIcons, asked cold', () => {
  it('answers with an empty map when there are no Store apps or extensions', async () => {
    expect(await getPackageIcons()).toEqual({});
  });

  it('shares one pass between requests that overlap', async () => {
    let open;
    const waiting = new Promise((resolve) => { open = resolve; });
    getStoreApps.mockImplementationOnce(async () => { await waiting; return []; });
    const a = getPackageIcons();
    const b = getPackageIcons();
    await later();
    open();
    await Promise.all([a, b]);
    expect(getStoreApps).toHaveBeenCalledTimes(1);
    expect(getBrowserExtensions).toHaveBeenCalledTimes(1);
  });
});

describe('getProgramIcons, asked cold', () => {
  it('answers with an empty map for a machine with nothing to extract', async () => {
    listInstalledPrograms.mockResolvedValue([]);
    expect(await getProgramIcons()).toEqual({});
  });

  it('shares one program scan between requests that overlap', async () => {
    let open;
    const waiting = new Promise((resolve) => { open = resolve; });
    listInstalledPrograms.mockImplementationOnce(async () => { await waiting; return []; });
    const a = getProgramIcons();
    const b = getProgramIcons();
    await later();
    open();
    expect(await a).toEqual(await b);
    expect(listInstalledPrograms).toHaveBeenCalledTimes(1);
  });
});
