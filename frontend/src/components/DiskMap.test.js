import { describe, it, expect } from 'vitest';
import { breadcrumbSegments } from './DiskMap.jsx';

describe('breadcrumbSegments', () => {
  it('returns one segment for a bare drive root', () => {
    expect(breadcrumbSegments('C:\\')).toEqual([{ label: 'C:', path: 'C:\\' }]);
  });

  it('builds a growing path for each nested segment', () => {
    expect(breadcrumbSegments('C:\\Users\\Jim')).toEqual([
      { label: 'C:', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'Jim', path: 'C:\\Users\\Jim' }
    ]);
  });

  it('tolerates a trailing backslash on a nested path', () => {
    expect(breadcrumbSegments('C:\\Users\\Jim\\')).toEqual([
      { label: 'C:', path: 'C:\\' },
      { label: 'Users', path: 'C:\\Users' },
      { label: 'Jim', path: 'C:\\Users\\Jim' }
    ]);
  });
});
