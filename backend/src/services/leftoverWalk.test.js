import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkForLeftovers, measureDirectory } from './leftoverWalk.js';

/** Real directory trees under a temp folder: the walk is plain fs, so there
 * is nothing to mock and a mock would only prove it called itself. */
let base;
beforeEach(() => { base = mkdtempSync(join(tmpdir(), 'prune-walk-')); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const dir = (...parts) => { const p = join(base, ...parts); mkdirSync(p, { recursive: true }); return p; };
const file = (...parts) => { const p = join(base, ...parts); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, 'x'); return p; };
const matchName = (word) => (name) => name.toLowerCase().includes(word);

describe('measureDirectory', () => {
  it('adds up every file below a folder', async () => {
    writeFileSync(file('m', 'a.bin'), Buffer.alloc(10));
    writeFileSync(file('m', 'sub', 'b.bin'), Buffer.alloc(32));
    expect(await measureDirectory(join(base, 'm'))).toBe(42);
  });

  it('is zero for a path that is not there', async () => {
    expect(await measureDirectory(join(base, 'missing'))).toBe(0);
  });

  it('stops counting at its entry budget instead of walking a huge tree', async () => {
    for (let i = 0; i < 6; i += 1) writeFileSync(file('big', `f${i}.bin`), Buffer.alloc(10));
    expect(await measureDirectory(join(base, 'big'), { maxEntries: 3 })).toBeLessThan(60);
  });
});

describe('walkForLeftovers', () => {
  it('finds a matching folder several levels down, not just one level under the root', async () => {
    const deep = dir('root', 'Vendor', 'Suite', 'Acme Tool');
    const { matches } = await walkForLeftovers({ roots: [{ path: join(base, 'root'), depth: 3 }], isMatch: matchName('acme') });
    expect(matches.map((m) => m.path)).toEqual([deep]);
  });

  it('does not look deeper than the root is allowed to', async () => {
    dir('root', 'a', 'b', 'c', 'Acme Deep');
    const shallow = await walkForLeftovers({ roots: [{ path: join(base, 'root'), depth: 2 }], isMatch: matchName('acme') });
    expect(shallow.matches).toEqual([]);
  });

  it('reports a matching folder once and does not descend into it', async () => {
    dir('root', 'Acme', 'Acme Cache');
    const { matches } = await walkForLeftovers({ roots: [{ path: join(base, 'root'), depth: 3 }], isMatch: matchName('acme') });
    expect(matches.map((m) => m.path)).toEqual([join(base, 'root', 'Acme')]);
  });

  it('matches files only in roots that ask for shortcuts, and only .lnk/.url ones', async () => {
    const lnk = file('start', 'Acme.lnk');
    file('start', 'Acme notes.txt');
    file('plain', 'Acme.lnk');
    const { matches } = await walkForLeftovers({
      roots: [{ path: join(base, 'start'), depth: 2, shortcuts: true }, { path: join(base, 'plain'), depth: 2 }],
      isMatch: matchName('acme')
    });
    expect(matches.map((m) => m.path)).toEqual([lnk]);
    expect(matches[0].isDirectory).toBe(false);
  });

  it('skips a root that does not exist', async () => {
    const { matches } = await walkForLeftovers({ roots: [{ path: join(base, 'nope'), depth: 2 }], isMatch: () => true });
    expect(matches).toEqual([]);
  });

  it('never descends into a directory the caller says to skip', async () => {
    dir('root', 'WindowsApps', 'Acme');
    dir('root', 'Other', 'Acme');
    const { matches } = await walkForLeftovers({
      roots: [{ path: join(base, 'root'), depth: 3 }],
      isMatch: matchName('acme'),
      skipDescent: (name) => name.toLowerCase() === 'windowsapps'
    });
    expect(matches.map((m) => m.path)).toEqual([join(base, 'root', 'Other', 'Acme')]);
  });

  it('stops at its time budget and says the result is partial', async () => {
    dir('root', 'a', 'b');
    let t = 0;
    const { truncated } = await walkForLeftovers({
      roots: [{ path: join(base, 'root'), depth: 3 }],
      isMatch: () => false,
      budgetMs: 10,
      now: () => (t += 100)
    });
    expect(truncated).toBe(true);
  });

  it('stops at its entry budget and says the result is partial', async () => {
    for (let i = 0; i < 5; i += 1) dir('root', `d${i}`);
    const { truncated, visited } = await walkForLeftovers({
      roots: [{ path: join(base, 'root'), depth: 3 }],
      isMatch: () => false,
      maxEntries: 3
    });
    expect(truncated).toBe(true);
    expect(visited).toBeLessThanOrEqual(3);
  });
});
