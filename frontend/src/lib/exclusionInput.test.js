import { describe, it, expect } from 'vitest';
import { classifyExclusion } from './exclusionInput.js';

describe('classifyExclusion', () => {
  it('reads both marked spellings of an extension', () => {
    for (const input of ['*.iso', '.iso', '*.ISO', '  .Iso  ']) {
      expect(classifyExclusion(input), input).toEqual({ kind: 'extension', value: '.iso' });
    }
  });

  it('refuses a BARE word, extension-shaped or not', () => {
    // This narrows what the first version accepted, and deliberately.
    // "iso" obviously means an extension and "Downloads" obviously means a
    // folder -- but no rule separates them that does not also get "temp",
    // "bin" and "src" wrong, each of which is both a common extension and
    // a common folder name. Guessing fails silently in both directions:
    // guess folder and it excludes nothing, guess extension and it
    // excludes every .temp file on the machine. The field asks for
    // "*.iso" instead, which is a thing that can be explained.
    expect(classifyExclusion('iso')).toBeNull();
    expect(classifyExclusion('temp')).toBeNull();
    expect(classifyExclusion('Downloads')).toBeNull();
  });

  it('reads an absolute folder as a folder', () => {
    expect(classifyExclusion('D:\\Games')).toEqual({ kind: 'folder', value: 'D:\\Games' });
    expect(classifyExclusion('C:/Users/jim/Downloads')).toEqual({ kind: 'folder', value: 'C:/Users/jim/Downloads' });
    expect(classifyExclusion('\\\\server\\share')).toEqual({ kind: 'folder', value: '\\\\server\\share' });
  });

  it('does not mistake a folder with a dot in it for an extension', () => {
    // "D:\\Games\\Half-Life 2" and "C:\\node.js" both contain dots and are
    // unambiguously folders -- they carry a separator or a drive.
    expect(classifyExclusion('C:\\node.js').kind).toBe('folder');
    expect(classifyExclusion('D:\\Games\\Half-Life 2').kind).toBe('folder');
  });

  it('refuses nothing, and refuses a lone dot or star', () => {
    for (const input of ['', '   ', null, undefined, '.', '*', '*.', 42]) {
      expect(classifyExclusion(input), String(input)).toBeNull();
    }
  });

  it('refuses an extension with a separator hiding in it', () => {
    // "*.iso\\..\\.." is not an extension and must not be stored as one.
    expect(classifyExclusion('*.is/o')).toBeNull();
    expect(classifyExclusion('.is\\o')).toBeNull();
  });
});
