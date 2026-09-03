import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProfilesIni, normalizeFirefoxAddon, getFirefoxExtensions } from './firefoxExtensions.js';

describe('parseProfilesIni', () => {
  const base = 'C:\\Users\\x\\AppData\\Roaming\\Mozilla\\Firefox';

  it('resolves a relative profile against the browser folder', () => {
    const ini = [
      '[Profile0]',
      'Name=default-release',
      'IsRelative=1',
      'Path=Profiles/abc123.default-release',
      ''
    ].join('\n');
    expect(parseProfilesIni(ini, base))
      .toEqual([join(base, 'Profiles\\abc123.default-release')]);
  });

  // A profile moved to another drive is recorded absolute, and joining it
  // to the browser folder would produce a path that does not exist.
  it('uses an absolute profile path as given', () => {
    const ini = ['[Profile0]', 'IsRelative=0', 'Path=D:\\ff\\myprofile', ''].join('\n');
    expect(parseProfilesIni(ini, base)).toEqual(['D:\\ff\\myprofile']);
  });

  it('reads every profile in the file', () => {
    const ini = [
      '[Profile0]', 'IsRelative=1', 'Path=Profiles/one',
      '[Profile1]', 'IsRelative=1', 'Path=Profiles/two',
      '[General]', 'StartWithLastProfile=1', ''
    ].join('\n');
    expect(parseProfilesIni(ini, base)).toHaveLength(2);
  });

  it('ignores sections that name no profile', () => {
    const ini = ['[General]', 'StartWithLastProfile=1', 'Version=2', ''].join('\n');
    expect(parseProfilesIni(ini, base)).toEqual([]);
  });

  it('copes with CRLF and with nothing at all', () => {
    expect(parseProfilesIni('[Profile0]\r\nIsRelative=1\r\nPath=Profiles/a\r\n', base)).toHaveLength(1);
    expect(parseProfilesIni('', base)).toEqual([]);
    expect(parseProfilesIni(null, base)).toEqual([]);
  });
});

describe('normalizeFirefoxAddon', () => {
  const addon = {
    id: 'uBlock0@raymondhill.net',
    location: 'app-profile',
    type: 'extension',
    version: '1.60.0',
    active: true,
    userDisabled: false,
    path: 'C:\\p\\extensions\\uBlock0@raymondhill.net.xpi',
    defaultLocale: { name: 'uBlock Origin', description: 'Finally, an efficient blocker.' }
  };

  it('reads a user-installed extension', () => {
    expect(normalizeFirefoxAddon(addon)).toMatchObject({
      addonId: 'uBlock0@raymondhill.net',
      name: 'uBlock Origin',
      version: '1.60.0',
      enabled: true
    });
  });

  // Gecko records where an add-on came from, and only "app-profile" is
  // something a person installed. The rest ship with the browser, and
  // listing them would bury the handful that were chosen.
  it('ignores add-ons that came with the browser', () => {
    for (const location of ['app-builtin', 'app-system-defaults', 'app-global']) {
      expect(normalizeFirefoxAddon({ ...addon, location })).toBeNull();
    }
  });

  it('ignores themes, dictionaries and language packs', () => {
    for (const type of ['theme', 'dictionary', 'locale']) {
      expect(normalizeFirefoxAddon({ ...addon, type })).toBeNull();
    }
  });

  it('reports a disabled add-on as installed but not enabled', () => {
    // Still installed and still taking up room, which is what the list is
    // about -- the row just needs to be able to say so.
    expect(normalizeFirefoxAddon({ ...addon, userDisabled: true }).enabled).toBe(false);
    expect(normalizeFirefoxAddon({ ...addon, active: false }).enabled).toBe(false);
  });

  // The whole point of the strictness: this reader has never run against a
  // real Gecko profile, so anything not matching the expected shape must
  // produce nothing rather than a wrong row.
  it('drops anything missing what a row needs', () => {
    expect(normalizeFirefoxAddon({ ...addon, id: '' })).toBeNull();
    expect(normalizeFirefoxAddon({ ...addon, defaultLocale: {} })).toBeNull();
    expect(normalizeFirefoxAddon({ ...addon, defaultLocale: undefined })).toBeNull();
    expect(normalizeFirefoxAddon({})).toBeNull();
    expect(normalizeFirefoxAddon(null)).toBeNull();
    expect(normalizeFirefoxAddon('nonsense')).toBeNull();
  });
});

