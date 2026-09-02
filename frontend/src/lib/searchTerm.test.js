import { describe, it, expect } from 'vitest';
import { deriveSearchTerm } from './searchTerm.js';

describe('deriveSearchTerm', () => {
  // The bug this exists for, found dogfooding: a forced uninstall searched
  // for the registry DisplayName verbatim -- "TriClaude 0.1.0" -- and no
  // folder on earth is named that, so a program with 1.1 GB of leftovers
  // in five folders scanned clean.
  it('strips a trailing version number', () => {
    expect(deriveSearchTerm('TriClaude 0.1.0')).toBe('TriClaude');
    expect(deriveSearchTerm('7-Zip 22.01')).toBe('7-Zip');
  });

  it('strips a trailing architecture or edition qualifier', () => {
    expect(deriveSearchTerm('7-Zip 25.01 (x64)')).toBe('7-Zip');
    expect(deriveSearchTerm('Python 3.12.1 (64-bit)')).toBe('Python');
  });

  it('leaves a name with no version untouched', () => {
    expect(deriveSearchTerm('Google Chrome')).toBe('Google Chrome');
    expect(deriveSearchTerm('Overwolf')).toBe('Overwolf');
  });

  it('keeps digits that are part of the product name', () => {
    // The version is a TRAILING token; a number inside the name is part of
    // what the thing is called and removing it would search for the wrong
    // product entirely.
    expect(deriveSearchTerm('Visual Studio Code')).toBe('Visual Studio Code');
    expect(deriveSearchTerm('Microsoft 365 Apps')).toBe('Microsoft 365 Apps');
    expect(deriveSearchTerm('7-Zip')).toBe('7-Zip');
  });

  it('strips a trailing "version 1.2" phrase', () => {
    expect(deriveSearchTerm('Foo Bar version 1.2')).toBe('Foo Bar');
  });

  it('never returns an empty term, however version-like the name is', () => {
    // Falling back to the original is right: an empty pattern matches
    // everything, which would offer the whole machine as leftovers.
    expect(deriveSearchTerm('1.2.3')).toBe('1.2.3');
    expect(deriveSearchTerm('(x64)')).toBe('(x64)');
  });

  it('handles a missing name without throwing', () => {
    expect(deriveSearchTerm(null)).toBe('');
    expect(deriveSearchTerm('')).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(deriveSearchTerm('  Notepad++ 8.6.9  ')).toBe('Notepad++');
  });
});
