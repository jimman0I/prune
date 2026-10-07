import { describe, it, expect, vi } from 'vitest';
import { readRecentFolders, addRecentFolder, RECENT_FOLDERS_KEY } from './duplicatesRecentFolders.js';

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    _store: store
  };
}

describe('readRecentFolders', () => {
  it('is empty with nothing stored', () => {
    expect(readRecentFolders(fakeStorage())).toEqual([]);
  });

  it('reads back a stored list', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['C:\\Users\\jim\\Downloads', 'D:\\Photos']) });
    expect(readRecentFolders(storage)).toEqual(['C:\\Users\\jim\\Downloads', 'D:\\Photos']);
  });

  it('is empty for corrupt JSON, a non-array, or a null storage', () => {
    expect(readRecentFolders(fakeStorage({ [RECENT_FOLDERS_KEY]: '{not json' }))).toEqual([]);
    expect(readRecentFolders(fakeStorage({ [RECENT_FOLDERS_KEY]: '"just a string"' }))).toEqual([]);
    expect(readRecentFolders(null)).toEqual([]);
  });

  it('drops non-string and empty entries rather than failing the whole list', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['C:\\Real', 42, '', null, 'D:\\AlsoReal']) });
    expect(readRecentFolders(storage)).toEqual(['C:\\Real', 'D:\\AlsoReal']);
  });

  it('is empty when the storage itself throws (site data blocked)', () => {
    const angry = { getItem: () => { throw new Error('blocked'); } };
    expect(readRecentFolders(angry)).toEqual([]);
  });
});

describe('addRecentFolder', () => {
  it('adds the first folder', () => {
    const storage = fakeStorage();
    expect(addRecentFolder(storage, 'C:\\Users\\jim\\Downloads')).toEqual(['C:\\Users\\jim\\Downloads']);
  });

  it('puts the newest folder first', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['D:\\Photos']) });
    expect(addRecentFolder(storage, 'C:\\Users\\jim\\Downloads')).toEqual(['C:\\Users\\jim\\Downloads', 'D:\\Photos']);
  });

  it('moves an existing folder to the front instead of duplicating it', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['A', 'B', 'C']) });
    expect(addRecentFolder(storage, 'B')).toEqual(['B', 'A', 'C']);
  });

  it('matches an existing entry case-insensitively, keeping the newer casing', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['c:\\users\\jim\\downloads']) });
    expect(addRecentFolder(storage, 'C:\\Users\\jim\\Downloads')).toEqual(['C:\\Users\\jim\\Downloads']);
  });

  it('caps the list at 5, dropping the oldest', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['A', 'B', 'C', 'D', 'E']) });
    expect(addRecentFolder(storage, 'F')).toEqual(['F', 'A', 'B', 'C', 'D']);
  });

  it('trims whitespace and ignores a blank folder', () => {
    const storage = fakeStorage();
    expect(addRecentFolder(storage, '  C:\\Real  ')).toEqual(['C:\\Real']);
    expect(addRecentFolder(storage, '   ')).toEqual(['C:\\Real']);
  });

  it('persists what it returns', () => {
    const storage = fakeStorage();
    addRecentFolder(storage, 'C:\\Real');
    expect(readRecentFolders(storage)).toEqual(['C:\\Real']);
  });

  it('returns the unchanged list, not a throw, when the storage write fails', () => {
    const storage = fakeStorage({ [RECENT_FOLDERS_KEY]: JSON.stringify(['A']) });
    storage.setItem = () => { throw new Error('quota'); };
    expect(addRecentFolder(storage, 'B')).toEqual(['A']);
  });
});