describe('getFirefoxExtensions against a real profile on disk', () => {
  // Builds an actual Firefox-shaped profile so the directory walking,
  // profiles.ini resolution and .xpi sizing are exercised for real. The
  // JSON shape is from the documented format -- no Gecko browser is
  // installed on this machine to read a genuine one from.
  it('finds an extension through profiles.ini and measures its .xpi', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prune-gecko-'));
    const original = process.env.APPDATA;
    try {
      const base = join(root, 'Mozilla', 'Firefox');
      const profile = join(base, 'Profiles', 'abc.default-release');
      mkdirSync(join(profile, 'extensions'), { recursive: true });

      writeFileSync(
        join(base, 'profiles.ini'),
        '[Profile0]\nName=default\nIsRelative=1\nPath=Profiles/abc.default-release\n'
      );
      writeFileSync(join(profile, 'extensions', 'demo@example.com.xpi'), 'x'.repeat(2048));
      writeFileSync(join(profile, 'extensions.json'), JSON.stringify({
        schemaVersion: 35,
        addons: [
          {
            id: 'demo@example.com',
            location: 'app-profile',
            type: 'extension',
            version: '2.1.0',
            active: true,
            userDisabled: false,
            defaultLocale: { name: 'Demo Blocker', description: 'A test add-on.' }
          },
          {
            id: 'builtin@mozilla.org',
            location: 'app-builtin',
            type: 'extension',
            version: '1.0',
            defaultLocale: { name: 'Shipped With Firefox' }
          }
        ]
      }));

      process.env.APPDATA = root;
      const found = await getFirefoxExtensions();

      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        name: 'Demo Blocker',
        version: '2.1.0',
        browser: 'Firefox',
        extensionId: 'demo@example.com',
        enabled: true,
        source: 'extension',
        sizeBytes: 2048
      });
    } finally {
      process.env.APPDATA = original;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('finds a profile even with no profiles.ini', async () => {
    // A profile folder can outlive the ini, and some forks ship without
    // one.
    const root = mkdtempSync(join(tmpdir(), 'prune-gecko-'));
    const original = process.env.APPDATA;
    try {
      const profile = join(root, 'Mozilla', 'Firefox', 'Profiles', 'zzz.default');
      mkdirSync(profile, { recursive: true });
      writeFileSync(join(profile, 'extensions.json'), JSON.stringify({
        addons: [{
          id: 'solo@example.com',
          location: 'app-profile',
          type: 'extension',
          version: '1.0',
          defaultLocale: { name: 'Solo' }
        }]
      }));

      process.env.APPDATA = root;
      const found = await getFirefoxExtensions();
      expect(found.map((f) => f.name)).toEqual(['Solo']);
    } finally {
      process.env.APPDATA = original;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns nothing when no Gecko browser is installed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prune-gecko-'));
    const original = process.env.APPDATA;
    try {
      process.env.APPDATA = root;
      expect(await getFirefoxExtensions()).toEqual([]);
    } finally {
      process.env.APPDATA = original;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns nothing rather than throwing on a malformed index', async () => {
    const root = mkdtempSync(join(tmpdir(), 'prune-gecko-'));
    const original = process.env.APPDATA;
    try {
      const profile = join(root, 'Mozilla', 'Firefox', 'Profiles', 'broken.default');
      mkdirSync(profile, { recursive: true });
      writeFileSync(join(profile, 'extensions.json'), '{ this is not json');

      process.env.APPDATA = root;
      expect(await getFirefoxExtensions()).toEqual([]);
    } finally {
      process.env.APPDATA = original;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
