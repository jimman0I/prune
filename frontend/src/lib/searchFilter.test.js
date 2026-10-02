import { describe, it, expect } from 'vitest';
import { compileFilter } from './searchFilter.js';

const names = ['Setup.EXE', 'readme.txt', 'game.pak', 'game2.pak', 'notes.txt.bak', 'a.b'];
const matching = (text, list = names, path = () => undefined) => {
  const filter = compileFilter(text);
  return list.filter((n) => filter.match(n, path(n)));
};

describe('compileFilter', () => {
  it('matches everything for an empty or blank search, and says it is inactive', () => {
    for (const text of ['', '   ', undefined, null]) {
      const filter = compileFilter(text);
      expect(filter.active).toBe(false);
      expect(filter.ok).toBe(true);
      expect(filter.match('anything')).toBe(true);
    }
  });

  describe('plain text', () => {
    it('is a case-insensitive substring of the name', () => {
      expect(matching('GAME')).toEqual(['game.pak', 'game2.pak']);
      expect(matching('.txt')).toEqual(['readme.txt', 'notes.txt.bak']);
    });

    it('treats regex characters in plain text literally', () => {
      expect(matching('a.b')).toEqual(['a.b']);
      expect(matching('(')).toEqual([]);
    });

    it('ignores whitespace around the text', () => {
      expect(matching('  readme ')).toEqual(['readme.txt']);
    });
  });

  describe('wildcards', () => {
    it('* matches any run of characters and the pattern covers the whole name', () => {
      expect(matching('*.pak')).toEqual(['game.pak', 'game2.pak']);
      expect(matching('game*')).toEqual(['game.pak', 'game2.pak']);
      expect(matching('*.txt')).toEqual(['readme.txt']); // not notes.txt.bak: anchored
    });

    it('? matches exactly one character', () => {
      expect(matching('game?.pak')).toEqual(['game2.pak']);
      expect(matching('game??.pak')).toEqual([]);
    });

    it('*foo* is "contains"', () => {
      expect(matching('*txt*')).toEqual(['readme.txt', 'notes.txt.bak']);
    });

    it('is case-insensitive and escapes regex characters around the wildcards', () => {
      expect(matching('*.exe')).toEqual(['Setup.EXE']);
      expect(matching('a.b*')).toEqual(['a.b']);
      expect(matching('a?b')).toEqual(['a.b']);
    });

    it('matches the full path when the pattern contains a path separator', () => {
      const path = (n) => `C:\\Games\\${n}`;
      expect(matching('*\\Games\\*.pak', names, path)).toEqual(['game.pak', 'game2.pak']);
      expect(matching('C:\\Other\\*', names, path)).toEqual([]);
    });
  });

  describe('/regex/', () => {
    it('is a regular expression over the name, case-insensitive by default', () => {
      expect(matching('/^game\\d?\\.pak$/')).toEqual(['game.pak', 'game2.pak']);
      expect(matching('/SETUP/')).toEqual(['Setup.EXE']);
    });

    it('takes a trailing flag, and a case-sensitive form via an empty-flag-free i-less mode', () => {
      expect(matching('/setup/i')).toEqual(['Setup.EXE']);
      expect(matching('/setup/s')).toEqual([]);
    });

    it('reports an invalid regex as not ok, with a reason, instead of throwing', () => {
      for (const text of ['/(/', '/[a-/', '/*/', '/a{2,1}/']) {
        const filter = compileFilter(text);
        expect(filter.ok, text).toBe(false);
        expect(typeof filter.error).toBe('string');
      }
    });

    it('applies no filtering while the pattern is invalid: everything matches', () => {
      const filter = compileFilter('/(/');
      expect(filter.active).toBe(false);
      expect(filter.match('anything')).toBe(true);
    });

    it('reports an unknown flag as invalid', () => {
      expect(compileFilter('/a/z').ok).toBe(false);
    });

    it('treats a lone slash or a path-like string as plain text', () => {
      expect(compileFilter('/').ok).toBe(true);
      expect(matching('/')).toEqual([]);
      const filter = compileFilter('Users/me');
      expect(filter.kind).toBe('text');
    });
  });

  it('exposes which kind of search it is', () => {
    expect(compileFilter('abc').kind).toBe('text');
    expect(compileFilter('a*c').kind).toBe('wildcard');
    expect(compileFilter('/abc/').kind).toBe('regex');
    expect(compileFilter('').kind).toBe('none');
  });
});
