import { describe, it, expect } from 'vitest';
import { splitPath } from './pathDisplay.js';

describe('splitPath', () => {
  it('puts the file name alone, and the folder in a shrinkable head plus a protected last folder', () => {
    expect(splitPath('C:\\Users\\jim\\Pictures\\2019\\a.jpg')).toEqual({
      name: 'a.jpg',
      dir: 'C:\\Users\\jim\\Pictures\\2019',
      head: 'C:\\Users\\jim\\Pictures',
      tail: '\\2019'
    });
  });

  it('never loses or alters a character: head + tail + separator + name is the input', () => {
    const path = 'D:\\Backups\\Old laptop\\Documents\\Taxes 2018\\return (final).pdf';
    const { name, head, tail } = splitPath(path);
    expect(`${head}${tail}\\${name}`).toBe(path);
  });

  it('copes with forward slashes', () => {
    const parts = splitPath('C:/Users/jim/a.jpg');
    expect(parts.name).toBe('a.jpg');
    expect(`${parts.head}${parts.tail}/${parts.name}`).toBe('C:/Users/jim/a.jpg');
  });

  it('has nothing to cut for a file directly under a drive or a single folder', () => {
    expect(splitPath('C:\\a.jpg')).toEqual({ name: 'a.jpg', dir: 'C:', head: 'C:', tail: '' });
    expect(splitPath('C:\\Pictures\\a.jpg')).toEqual({ name: 'a.jpg', dir: 'C:\\Pictures', head: 'C:', tail: '\\Pictures' });
  });

  it('treats a bare name and junk input as just a name', () => {
    expect(splitPath('a.jpg')).toEqual({ name: 'a.jpg', dir: '', head: '', tail: '' });
    expect(splitPath(undefined).name).toBe('');
  });
});
