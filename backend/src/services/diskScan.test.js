import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDirectory } from './diskScan.js';

// node:fs's ESM namespace is frozen -- vi.spyOn can't redefine its exports
// directly (Vitest throws "Cannot redefine property"). vi.mock with a
// partial passthrough is the standard workaround: statSync/readdirSync
// become real vi.fn()s (still calling through to the real implementation
// by default, stashed as __actual below), so individual tests can swap in
// a throwing implementation for one specific path and every other test
// keeps exercising real disk I/O unmodified.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, statSync: vi.fn(actual.statSync), readdirSync: vi.fn(actual.readdirSync), __actual: actual };
});

describe('scanDirectory (real file I/O)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'unrevo-diskscan-'));
  });

  afterEach(() => {
    fs.statSync.mockImplementation(fs.__actual.statSync);
    fs.readdirSync.mockImplementation(fs.__actual.readdirSync);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns { name, size, type: "file" } for a single file', () => {
    const filePath = join(dir, 'a.txt');
    writeFileSync(filePath, 'hello'); // 5 bytes
    expect(scanDirectory(filePath)).toEqual({ name: 'a.txt', size: 5, type: 'file' });
  });

  it('returns a hierarchical tree with correct total sizes and per-node types', () => {
    writeFileSync(join(dir, 'top.txt'), '12345'); // 5 bytes
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'nested.txt'), '1234567890'); // 10 bytes

    const result = scanDirectory(dir);
    expect(result.type).toBe('directory');
    expect(result.size).toBe(15);
    expect(result.children.map(c => c.name).sort()).toEqual(['sub', 'top.txt']);
    const sub = result.children.find(c => c.name === 'sub');
    expect(sub.type).toBe('directory');
    expect(sub.size).toBe(10);
    expect(sub.children).toEqual([{ name: 'nested.txt', size: 10, type: 'file' }]);
  });

  // A depth-capped directory and a plain file both end up shaped
  // { name, size, type } with no `children` key -- `type` is what lets the
  // frontend still tell them apart (a capped directory is clickable to
  // drill into via a fresh scan; a file never is).
  it('marks a depth-capped node as type "directory" even without a children array', () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'deep.txt'), '123');

    const result = scanDirectory(dir, 1);
    const a = result.children.find(c => c.name === 'a');
    expect(a).toEqual({ name: 'a', size: 3, type: 'directory' });
  });

  it('omits an entry it cannot stat, without crashing the whole scan', () => {
    writeFileSync(join(dir, 'readable.txt'), 'ok'); // 2 bytes
    writeFileSync(join(dir, 'locked.txt'), 'nope'); // 4 bytes, but statSync is mocked to throw for it

    fs.statSync.mockImplementation((p, ...rest) => {
      if (String(p).endsWith('locked.txt')) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
      return fs.__actual.statSync(p, ...rest);
    });

    const result = scanDirectory(dir);
    expect(result.children.map(c => c.name)).toEqual(['readable.txt']);
    expect(result.size).toBe(2); // locked.txt contributes nothing, isn't listed
  });

  it('reports a size-0 placeholder for a directory it can stat but not list ' +
    '(the "System Volume Information" shape)', () => {
    mkdirSync(join(dir, 'opaque'));
    writeFileSync(join(dir, 'visible.txt'), 'ab'); // 2 bytes

    fs.readdirSync.mockImplementation((p, ...rest) => {
      if (String(p).endsWith('opaque')) throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
      return fs.__actual.readdirSync(p, ...rest);
    });

    const result = scanDirectory(dir);
    const opaque = result.children.find(c => c.name === 'opaque');
    expect(opaque).toEqual({ name: 'opaque', size: 0, type: 'directory', children: [] });
    // Its unreadable contents contribute nothing we can't verify -- 0 is honest.
    const visible = result.children.find(c => c.name === 'visible.txt');
    expect(visible.size).toBe(2);
  });

  it('returns null for a path that does not exist, rather than throwing', () => {
    expect(scanDirectory(join(dir, 'does-not-exist'))).toBeNull();
  });

  it('caps the returned tree depth while keeping every total size accurate', () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'deep.txt'), '123'); // 3 bytes

    const result = scanDirectory(dir, 1);
    expect(result.size).toBe(3);
    const a = result.children.find(c => c.name === 'a');
    expect(a.size).toBe(3); // still accurate...
    expect(a.children).toBeUndefined(); // ...even though the depth cap hides its children
  });
});
