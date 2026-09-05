import { describe, it, expect } from 'vitest';
import { breadcrumbTrail } from './breadcrumbTrail.js';

describe('breadcrumbTrail', () => {
  it('splits a path into clickable segments, each carrying its own full path', () => {
    // The label is what you read; the path is where clicking goes. They
    // are not the same string and the crumb has to carry both.
    expect(breadcrumbTrail('C:\\Users\\jimmanol\\AppData')).toEqual([
      { label: 'C:', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'jimmanol', path: 'C:\\Users\\jimmanol' },
      { label: 'AppData', path: 'C:\\Users\\jimmanol\\AppData' }
    ]);
  });

  it('gives a drive root a single crumb', () => {
    expect(breadcrumbTrail('C:\\')).toEqual([{ label: 'C:', path: 'C:\\' }]);
    expect(breadcrumbTrail('C:')).toEqual([{ label: 'C:', path: 'C:\\' }]);
  });

  it('ignores a trailing separator', () => {
    // Both spellings reach here: the drill-down builds paths by joining,
    // and the drive root carries its own backslash.
    expect(breadcrumbTrail('C:\\Users\\')).toEqual(breadcrumbTrail('C:\\Users'));
  });

  it('does not produce an empty crumb from a doubled separator', () => {
    const trail = breadcrumbTrail('C:\\Users\\\\jimmanol');
    expect(trail.every((c) => c.label !== '')).toBe(true);
    expect(trail.map((c) => c.label)).toEqual(['C:', 'Users', 'jimmanol']);
  });

  it('keeps a UNC share whole rather than splitting its host off', () => {
    // \\\\server\\share is one location, not a crumb called "" followed by
    // a crumb called "server". Clicking a half of it goes nowhere.
    const trail = breadcrumbTrail('\\\\server\\share\\folder');
    expect(trail[0]).toEqual({ label: '\\\\server\\share', path: '\\\\server\\share' });
    expect(trail[1]).toEqual({ label: 'folder', path: '\\\\server\\share\\folder' });
  });

  it('accepts forward slashes', () => {
    expect(breadcrumbTrail('C:/Users/jim').map((c) => c.label)).toEqual(['C:', 'Users', 'jim']);
  });

  it('has nothing to show for nothing', () => {
    expect(breadcrumbTrail('')).toEqual([]);
    expect(breadcrumbTrail(null)).toEqual([]);
    expect(breadcrumbTrail('   ')).toEqual([]);
  });
});
