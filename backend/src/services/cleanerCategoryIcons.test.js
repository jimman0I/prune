import { describe, it, expect } from 'vitest';
import { pickIconSources, loadCleanerIconMap } from './cleanerCategoryIcons.js';
import { loadCleanerRules } from '../lib/cleanerRules.js';

/** Which file each Deep Clean category takes its icon from.
 *
 * The list groups by application -- Brave, Discord, Steam -- and named
 * them in text alone, which is the one place in this app where a row is
 * an app and had no icon. The names are short and similar enough
 * ("Chrome", "Edge", "Opera", "Vivaldi" are four rows of near-identical
 * shape) that the icon is the fastest way to find the one you want.
 */

const MAP = {
  Brave: ['X:\\nope\\brave.exe', 'X:\\real\\brave.exe'],
  Discord: ['X:\\real\\app.ico'],
  Firefox: ['X:\\nope\\firefox.exe'],
  Empty: []
};

const exists = (path) => path.startsWith('X:\\real');

describe('pickIconSources', () => {
  it('takes the first candidate that exists on this machine', () => {
    // Candidates are ordered, not alternatives: a program installed both
    // per-user and machine-wide should resolve to one of them without the
    // data needing to know which machine it is running on.
    expect(pickIconSources(MAP, { exists }).get('Brave')).toBe('X:\\real\\brave.exe');
  });

  it('accepts an .ico as readily as an .exe', () => {
    // Squirrel apps ship an app.ico beside the launcher stub, and the stub
    // itself has no icon in it -- see squirrelStub.js for the same problem
    // on the startup screen.
    expect(pickIconSources(MAP, { exists }).get('Discord')).toBe('X:\\real\\app.ico');
  });

  it('omits a category whose candidates are all absent', () => {
    // Not installed is the ordinary case, not a failure: a category for a
    // program that is not here has nothing to clean either. The row keeps
    // its lettered tile.
    const sources = pickIconSources(MAP, { exists });
    expect(sources.has('Firefox')).toBe(false);
    expect(sources.has('Empty')).toBe(false);
  });

  it('ignores the comment key the data file carries', () => {
    const sources = pickIconSources({ _comment: 'not a category', ...MAP }, { exists });
    expect(sources.has('_comment')).toBe(false);
  });

  it('survives a malformed entry rather than failing the whole map', () => {
    const sources = pickIconSources({ Bad: 'not-an-array', Brave: MAP.Brave }, { exists });
    expect(sources.has('Bad')).toBe(false);
    expect(sources.get('Brave')).toBe('X:\\real\\brave.exe');
  });
});

describe('the shipped icon map', () => {
  it('names only categories that actually exist in the rule set', () => {
    // A typo'd key is invisible at runtime -- the category simply never
    // gets an icon and nothing reports it. This is the check that would
    // have caught it.
    const categories = new Set(loadCleanerRules().map((rule) => rule.category));
    const stray = Object.keys(loadCleanerIconMap()).filter((key) => !categories.has(key));
    expect(stray).toEqual([]);
  });

  it('covers every category in the rule set', () => {
    // Coverage is about the DATA, not about this machine: whether the
    // program is installed here decides whether an icon appears, but every
    // category should at least declare where its icon would come from.
    const categories = [...new Set(loadCleanerRules().map((rule) => rule.category))];
    const map = loadCleanerIconMap();
    expect(categories.filter((category) => !map[category])).toEqual([]);
  });

  it('uses only path tokens expandPath knows', () => {
    // A token nobody expands stays in the string verbatim, the path never
    // matches, and the category silently loses its icon -- the same silent
    // failure %WINDIR% once caused in cleaners.json.
    const known = /%(APPDATA|LOCALAPPDATA|SYSTEMROOT|WINDIR|PROGRAMDATA|SYSTEMDRIVE|PROGRAMFILES\(X86\)|PROGRAMFILES)%/gi;
    const map = loadCleanerIconMap();
    const bad = [];
    for (const [category, paths] of Object.entries(map)) {
      for (const path of paths) {
        const leftover = path.replace(known, '').match(/%[^%]+%/g);
        if (leftover) bad.push(`${category}: ${leftover.join(', ')}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
