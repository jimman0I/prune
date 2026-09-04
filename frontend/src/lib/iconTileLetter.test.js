import { describe, it, expect } from 'vitest';
import { tileLetter } from './iconTileLetter.js';

describe('tileLetter', () => {
  it('skips a vendor word the publisher already says', () => {
    // The whole point. Twenty-six of the forty-six lettered tiles on this
    // machine were "M", because a program with no icon of its own is
    // overwhelmingly a system component named after its vendor -- and the
    // vendor is already in the Company column two across.
    expect(tileLetter('Microsoft Visual C++ 2013 Redistributable (x64)', 'Microsoft Corporation')).toBe('V');
    expect(tileLetter('Microsoft Windows Desktop Runtime - 9.0.19 (x64)', 'Microsoft Corporation')).toBe('W');
    expect(tileLetter('Microsoft ASP.NET Core 9.0.19 - Shared Framework', 'Microsoft Corporation')).toBe('A');
    expect(tileLetter('Microsoft GameInput', 'Microsoft Corporation')).toBe('G');
  });

  it('skips punctuation to reach a real letter', () => {
    // ".NET SDK" would otherwise put a full stop in the tile.
    expect(tileLetter('Microsoft .NET SDK 9.0.317 (x64)', 'Microsoft Corporation')).toBe('N');
  });

  it('leaves the name alone when it does not start with the vendor', () => {
    expect(tileLetter('Windows Software Development Kit', 'Microsoft Corporation')).toBe('W');
    expect(tileLetter('PowerShell 7.6.5.0-x64', 'Microsoft Corporation')).toBe('P');
    expect(tileLetter('SharePoint Client Components', 'Microsoft Corporation')).toBe('S');
  });

  it('keeps the vendor word when it is the whole name', () => {
    // Stripping would leave nothing at all. A program named exactly after
    // its publisher is common -- Discord, Viber, Dropbox.
    expect(tileLetter('Viber', 'Viber Media')).toBe('V');
    expect(tileLetter('Discord', 'Discord Inc.')).toBe('D');
    expect(tileLetter('Microsoft', 'Microsoft Corporation')).toBe('M');
  });

  it('ignores the placeholder publisher', () => {
    // "Unknown Publisher" is what the program list substitutes when the
    // registry has none. Matching its first word against a program named
    // "Unknown ..." would strip a word for no reason.
    expect(tileLetter('Unknown Device Driver', 'Unknown Publisher')).toBe('U');
    expect(tileLetter('Microsoft Windows Application Compatibility Fix Database', 'Unknown Publisher')).toBe('M');
  });

  it('matches a vendor whose publisher carries punctuation', () => {
    expect(tileLetter('Epic Games Launcher', 'Epic Games, Inc.')).toBe('G');
    expect(tileLetter('GitHub CLI', 'GitHub, Inc.')).toBe('C');
  });

  it('matches case-insensitively but always shows a capital', () => {
    expect(tileLetter('uv', 'Astral Software Inc.')).toBe('U');
    expect(tileLetter('microsoft visual studio', 'MICROSOFT CORPORATION')).toBe('V');
  });

  it('is happy with a name that starts with a digit', () => {
    expect(tileLetter('7-Zip 25.01 (x64)', 'Igor Pavlov')).toBe('7');
  });

  it('never returns nothing', () => {
    // The tile always renders; an empty one is a coral square that says
    // less than the letter it replaced.
    expect(tileLetter('', 'Microsoft')).toBe('?');
    expect(tileLetter(null, null)).toBe('?');
    expect(tileLetter('...', null)).toBe('?');
  });

  it('works with no publisher at all', () => {
    // Startup entries have one only when the executable carries a version
    // resource, and most of the interesting ones do not.
    expect(tileLetter('RtkAudUService', null)).toBe('R');
    expect(tileLetter('Discord', undefined)).toBe('D');
  });
});
