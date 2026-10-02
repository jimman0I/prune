import { describe, it, expect } from 'vitest';
import { largestFiles } from './largestFiles.js';

describe('largestFiles with a search', () => {
  const big = {
    name: 'D:', type: 'directory', size: 0, fullPath: 'D:\\',
    children: [
      { name: 'a.pak', type: 'file', size: 900, fullPath: 'D:\\a.pak' },
      { name: 'b.iso', type: 'file', size: 800, fullPath: 'D:\\b.iso' },
      { name: 'c.pak', type: 'file', size: 700, fullPath: 'D:\\x\\c.pak' },
      { name: 'd.pak', type: 'file', size: 5, fullPath: 'D:\\d.pak' }
    ]
  };

  it('lists the biggest files that match, not the matches among the biggest', () => {
    // a.pak and b.iso are the two biggest; with a limit of 2 a post-filter
    // would find only a.pak. The search happens before the limit.
    const files = largestFiles(big, { limit: 2, filterText: '*.pak' });
    expect(files.map((f) => f.name)).toEqual(['a.pak', 'c.pak']);
  });

  it('understands wildcards, regex and plain text', () => {
    expect(largestFiles(big, { filterText: 'iso' }).map((f) => f.name)).toEqual(['b.iso']);
    expect(largestFiles(big, { filterText: '/^[ab]\\./' }).map((f) => f.name)).toEqual(['a.pak', 'b.iso']);
  });

  it('matches a full path when the search names a folder', () => {
    expect(largestFiles(big, { filterText: 'D:\\x\\*' }).map((f) => f.name)).toEqual(['c.pak']);
  });

  it('applies no filter for blank text or an invalid pattern', () => {
    expect(largestFiles(big, { filterText: '' })).toHaveLength(4);
    expect(largestFiles(big, { filterText: '/(/' })).toHaveLength(4);
  });
});
