import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveExtensionName, newestVersionDir, getBrowserExtensions } from './browserExtensions.js';

describe('resolveExtensionName', () => {
  it('keeps a plain name', () => {
    expect(resolveExtensionName('Dark Reader', null)).toBe('Dark Reader');
  });

  // Six of the 26 extensions on this machine declare their name as a
  // message key. "__MSG_extName__" in a list of installed software would
  // be useless.
  it('resolves a localised name from the messages file', () => {
    expect(resolveExtensionName('__MSG_extName__', { extName: { message: 'uBlock Origin' } }))
      .toBe('uBlock Origin');
  });

  it('matches the message key case-insensitively', () => {
    // Chromium treats message keys as case-insensitive.
    expect(resolveExtensionName('__MSG_EXTENSION_NAME__', { extension_name: { message: 'Bitwarden' } }))
      .toBe('Bitwarden');
  });

  it('returns null when the key cannot be resolved', () => {
    // Better an absent extension than a row labelled "__MSG_extName__".
    expect(resolveExtensionName('__MSG_extName__', null)).toBeNull();
    expect(resolveExtensionName('__MSG_extName__', { other: { message: 'x' } })).toBeNull();
    expect(resolveExtensionName('__MSG_extName__', { extName: { message: '  ' } })).toBeNull();
  });

  it('returns null for nothing at all', () => {
    expect(resolveExtensionName('', null)).toBeNull();
    expect(resolveExtensionName(null, null)).toBeNull();
  });
});

describe('newestVersionDir', () => {
  it('picks the highest version', () => {
    expect(newestVersionDir(['1.0.0', '1.2.0', '1.1.9'])).toBe('1.2.0');
  });

  // The reason this compares numerically instead of sorting strings.
  it('does not sort 1.0.10 below 1.0.9', () => {
    expect(newestVersionDir(['1.0.9', '1.0.10'])).toBe('1.0.10');
  });

  it('handles the underscore suffix Chromium adds', () => {
    // Unpacked or re-signed extensions get a "_0" suffix on the folder.
    expect(newestVersionDir(['4.9.129_0', '4.9.100_0'])).toBe('4.9.129_0');
  });

  it('copes with a single version and with none', () => {
    expect(newestVersionDir(['2.3.10'])).toBe('2.3.10');
    expect(newestVersionDir([])).toBeNull();
    expect(newestVersionDir(null)).toBeNull();
  });
});

describe('Gecko extensions merged into the same list', () => {
  // The list a person wants is "my extensions", not "my extensions, by
  // engine". Chromium and Gecko store them completely differently, so
  // this covers that the two readers actually come back as one list.
  it('includes a Firefox add-on alongside the Chromium ones', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prune-merge-'));
    const originalAppData = process.env.APPDATA;
    // LOCALAPPDATA is redirected too, so the real Chromium browsers on
    // this machine are not walked. Without it the test measured 26 real
    // extension folders and timed out under full-suite load -- and it
    // would also have depended on what happens to be installed.
    const originalLocal = process.env.LOCALAPPDATA;
    try {
      const profile = join(root, 'Mozilla', 'Firefox', 'Profiles', 'a.default');
      mkdirSync(join(profile, 'extensions'), { recursive: true });
      writeFileSync(join(profile, 'extensions', 'big@example.com.xpi'), 'x'.repeat(4096));
      writeFileSync(join(profile, 'extensions.json'), JSON.stringify({
        addons: [{
          id: 'big@example.com',
          location: 'app-profile',
          type: 'extension',
          version: '3.0',
          defaultLocale: { name: 'Merged Add-on' }
        }]
      }));

      process.env.APPDATA = root;
      process.env.LOCALAPPDATA = root;
      const list = await getBrowserExtensions();
      const gecko = list.filter((e) => e.browser === 'Firefox');

      expect(list).toHaveLength(1);
      expect(gecko).toHaveLength(1);
      expect(gecko[0]).toMatchObject({ name: 'Merged Add-on', sizeBytes: 4096, source: 'extension' });
    } finally {
      process.env.APPDATA = originalAppData;
      process.env.LOCALAPPDATA = originalLocal;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
