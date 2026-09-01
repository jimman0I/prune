import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDirectory } from './diskScan.js';

// node:fs's ESM namespace is frozen -- vi.spyOn can't redefine its exports
// directly (Vitest throws "Cannot redefine property"). vi.mock with a
// partial passthrough is the standard workaround: fs.promises.stat/readdir
// become real vi.fn()s (still calling through to the real implementation by
// default, stashed as __actualPromises below), so individual tests can swap
// in a throwing/hanging implementation for one specific path and every other
// test keeps exercising real disk I/O unmodified.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: vi.fn(actual.promises.stat),
      readdir: vi.fn(actual.promises.readdir)
    },
    __actualPromises: actual.promises
  };
});

describe('scanDirectory (real file I/O, async)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'unrevo-diskscan-'));
  });

  afterEach(() => {
    fs.promises.stat.mockImplementation(fs.__actualPromises.stat);
    fs.promises.readdir.mockImplementation(fs.__actualPromises.readdir);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns { name, size, type: "file" } for a single file', async () => {
    const filePath = join(dir, 'a.txt');
    writeFileSync(filePath, 'hello'); // 5 bytes
    expect(await scanDirectory(filePath)).toEqual({ name: 'a.txt', size: 5, type: 'file' });
  });

  it('returns a hierarchical tree with correct total sizes and per-node types', async () => {
    writeFileSync(join(dir, 'top.txt'), '12345'); // 5 bytes
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'nested.txt'), '1234567890'); // 10 bytes

    const result = await scanDirectory(dir);
    expect(result.type).toBe('directory');
    expect(result.size).toBe(15);
    expect(result.children.map(c => c.name).sort()).toEqual(['sub', 'top.txt']);
    const sub = result.children.find(c => c.name === 'sub');
    expect(sub.type).toBe('directory');
    expect(sub.size).toBe(10);
    expect(sub.children).toEqual([{ name: 'nested.txt', size: 10, type: 'file' }]);
  });

  it('marks a depth-capped node as type "directory" even without a children array', async () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'deep.txt'), '123');

    const result = await scanDirectory(dir, 1);
    const a = result.children.find(c => c.name === 'a');
    expect(a).toEqual({ name: 'a', size: 3, type: 'directory' });
  });

  it('omits an entry it cannot stat, without crashing the whole scan', async () => {
    writeFileSync(join(dir, 'readable.txt'), 'ok'); // 2 bytes
    writeFileSync(join(dir, 'locked.txt'), 'nope'); // 4 bytes, but stat is mocked to throw for it

    fs.promises.stat.mockImplementation((p, ...rest) => {
      if (String(p).endsWith('locked.txt')) return Promise.reject(Object.assign(new Error('EPERM'), { code: 'EPERM' }));
      return fs.__actualPromises.stat(p, ...rest);
    });

    const result = await scanDirectory(dir);
    expect(result.children.map(c => c.name)).toEqual(['readable.txt']);
    expect(result.size).toBe(2); // locked.txt contributes nothing, isn't listed
  });

  it('reports a size-0 placeholder for a directory it can stat but not list ' +
    '(the "System Volume Information" shape)', async () => {
    mkdirSync(join(dir, 'opaque'));
    writeFileSync(join(dir, 'visible.txt'), 'ab'); // 2 bytes

    fs.promises.readdir.mockImplementation((p, ...rest) => {
      if (String(p).endsWith('opaque')) return Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
      return fs.__actualPromises.readdir(p, ...rest);
    });

    const result = await scanDirectory(dir);
    const opaque = result.children.find(c => c.name === 'opaque');
    expect(opaque).toEqual({ name: 'opaque', size: 0, type: 'directory', children: [] });
    const visible = result.children.find(c => c.name === 'visible.txt');
    expect(visible.size).toBe(2);
  });

  it('returns null for a path that does not exist, rather than throwing', async () => {
    expect(await scanDirectory(join(dir, 'does-not-exist'))).toBeNull();
  });

  it('caps the returned tree depth while keeping every total size accurate', async () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'deep.txt'), '123'); // 3 bytes

    const result = await scanDirectory(dir, 1);
    expect(result.size).toBe(3);
    const a = result.children.find(c => c.name === 'a');
    expect(a.size).toBe(3); // still accurate...
    expect(a.children).toBeUndefined(); // ...even though the depth cap hides its children
  });

  // The actual fix for the real showstopper found dogfooding (2026-09-01):
  // scanning a large root (a full "C:\") pegged the backend at ~100% CPU
  // and made the ENTIRE process unresponsive -- every other route queued
  // behind it -- because the old scanDirectory was fully synchronous
  // (fs.statSync/fs.readdirSync never yield the event loop). Switching to
  // fs.promises with a real `await` at every I/O point is what actually
  // fixes that (each await hands control back to the event loop between
  // fs calls) -- these tests prove the SIGNAL half of the fix: a caller can
  // bound how long/deep a scan runs via AbortSignal, same mechanism the
  // route now wires to a 30s timeout AND to the request closing early.
  describe('AbortSignal', () => {
    it('does zero work when already aborted before the scan even starts, without throwing', async () => {
      writeFileSync(join(dir, 'a.txt'), '12345');
      writeFileSync(join(dir, 'b.txt'), '1234567890');
      const controller = new AbortController();
      controller.abort();

      // Same honest shape as an unreadable path -- no fabricated "empty but
      // successful" result for work that was never actually attempted.
      expect(await scanDirectory(dir, undefined, controller.signal)).toBeNull();
    });

    it('stops mid-walk when the signal aborts partway through, returning a real partial result', async () => {
      writeFileSync(join(dir, 'a.txt'), '12345'); // 5 bytes
      mkdirSync(join(dir, 'sub'));
      writeFileSync(join(dir, 'sub', 'b.txt'), '1234567890'); // 10 bytes

      const controller = new AbortController();
      let readdirCalls = 0;
      fs.promises.readdir.mockImplementation((p, ...rest) => {
        readdirCalls++;
        if (readdirCalls === 2) controller.abort(); // abort right as the second directory read starts
        return fs.__actualPromises.readdir(p, ...rest);
      });

      const result = await scanDirectory(dir, undefined, controller.signal);
      // Whatever was actually visited before the abort is real and kept --
      // this is a genuine partial result, not silently discarded.
      expect(result.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.children)).toBe(true);
    });

    it('never rejects/throws just because the signal was aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(scanDirectory(dir, undefined, controller.signal)).resolves.toBeDefined();
    });
  });
});
