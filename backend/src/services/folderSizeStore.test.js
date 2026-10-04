import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createFolderSizeStore, defaultFolderSizeStore, FOLDER_SIZE_MAX_AGE_MS, FOLDER_SIZE_MAX_USABLE_AGE_MS
} from './folderSizeStore.js';

let dir;
let path;
const realSettings = process.env.UNREVO_SETTINGS_PATH;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'prune-sizestore-'));
  path = join(dir, 'folder-sizes.json');
});
afterEach(async () => {
  if (realSettings === undefined) delete process.env.UNREVO_SETTINGS_PATH;
  else process.env.UNREVO_SETTINGS_PATH = realSettings;
  await rm(dir, { recursive: true, force: true });
});

describe('createFolderSizeStore', () => {
  it('remembers a size across a save and a fresh load', async () => {
    const a = createFolderSizeStore({ path });
    await a.load();
    a.set('C:\\Apps\\One', 'x', 12345);
    await a.save();

    const b = createFolderSizeStore({ path });
    await b.load();
    expect(b.lookup('C:\\Apps\\One', 'x')).toEqual({ bytes: 12345, fresh: true });
  });

  it('treats folder spellings that differ only in case, slash style or a trailing slash as one folder', async () => {
    const store = createFolderSizeStore({ path });
    await store.load();
    store.set('C:/Apps/One/', '', 7);
    expect(store.lookup('c:\\apps\\one', '')?.bytes).toBe(7);
  });

  it('does not answer for the same folder measured with a different set of exclusions', async () => {
    const store = createFolderSizeStore({ path });
    await store.load();
    store.set('C:\\Apps\\One', 'c:\\apps\\one\\game', 100);
    expect(store.lookup('C:\\Apps\\One', '')).toBeUndefined();
  });

  it('calls a size fresh for a day, then stale (still shown), then too old to show', async () => {
    let t = 1_000_000;
    const store = createFolderSizeStore({ path, now: () => t });
    await store.load();
    store.set('C:\Apps\One', '', 50);
    t += FOLDER_SIZE_MAX_AGE_MS - 1;
    expect(store.lookup('C:\Apps\One', '')).toEqual({ bytes: 50, fresh: true });
    t += 1;
    expect(store.lookup('C:\Apps\One', '')).toEqual({ bytes: 50, fresh: false });
    t += FOLDER_SIZE_MAX_USABLE_AGE_MS;
    expect(store.lookup('C:\Apps\One', '')).toBeUndefined();
  });

  it('does not write expired entries back out', async () => {
    let t = 1_000_000;
    const store = createFolderSizeStore({ path, now: () => t });
    await store.load();
    store.set('C:\\Apps\\Old', '', 1);
    t += FOLDER_SIZE_MAX_USABLE_AGE_MS + 5;
    store.set('C:\\Apps\\New', '', 2);
    await store.save();
    const saved = JSON.parse(await readFile(path, 'utf8'));
    expect(Object.keys(saved.entries)).toEqual(['c:\\apps\\new']);
  });

  it('does not remember a zero (a missing or empty folder)', async () => {
    const store = createFolderSizeStore({ path });
    await store.load();
    store.set('C:\\Apps\\Gone', '', 0);
    await store.save();
    await expect(readFile(path, 'utf8')).rejects.toThrow();
  });

  it('starts empty from a corrupt or foreign file instead of failing', async () => {
    await writeFile(path, '{not json');
    const a = createFolderSizeStore({ path });
    await a.load();
    expect(a.lookup('C:\\Apps\\One', '')).toBeUndefined();

    await writeFile(path, JSON.stringify({ version: 99, entries: {} }));
    const b = createFolderSizeStore({ path });
    await b.load();
    expect(b.lookup('C:\\Apps\\One', '')).toBeUndefined();
  });

  it('ignores malformed entries and keeps the good ones', async () => {
    await writeFile(path, JSON.stringify({ version: 1, entries: {
      'c:\\a': { bytes: 'lots', at: Date.now(), ex: '' },
      'c:\\b': { bytes: 5, at: Date.now(), ex: '' }
    } }));
    const store = createFolderSizeStore({ path });
    await store.load();
    expect(store.lookup('C:\\a', '')).toBeUndefined();
    expect(store.lookup('C:\\b', '')?.bytes).toBe(5);
  });

  it('writes atomically, leaving no temp file behind', async () => {
    const store = createFolderSizeStore({ path });
    await store.load();
    store.set('C:\\Apps\\One', '', 9);
    await store.save();
    expect(await readdir(dir)).toEqual(['folder-sizes.json']);
  });

  it('keeps nothing on disk without a path', async () => {
    const store = createFolderSizeStore({ path: null });
    await store.load();
    store.set('C:\\Apps\\One', '', 9);
    await store.save();
    expect(await readdir(dir)).toEqual([]);
  });
});

describe('defaultFolderSizeStore', () => {
  it('persists beside settings.json when the app has set where that is', async () => {
    process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
    const store = defaultFolderSizeStore();
    await store.load();
    store.set('C:\\Apps\\One', '', 3);
    await store.save();
    expect(await readdir(dir)).toContain('folder-sizes.json');
  });

  it('keeps nothing on disk when there is no settings path (a bare node run, the tests)', async () => {
    delete process.env.UNREVO_SETTINGS_PATH;
    const store = defaultFolderSizeStore();
    await store.load();
    store.set('C:\\Apps\\One', '', 3);
    await store.save();
    expect(await readdir(dir)).toEqual([]);
  });
});
