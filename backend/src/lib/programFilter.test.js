import { describe, it, expect } from 'vitest';
import { wildcardToRegExp, matchPrograms, describeProgram } from './programFilter.js';

const programs = [
  { name: 'Microsoft Edge', version: '1', publisher: 'Microsoft', installLocation: 'C:\\Edge', uninstallString: 'edge.exe /u' },
  { name: 'Microsoft Visual C++ 2015-2022 Redistributable (x64)', version: '14', publisher: 'Microsoft' },
  { name: '7-Zip', version: '24', publisher: 'Igor Pavlov' },
  { name: 'Edge Tools', version: '2', publisher: 'Someone' }
];

describe('wildcardToRegExp', () => {
  it('matches the whole name, case-insensitively', () => {
    expect(wildcardToRegExp('7-zip').test('7-Zip')).toBe(true);
    expect(wildcardToRegExp('Edge').test('Microsoft Edge')).toBe(false);
  });

  it('lets * stand for any run of characters and ? for exactly one', () => {
    expect(wildcardToRegExp('Microso*').test('Microsoft Edge')).toBe(true);
    expect(wildcardToRegExp('*Edge').test('Microsoft Edge')).toBe(true);
    expect(wildcardToRegExp('7-Zi?').test('7-Zip')).toBe(true);
    expect(wildcardToRegExp('7-Zi?').test('7-Zi')).toBe(false);
  });

  it('treats every other character literally, regex metacharacters included', () => {
    const regex = wildcardToRegExp('C++ Builder (x64) [beta] $1');
    expect(regex.test('C++ Builder (x64) [beta] $1')).toBe(true);
    expect(regex.test('C Builder (x64) [beta] $1')).toBe(false);
    // a dot is a dot, not "any character"
    expect(wildcardToRegExp('a.b').test('axb')).toBe(false);
  });
});

describe('matchPrograms', () => {
  it('returns everything when there is no pattern', () => {
    for (const none of [undefined, null, '', '   ']) expect(matchPrograms(programs, none)).toHaveLength(4);
  });

  it('keeps the order it was given', () => {
    expect(matchPrograms(programs, 'Microso*').map((p) => p.name)).toEqual([
      'Microsoft Edge', 'Microsoft Visual C++ 2015-2022 Redistributable (x64)'
    ]);
  });

  it('does not match a part of a name without a wildcard', () => {
    expect(matchPrograms(programs, 'Edge')).toEqual([]);
    expect(matchPrograms(programs, '*Edge*').map((p) => p.name)).toEqual(['Microsoft Edge', 'Edge Tools']);
  });

  it('survives a list with junk in it', () => {
    expect(matchPrograms([null, {}, { name: 5 }, programs[2]], '7-Zip')).toEqual([programs[2]]);
    expect(matchPrograms(undefined, 'x')).toEqual([]);
  });
});

describe('describeProgram', () => {
  it('leaves the install location and uninstall command out unless asked', () => {
    const row = describeProgram(programs[0]);
    expect(row).not.toHaveProperty('installLocation');
    expect(row).not.toHaveProperty('uninstallCommand');
    expect(row).toMatchObject({ name: 'Microsoft Edge', version: '1', publisher: 'Microsoft', source: 'registry' });
  });

  it('adds them when asked, as null when the program has none', () => {
    expect(describeProgram(programs[0], { installLocation: true, uninstallCommand: true })).toMatchObject({
      installLocation: 'C:\\Edge', uninstallCommand: 'edge.exe /u'
    });
    expect(describeProgram(programs[2], { installLocation: true, uninstallCommand: true })).toMatchObject({
      installLocation: null, uninstallCommand: null
    });
  });

  it('marks a Store app', () => {
    expect(describeProgram({ name: 'Photos', source: 'store' }).source).toBe('store');
  });
});
