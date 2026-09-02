import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFileTypeIcons,
  extensionOf,
  clearFileTypeIconCache,
  FOLDER_KEY,
  GENERIC_FILE_KEY
} from './fileTypeIcons.js';

describe('extensionOf', () => {
  it('reads a normal extension, lowercased', () => {
    expect(extensionOf('holiday.MP4')).toBe('.mp4');
    expect(extensionOf('setup.exe')).toBe('.exe');
  });

  it('takes only the last extension', () => {
    // Windows associates icons on the final extension -- archive.tar.gz
    // shows the .gz icon, not a .tar one.
    expect(extensionOf('archive.tar.gz')).toBe('.gz');
  });

  it('returns null for a name with no extension', () => {
    expect(extensionOf('Makefile')).toBeNull();
    expect(extensionOf('Program Files')).toBeNull();
  });

  it('ignores something that is not really an extension', () => {
    // A trailing version number is not a file type, and asking Windows
    // about ".9255" would just churn out generic icons.
    expect(extensionOf('app-1.0.9255')).toBeNull();
    expect(extensionOf('name.withaverylongsuffix')).toBeNull();
  });

  it('handles non-strings without throwing', () => {
    expect(extensionOf(null)).toBeNull();
    expect(extensionOf(undefined)).toBeNull();
  });
});

/** Real shell lookups against this machine's own file associations. The
 * association chain is the whole feature; a mocked version would only
 * prove the plumbing. */
describe('getFileTypeIcons (real shell lookups)', () => {
  beforeEach(() => clearFileTypeIconCache());

  it('always returns the folder and generic-file icons', async () => {
    const icons = await getFileTypeIcons([]);
    expect(icons[FOLDER_KEY]).toMatch(/^data:image\/png;base64,/);
    expect(icons[GENERIC_FILE_KEY]).toMatch(/^data:image\/png;base64,/);
  }, 60000);

  it('resolves an extension to its real associated icon', async () => {
    const icons = await getFileTypeIcons(['.exe', '.zip']);
    expect(icons['.exe']).toBeTruthy();
    expect(icons['.zip']).toBeTruthy();
    // Different file types genuinely look different -- if they matched,
    // the association lookup would be doing nothing.
    expect(icons['.exe']).not.toBe(icons['.zip']);
    expect(icons['.exe']).not.toBe(icons[FOLDER_KEY]);
  }, 60000);

  it('is case-insensitive about the extension it is asked for', async () => {
    const icons = await getFileTypeIcons(['.PDF']);
    expect(icons['.pdf']).toBeTruthy();
  }, 60000);

  // Junk here would come straight from a filename on disk, so it has to
  // be filtered rather than pasted into a shell call.
  it('ignores anything that is not a plausible extension', async () => {
    const icons = await getFileTypeIcons(['not-an-ext', '', null, '.waytoolongtobereal', '.a b']);
    expect(Object.keys(icons).sort()).toEqual([GENERIC_FILE_KEY, FOLDER_KEY].sort());
  }, 60000);

  it('serves repeat requests from cache', async () => {
    await getFileTypeIcons(['.exe']);
    const started = Date.now();
    const icons = await getFileTypeIcons(['.exe']);
    expect(Date.now() - started).toBeLessThan(150);
    expect(icons['.exe']).toBeTruthy();
  }, 60000);
});
