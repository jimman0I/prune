import { describe, it, expect } from 'vitest';
import { productTokens, buildTokenPattern } from './leftoverMatch.js';

describe('productTokens', () => {
  it('splits a product name into its distinctive words, lower-cased', () => {
    expect(productTokens('Adobe Photoshop 2024', 'Adobe Inc.')).toEqual(['adobe', 'photoshop']);
  });

  it('drops words that say nothing about which program it is', () => {
    // "Update", "Setup", "Runtime" and the like appear in hundreds of
    // unrelated program names, so a folder called "Updates" is not evidence.
    expect(productTokens('Acme Update Helper Runtime (x64)', null)).toEqual(['acme']);
  });

  it('drops short words and bare numbers', () => {
    expect(productTokens('7-Zip 24.09 (x64 edition)', 'Igor Pavlov')).toEqual(['igor', 'pavlov']);
  });

  it('never offers Microsoft or Windows as evidence of a program', () => {
    expect(productTokens('Microsoft Edge', 'Microsoft Corporation')).toEqual(['edge']);
  });

  it('removes duplicates and survives missing input', () => {
    expect(productTokens('Steam Steam', 'Steam')).toEqual(['steam']);
    expect(productTokens(undefined, null)).toEqual([]);
  });
});

describe('buildTokenPattern', () => {
  it('is null with no tokens, because an empty pattern matches everything', () => {
    expect(buildTokenPattern([])).toBeNull();
  });

  it('matches a token as a whole word, not inside another word', () => {
    const re = new RegExp(buildTokenPattern(['steam']), 'i');
    expect(re.test('Steam')).toBe(true);
    expect(re.test('Steam Library')).toBe(true);
    expect(re.test('msteams')).toBe(false);
    expect(re.test('steamlink')).toBe(false);
  });

  it('escapes regex metacharacters', () => {
    const re = new RegExp(buildTokenPattern(['c++lib']), 'i');
    expect(re.test('c++lib')).toBe(true);
  });
});
