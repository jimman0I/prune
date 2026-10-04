import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The folder walk is counted, not performed: this file is about how often the
// walk happens, not about what it measures (programSizes.test.js does that).
const measure = vi.fn();
let release = null;
vi.mock('./installSize.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, measureFolder: (...args) => measure(...args) };
});
const list = [
  { id: 'a', sizeBytes: null, installLocation: 'C:\\Programs\\AppA' },
  { id: 'b', sizeBytes: null, installLocation: 'C:\\Programs\\AppB' },
  { id: 'c', sizeBytes: 10, installLocation: 'C:\\Programs\\AppC' }
];
const listInstalledPrograms = vi.fn(async () => list.map((p) => ({ ...p })));
vi.mock('./programs.js', () => ({ listInstalledPrograms: (...a) => listInstalledPrograms(...a) }));
vi.mock('./gogApps.js', () => ({ getGogApps: async () => [] }));
vi.mock('./epicApps.js', () => ({ getEpicApps: async () => [] }));
vi.mock('./steamApps.js', async (importOriginal) => ({ ...(await importOriginal()), getSteamApps: async () => ({}) }));

const { getProgramSizes, clearSizeCache, refreshStaleSizes } = await import('./programSizes.js');

let dir;
const realSettings = process.env.UNREVO_SETTINGS_PATH;
beforeEach(async () => {
  clearSizeCache();
  measure.mockReset();
  listInstalledPrograms.mockClear();
  measure.mockImplementation(async (folder) => (release ? release.then(() => folder.length * 1000) : folder.length * 1000));
  release = null;
  dir = await mkdtemp(join(tmpdir(), 'prune-sizes-shared-'));
  delete process.env.UNREVO_SETTINGS_PATH;
});
afterEach(async () => {
  if (realSettings === undefined) delete process.env.UNREVO_SETTINGS_PATH;
  else process.env.UNREVO_SETTINGS_PATH = realSettings;
  clearSizeCache();
  await rm(dir, { recursive: true, force: true });
});

describe('getProgramSizes without a list (the window\'s own request)', () => {
  it('shares one run between requests that arrive while it is running', async () => {
    let open;
    release = new Promise((resolve) => { open = resolve; });

    const first = getProgramSizes();
    const second = getProgramSizes();
    const third = getProgramSizes();
    await new Promise((r) => setTimeout(r, 20));
    open();

    const [a, b, c] = await Promise.all([first, second, third]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(Object.keys(a).sort()).toEqual(['a', 'b']);
    // One walk per folder with no registry size, not one per request.
    expect(measure).toHaveBeenCalledTimes(2);
    expect(listInstalledPrograms).toHaveBeenCalledTimes(1);
  });

  it('does not walk a folder again on a later request in the same session', async () => {
    await getProgramSizes();
    await getProgramSizes();
    expect(measure).toHaveBeenCalledTimes(2);
  });
});

describe('the remembered sizes between launches', () => {
  it('walks the folders once, then answers from disk after a restart', async () => {
    process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');

    const cold = await getProgramSizes();
    expect(measure).toHaveBeenCalledTimes(2);
    expect(await readdir(dir)).toContain('folder-sizes.json');

    // "Restart": the process-wide memory is gone, the file is not.
    clearSizeCache();
    measure.mockClear();
    const warm = await getProgramSizes();
    expect(measure).not.toHaveBeenCalled();
    expect(warm).toEqual(cold);
  });

  it('measures again when a folder is not in the file (a newly installed program)', async () => {
    process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
    await getProgramSizes();

    clearSizeCache();
    measure.mockClear();
    list.push({ id: 'd', sizeBytes: null, installLocation: 'C:\\Programs\\AppD' });
    try {
      const sizes = await getProgramSizes();
      expect(measure).toHaveBeenCalledTimes(1);
      expect(measure.mock.calls[0][0]).toBe('C:\\Programs\\AppD');
      expect(sizes.d).toBeGreaterThan(0);
    } finally {
      list.pop();
    }
  });

  it('writes nothing to disk when the app has not said where its data lives', async () => {
    await getProgramSizes();
    expect(await readdir(dir)).toEqual([]);
  });

  it('shows a day-old figure at once and measures it again only when asked to refresh', async () => {
    const file = join(dir, 'folder-sizes.json');
    process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    await writeFile(file, JSON.stringify({ version: 1, entries: {
      'c:\\programs\\appa': { bytes: 111, at: twoDaysAgo, ex: '' },
      'c:\\programs\\appb': { bytes: 222, at: twoDaysAgo, ex: '' }
    } }));

    const sizes = await getProgramSizes();
    expect(sizes).toEqual({ a: 111, b: 222 });   // the old figures, instantly
    expect(measure).not.toHaveBeenCalled();      // no walk on the way in

    expect(await refreshStaleSizes()).toBe(2);   // the walk happens here
    expect(measure).toHaveBeenCalledTimes(2);
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved.entries['c:\\programs\\appa'].bytes).toBe('C:\\Programs\\AppA'.length * 1000);
    expect(saved.entries['c:\\programs\\appa'].at).toBeGreaterThan(twoDaysAgo);

    // Nothing is left to refresh, and a later request in the session sees the new figure.
    measure.mockClear();
    expect(await refreshStaleSizes()).toBe(0);
    expect((await getProgramSizes()).a).toBe('C:\\Programs\\AppA'.length * 1000);
  });

  it('does not refresh anything that was fresh', async () => {
    process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
    await getProgramSizes();
    clearSizeCache();
    measure.mockClear();
    await getProgramSizes();
    expect(await refreshStaleSizes()).toBe(0);
    expect(measure).not.toHaveBeenCalled();
  });
});
