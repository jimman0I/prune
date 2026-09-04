import { describe, it, expect } from 'vitest';
import {
  buildTypeColors,
  colorForExtension,
  colorForNode,
  extensionOf,
  NO_EXTENSION_COLOR,
  UNSCANNED_COLOR,
  DIRECTORY_COLOR
} from './fileTypeColors.js';

const HEX = /^#[0-9a-f]{6}$/i;

describe('extensionOf', () => {
  it('takes the last extension, lowercased and without its dot', () => {
    expect(extensionOf('setup.EXE')).toBe('exe');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
  });

  it('is empty for a name with no extension', () => {
    expect(extensionOf('LICENSE')).toBe('');
    expect(extensionOf('')).toBe('');
    expect(extensionOf(null)).toBe('');
  });

  it('does not treat a dotfile as an extension', () => {
    // ".gitignore" is a name, not a type. Reading it as one would file
    // every dotfile on the machine under a type nobody would recognise.
    expect(extensionOf('.gitignore')).toBe('');
    expect(extensionOf('.env')).toBe('');
  });

  it('ignores a trailing dot rather than inventing an empty type', () => {
    expect(extensionOf('weird.')).toBe('');
  });
});

describe('buildTypeColors', () => {
  // The reason this is assigned by rank rather than hashed: with sixteen
  // colours and eight common types, a hash collides about as often as not,
  // and a collision between two types actually on screen breaks the one
  // thing the colour is for. These eight are the biggest on this drive and
  // hashing gave them six colours.
  it('gives every type in the legend a colour of its own', () => {
    const common = ['pak', 'dll', 'exe', 'cache', 'mp4', 'zip', 'iso', 'log'];
    const colors = buildTypeColors(common);
    expect(new Set(colors.values()).size).toBe(common.length);
  });

  it('assigns down the ranked list, so the biggest type leads', () => {
    const first = buildTypeColors(['pak', 'dll']);
    const swapped = buildTypeColors(['dll', 'pak']);
    expect(first.get('pak')).toBe(swapped.get('dll'));
    expect(first.get('pak')).not.toBe(first.get('dll'));
  });

  it('normalizes case and a leading dot before assigning', () => {
    const colors = buildTypeColors(['.PAK', 'pak', 'Pak']);
    expect(colors.size).toBe(1);
    expect(colors.get('pak')).toMatch(HEX);
  });

  it('keeps going past the end of the palette', () => {
    // Everything beyond it is a sliver, and a repeated colour among those
    // costs nothing -- but it must still get a real colour.
    const many = Array.from({ length: 40 }, (_, i) => `ext${i}`);
    const colors = buildTypeColors(many);
    expect(colors.size).toBe(40);
    for (const color of colors.values()) expect(color).toMatch(HEX);
  });

  it('never assigns a colour to "no type"', () => {
    // It is the absence of the thing being encoded, not a category, and a
    // palette slot would make it compete with .dll and .pak.
    expect(buildTypeColors(['', '   ', null]).size).toBe(0);
  });

  it('copes with no list', () => {
    expect(buildTypeColors(null).size).toBe(0);
  });
});

describe('colorForExtension', () => {
  const colors = buildTypeColors(['pak', 'dll']);

  it('reads the colour the breakdown assigned', () => {
    expect(colorForExtension('pak', colors)).toBe(colors.get('pak'));
  });

  it('does not care about case or a leading dot', () => {
    expect(colorForExtension('.PAK', colors)).toBe(colorForExtension('pak', colors));
  });

  it('still paints a type the breakdown never listed', () => {
    // A file whose type is too small to reach the legend still occupies
    // area on the map, and an unpainted cell would read as a hole.
    expect(colorForExtension('obscure', colors)).toMatch(HEX);
  });

  it('paints without any breakdown at all', () => {
    // The map renders before the breakdown is derived on first paint.
    expect(colorForExtension('pak')).toMatch(HEX);
  });

  it('uses the neutral for a file with no type at all', () => {
    expect(colorForExtension('', colors)).toBe(NO_EXTENSION_COLOR);
    expect(colorForExtension('   ', colors)).toBe(NO_EXTENSION_COLOR);
    expect(colorForExtension(null, colors)).toBe(NO_EXTENSION_COLOR);
    expect(colorForExtension(undefined, colors)).toBe(NO_EXTENSION_COLOR);
  });
});

describe('colorForNode', () => {
  const colors = buildTypeColors(['pak', 'dll']);

  it('paints a file by its type', () => {
    expect(colorForNode({ name: 'game.pak', type: 'file' }, colors)).toBe(colors.get('pak'));
  });

  it('paints an unscanned region as unscanned, not as a directory', () => {
    // It IS a directory, so the check has to come first -- that ordering
    // is the whole distinction between "empty" and "never opened".
    expect(colorForNode({ name: 'Windows', type: 'directory', scanned: false }, colors)).toBe(UNSCANNED_COLOR);
  });

  it('paints a directory with the directory neutral', () => {
    expect(colorForNode({ name: 'Users', type: 'directory' }, colors)).toBe(DIRECTORY_COLOR);
    expect(colorForNode(null, colors)).toBe(DIRECTORY_COLOR);
  });

  it('paints an extensionless file with the no-type neutral, not the directory one', () => {
    // Both are grey, deliberately, but they are different greys: one is a
    // container and the other is content nobody can categorise.
    expect(colorForNode({ name: 'LICENSE', type: 'file' }, colors)).toBe(NO_EXTENSION_COLOR);
    expect(colorForNode({ name: 'LICENSE', type: 'file' }, colors)).not.toBe(DIRECTORY_COLOR);
  });
});
