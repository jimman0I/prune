import { describe, it, expect } from 'vitest';
import { matchesExtension } from './exclusionInput.js';

describe('matchesExtension', () => {
  it('matches a file by its extension', () => {
    expect(matchesExtension('D:\\Games\\disc.iso', ['.iso'])).toBe(true);
    expect(matchesExtension('D:\\Games\\disc.ISO', ['.iso'])).toBe(true);
  });

  it('does not match a different extension', () => {
    expect(matchesExtension('D:\\Games\\disc.isolated', ['.iso'])).toBe(false);
    expect(matchesExtension('D:\\Games\\notiso', ['.iso'])).toBe(false);
  });

  it('matches only the last extension', () => {
    // "backup.iso.tmp" is a .tmp file. Excluding it because ".iso" appears
    // in the middle would protect exactly the wrong file.
    expect(matchesExtension('C:\\x\\backup.iso.tmp', ['.iso'])).toBe(false);
    expect(matchesExtension('C:\\x\\backup.tmp.iso', ['.iso'])).toBe(true);
  });

  it('handles a dotfile with no extension', () => {
    expect(matchesExtension('C:\\x\\.gitignore', ['.gitignore'])).toBe(false);
  });

  it('copes with an empty or missing list', () => {
    expect(matchesExtension('C:\\x\\a.iso', [])).toBe(false);
    expect(matchesExtension('C:\\x\\a.iso', null)).toBe(false);
    expect(matchesExtension(null, ['.iso'])).toBe(false);
  });
});
