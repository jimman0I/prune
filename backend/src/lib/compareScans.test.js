import { describe, it, expect } from 'vitest';
import { compareScans } from './compareScans.js';

const dir = (n, s, c) => (c ? { n, s, c } : { n, s });
const scan = (root) => ({ v: 1, root, top: [] });

const older = scan(dir('C:', 1000, [
  dir('Games', 400, [dir('Steam', 300), dir('Old', 100)]),
  dir('Users', 300, [dir('me', 300, [dir('AppData', 250), dir('Docs', 50)])]),
  dir('Temp', 200),
  dir('Gone', 100)
]));

const newer = scan(dir('C:', 1500, [
  dir('Games', 400, [dir('Steam', 400)]),
  dir('Users', 800, [dir('me', 800, [dir('AppData', 750), dir('Docs', 50)])]),
  dir('Temp', 50),
  dir('Fresh', 250, [dir('inner', 200)])
]));

describe('compareScans', () => {
  const result = compareScans(older, newer);

  it('reports the total change', () => {
    expect(result.totalBefore).toBe(1000);
    expect(result.totalAfter).toBe(1500);
    expect(result.delta).toBe(500);
  });

  it('lists what grew, biggest change first, naming the deepest folder that explains it', () => {
    const paths = result.grew.map((r) => r.path);
    // Users and Users\me grew 500 each, but all of it is AppData.
    expect(paths).toContain('C:\\Users\\me\\AppData');
    expect(paths).not.toContain('C:\\Users');
    expect(paths).not.toContain('C:\\Users\\me');
    expect(result.grew[0]).toEqual({ path: 'C:\\Users\\me\\AppData', before: 250, after: 750, delta: 500 });
  });

  it('keeps a parent that its children only partly explain', () => {
    const a = scan(dir('C:', 100, [dir('P', 100, [dir('x', 50), dir('y', 50)])]));
    const b = scan(dir('C:', 200, [dir('P', 200, [dir('x', 100), dir('y', 100)])]));
    const paths = compareScans(a, b).grew.map((r) => r.path);
    expect(paths).toContain('C:\\P');
    expect(paths).toContain('C:\\P\\x');
  });

  it('lists what shrank', () => {
    expect(result.shrank).toEqual([{ path: 'C:\\Temp', before: 200, after: 50, delta: -150 }]);
  });

  it('lists a new folder once, not every folder inside it', () => {
    expect(result.added).toEqual([{ path: 'C:\\Fresh', size: 250 }]);
  });

  it('lists a removed folder once, not every folder inside it', () => {
    const removedPaths = result.removed.map((r) => r.path);
    expect(removedPaths).toContain('C:\\Gone');
    expect(removedPaths).toContain('C:\\Games\\Old');
    expect(removedPaths).not.toContain('C:\\Games\\Old\\anything');
  });

  it('matches folders regardless of case', () => {
    const a = scan(dir('C:', 10, [dir('Docs', 10)]));
    const b = scan(dir('c:', 30, [dir('DOCS', 30)]));
    const r = compareScans(a, b);
    expect(r.grew).toHaveLength(1);
    expect(r.added).toHaveLength(0);
    expect(r.removed).toHaveLength(0);
  });

  it('honours the limit', () => {
    const kids = (s) => Array.from({ length: 10 }, (_, i) => dir(`k${i}`, s + i));
    const r = compareScans(scan(dir('C:', 100, kids(1))), scan(dir('C:', 900, kids(100))), { limit: 3 });
    expect(r.grew).toHaveLength(3);
  });

  it('says nothing changed for identical scans', () => {
    const r = compareScans(older, older);
    expect(r.delta).toBe(0);
    expect([r.grew, r.shrank, r.added, r.removed].every((l) => l.length === 0)).toBe(true);
  });
});
