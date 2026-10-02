import { describe, it, expect } from 'vitest';
import { normalizeArchive, MAX_DEPTH } from './scanArchive.js';

const good = () => ({
  v: 1,
  root: { n: 'C:', s: 100, a: 120, f: 3, d: 1, c: [{ n: 'Games', s: 60, m: 1788000000000, fc: 2, fb: 60 }] },
  top: [{ p: 'C:\\Games\\a.pak', s: 40, a: 40, m: 1788000000000 }]
});

describe('normalizeArchive', () => {
  it('accepts a well-formed archive and returns a rebuilt copy', () => {
    const input = good();
    const result = normalizeArchive(input);
    expect(result.ok).toBe(true);
    expect(result.archive).toEqual(input);
    expect(result.archive).not.toBe(input);
    expect(result.nodeCount).toBe(2);
  });

  it('drops fields it does not know instead of storing them', () => {
    const input = good();
    input.root.evil = '<script>';
    input.root.c[0].__proto__x = 1;
    input.extra = { huge: 'x'.repeat(10) };
    const { archive } = normalizeArchive(input);
    expect(archive.root.evil).toBeUndefined();
    expect(archive.extra).toBeUndefined();
  });

  it('refuses another version, a missing root, and non-objects', () => {
    expect(normalizeArchive(null).ok).toBe(false);
    expect(normalizeArchive({ v: 2, root: good().root }).ok).toBe(false);
    expect(normalizeArchive({ v: 1 }).ok).toBe(false);
    expect(normalizeArchive('x').ok).toBe(false);
  });

  it('refuses a folder with a bad name or size, anywhere in the tree', () => {
    for (const mutate of [
      (a) => { a.root.c[0].n = ''; },
      (a) => { a.root.c[0].n = 5; },
      (a) => { a.root.c[0].s = -1; },
      (a) => { a.root.c[0].s = 'big'; },
      (a) => { a.root.c[0].s = Infinity; },
      (a) => { a.root.n = 'x'.repeat(2000); }
    ]) {
      const a = good();
      mutate(a);
      expect(normalizeArchive(a).ok).toBe(false);
    }
  });

  it('ignores optional numbers that are not numbers', () => {
    const a = good();
    a.root.c[0].m = 'yesterday';
    a.root.c[0].fc = -3;
    const { archive } = normalizeArchive(a);
    expect(archive.root.c[0].m).toBeUndefined();
    expect(archive.root.c[0].fc).toBeUndefined();
  });

  it('refuses a tree nested deeper than it saves, without overflowing the stack', () => {
    let node = { n: 'leaf', s: 1 };
    for (let i = 0; i < MAX_DEPTH + 50; i++) node = { n: `d${i}`, s: 1, c: [node] };
    expect(normalizeArchive({ v: 1, root: node, top: [] }).ok).toBe(false);
  });

  it('keeps only well-formed top files', () => {
    const a = good();
    a.top = [{ p: 'C:\\ok.bin', s: 5 }, { p: 5, s: 5 }, { p: 'C:\\neg.bin', s: -1 }, null];
    expect(normalizeArchive(a).archive.top).toEqual([{ p: 'C:\\ok.bin', s: 5 }]);
  });

  it('copes with no top list', () => {
    const a = good();
    delete a.top;
    expect(normalizeArchive(a).archive.top).toEqual([]);
  });
});
