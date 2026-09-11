import { describe, it, expect } from 'vitest';
import { LANGUAGES, isSupportedLanguage, matchLanguage } from './languages.js';

describe('LANGUAGES', () => {
  it('is the installer\'s 40, no more and no fewer', () => {
    expect(LANGUAGES).toHaveLength(40);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(40); // no duplicate codes
  });

  it('never offers Hindi -- NSIS 3.0.4.1 cannot load it, same as the installer', () => {
    expect(LANGUAGES.some((l) => l.code === 'hi')).toBe(false);
  });

  it('every language has a name in English and in its own', () => {
    for (const lang of LANGUAGES) {
      expect(lang.english, lang.code).toBeTruthy();
      expect(lang.native, lang.code).toBeTruthy();
    }
  });
});

describe('isSupportedLanguage', () => {
  it('accepts a real code', () => {
    expect(isSupportedLanguage('el')).toBe(true);
    expect(isSupportedLanguage('pt-BR')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const bad of ['xx', 'EL', 'hi', '', null, undefined, 42]) {
      expect(isSupportedLanguage(bad), String(bad)).toBe(false);
    }
  });
});

describe('matchLanguage', () => {
  it('matches a bare primary subtag', () => {
    expect(matchLanguage('el')).toBe('el');
  });

  it('matches a locale with a region Prune does not distinguish, by primary subtag', () => {
    expect(matchLanguage('el-GR')).toBe('el');
    expect(matchLanguage('de-AT')).toBe('de');
  });

  it('prefers the more specific code when both exist', () => {
    expect(matchLanguage('pt-BR')).toBe('pt-BR');
    expect(matchLanguage('pt-PT')).toBe('pt');
    expect(matchLanguage('zh-CN')).toBe('zh-CN');
    expect(matchLanguage('zh-TW')).toBe('zh-TW');
  });

  it('falls back to the primary subtag when the specific region is unknown', () => {
    // Windows can hand back "pt-AO" (Angola); Prune has no Angolan
    // Portuguese, but has plain Portuguese, which is the right fallback --
    // not English.
    expect(matchLanguage('pt-AO')).toBe('pt');
  });

  it('matches a script-tagged Chinese locale by its real subtags', () => {
    expect(matchLanguage('zh-Hans-CN')).toBe('zh-CN');
    expect(matchLanguage('zh-Hant-TW')).toBe('zh-TW');
  });

  it('returns null for a language Prune does not have', () => {
    expect(matchLanguage('hi-IN')).toBeNull();
    expect(matchLanguage('xx')).toBeNull();
  });

  it('returns null rather than throw for nothing at all', () => {
    expect(matchLanguage('')).toBeNull();
    expect(matchLanguage(null)).toBeNull();
    expect(matchLanguage(undefined)).toBeNull();
  });
});
