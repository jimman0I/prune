import { describe, it, expect } from 'vitest';
import { normalizeFileVersion } from './versionText.js';

describe('normalizeFileVersion', () => {
  it('keeps a version the file actually reports', () => {
    expect(normalizeFileVersion('2.8.0.42')).toBe('2.8.0.42');
    expect(normalizeFileVersion('16.17.810.4348')).toBe('16.17.810.4348');
    expect(normalizeFileVersion('138.0.0')).toBe('138.0.0');
  });

  it('keeps a date-shaped version', () => {
    // Warframe versions by date, and it is the number the game itself
    // shows.
    expect(normalizeFileVersion('2026.08.19.11.06')).toBe('2026.08.19.11.06');
  });

  it('keeps semver build metadata', () => {
    // Riot Vanguard reports this, and every part of it is real.
    expect(normalizeFileVersion('1.19.0-6+20260826.181057')).toBe('1.19.0-6+20260826.181057');
  });

  it('rewrites the comma-separated form as dots', () => {
    // Roblox reports the raw VS_FIXEDFILEINFO rendering. The numbers are
    // right and only the punctuation is wrong, so this is a formatting
    // fix, not a guess.
    expect(normalizeFileVersion('0, 734, 0, 7340917')).toBe('0.734.0.7340917');
    expect(normalizeFileVersion('1,2,3,4')).toBe('1.2.3.4');
  });

  it('trims surrounding whitespace and a leading v', () => {
    expect(normalizeFileVersion('  3.4.1  ')).toBe('3.4.1');
    expect(normalizeFileVersion('v3.4.1')).toBe('3.4.1');
    expect(normalizeFileVersion('Version 3.4.1')).toBe('3.4.1');
  });

  it('returns null for nothing at all', () => {
    // Marvel Rivals, VALORANT and Ubisoft's anti-cheat service all ship
    // executables with an empty version resource.
    expect(normalizeFileVersion('')).toBeNull();
    expect(normalizeFileVersion('   ')).toBeNull();
    expect(normalizeFileVersion(null)).toBeNull();
    expect(normalizeFileVersion(undefined)).toBeNull();
    expect(normalizeFileVersion(42)).toBeNull();
  });

  it('rejects the linker placeholder', () => {
    // Rainbow Six Siege's shipping binary reports 1.0.0.0. The game is
    // nowhere near version 1.0.0.0 -- that is what the MSVC linker writes
    // when nobody set a version at all. This function only ever runs for
    // programs whose registry entry recorded no version, and a program
    // genuinely at 1.0.0.0 almost always declares it there, so in this
    // fallback the placeholder reading is the overwhelmingly likely one.
    expect(normalizeFileVersion('1.0.0.0')).toBeNull();
    expect(normalizeFileVersion('0.0.0.0')).toBeNull();
    expect(normalizeFileVersion('1, 0, 0, 0')).toBeNull();
  });

  it('rejects a commit hash', () => {
    // Teamfight Tactics ships its git SHA in the version field. It is not
    // a version and no one can read anything from it.
    expect(normalizeFileVersion('6a95c09f1c731857808b405d')).toBeNull();
    expect(normalizeFileVersion('deadbeefcafe1234')).toBeNull();
  });

  it('rejects text carrying no version at all', () => {
    expect(normalizeFileVersion('Copyright Contoso')).toBeNull();
    expect(normalizeFileVersion('-')).toBeNull();
  });

  it('rejects a string too long to be a version', () => {
    // Some resources hold a whole sentence. A Version column showing
    // prose is worse than one showing a blank.
    expect(normalizeFileVersion('4.1.2 (build 9931, compiled 2026-01-04 by the release runner)')).toBeNull();
  });
});
