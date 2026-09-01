import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as powershell from './powershell.js';
import { scanJunk, executeCleanup, tempRoot, windowsTempRoot, localAppDataRoot } from './cleanup.js';

// node:fs's ESM namespace is frozen -- vi.spyOn can't redefine its exports
// directly. Same vi.mock partial-passthrough workaround diskScan.test.js
// already establishes: fs.promises.rm becomes a real vi.fn() (still calling
// through to the real implementation by default), so one test can swap in
// a throwing implementation for a single specific path.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, promises: { ...actual.promises, rm: vi.fn(actual.promises.rm) }, __actualPromises: actual.promises };
});

describe('cleanup (real file I/O)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'unrevo-cleanup-'));
    mkdirSync(join(dir, 'temp'));
    mkdirSync(join(dir, 'wintemp'));
    mkdirSync(join(dir, 'localappdata'));
    process.env.UNREVO_TEMP_ROOT = join(dir, 'temp');
    process.env.UNREVO_WINDOWS_TEMP_ROOT = join(dir, 'wintemp');
    process.env.UNREVO_LOCALAPPDATA_ROOT = join(dir, 'localappdata');
  });

  afterEach(() => {
    fs.promises.rm.mockImplementation(fs.__actualPromises.rm);
    vi.restoreAllMocks();
    delete process.env.UNREVO_TEMP_ROOT;
    delete process.env.UNREVO_WINDOWS_TEMP_ROOT;
    delete process.env.UNREVO_LOCALAPPDATA_ROOT;
    rmSync(dir, { recursive: true, force: true });
  });

  it('root resolvers read the env-var override, same pattern as quarantineRoot()', () => {
    expect(tempRoot()).toBe(join(dir, 'temp'));
    expect(windowsTempRoot()).toBe(join(dir, 'wintemp'));
    expect(localAppDataRoot()).toBe(join(dir, 'localappdata'));
  });

  describe('scanJunk', () => {
    it('reports the real size of temp files across both temp roots', async () => {
      writeFileSync(join(dir, 'temp', 'a.tmp'), '12345'); // 5 bytes
      writeFileSync(join(dir, 'wintemp', 'b.tmp'), '1234567890'); // 10 bytes

      const { categories } = await scanJunk();
      const tempFiles = categories.find(c => c.id === 'tempFiles');
      expect(tempFiles.label).toBe('Temp Files');
      expect(tempFiles.sizeBytes).toBe(15);
    });

    it('reports the real size of matching thumbnail cache files, ignoring non-matching ones', async () => {
      const explorerDir = join(dir, 'localappdata', 'Microsoft', 'Windows', 'Explorer');
      mkdirSync(explorerDir, { recursive: true });
      writeFileSync(join(explorerDir, 'thumbcache_256.db'), '12345'); // 5 bytes -- matches
      writeFileSync(join(explorerDir, 'thumbcache_1024.db'), '1234567890'); // 10 bytes -- matches
      writeFileSync(join(explorerDir, 'iconcache_notes.db'), 'xxxxxxxxxxxxxxxxxxxx'); // 20 bytes -- does NOT match

      const { categories } = await scanJunk();
      const thumb = categories.find(c => c.id === 'thumbnailCache');
      expect(thumb.label).toBe('Thumbnail Cache');
      expect(thumb.sizeBytes).toBe(15);
    });

    it('reports the real size of browser cache folders (Chrome/Edge static paths + Firefox\'s randomized profile)', async () => {
      const chromeCache = join(dir, 'localappdata', 'Google', 'Chrome', 'User Data', 'Default', 'Cache');
      const edgeCache = join(dir, 'localappdata', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache');
      const ffCache = join(dir, 'localappdata', 'Mozilla', 'Firefox', 'Profiles', 'abc123.default-release', 'cache2');
      mkdirSync(chromeCache, { recursive: true });
      mkdirSync(edgeCache, { recursive: true });
      mkdirSync(ffCache, { recursive: true });
      writeFileSync(join(chromeCache, 'f1'), '12345'); // 5
      writeFileSync(join(edgeCache, 'f2'), '1234567890'); // 10
      writeFileSync(join(ffCache, 'f3'), '123'); // 3

      const { categories } = await scanJunk();
      const browser = categories.find(c => c.id === 'browserCache');
      expect(browser.label).toBe('Browser Cache');
      expect(browser.sizeBytes).toBe(18);
    });

    it('reports 0 for a category whose path does not exist, without failing the whole scan', async () => {
      // No files created anywhere in the fixture -- every path is genuinely missing.
      const { categories } = await scanJunk();
      expect(categories.every(c => typeof c.sizeBytes === 'number')).toBe(true);
      expect(categories.find(c => c.id === 'tempFiles').sizeBytes).toBe(0);
      expect(categories.find(c => c.id === 'browserCache').sizeBytes).toBe(0);
    });

    it('asks PowerShell for the real recycle bin size via the Shell.Application COM object', async () => {
      vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({ sizeBytes: 424242 });
      const { categories } = await scanJunk();
      const bin = categories.find(c => c.id === 'recycleBin');
      expect(bin.label).toBe('Recycle Bin');
      expect(bin.sizeBytes).toBe(424242);
    });

    it('reports 0 for the recycle bin rather than failing the whole scan if PowerShell errors', async () => {
      vi.spyOn(powershell, 'runPowerShellJson').mockRejectedValue(new Error('PowerShell unavailable'));
      const { categories } = await scanJunk();
      expect(categories.find(c => c.id === 'recycleBin').sizeBytes).toBe(0);
    });
  });

  describe('executeCleanup', () => {
    it('deletes temp file contents but leaves the temp root folder itself intact', async () => {
      writeFileSync(join(dir, 'temp', 'a.tmp'), '12345');
      mkdirSync(join(dir, 'temp', 'sub'));
      writeFileSync(join(dir, 'temp', 'sub', 'b.tmp'), '1234567890');

      const result = await executeCleanup(['tempFiles']);
      expect(result.freedBytes).toBe(15);
      expect(existsSync(join(dir, 'temp'))).toBe(true); // the root survives
      expect(existsSync(join(dir, 'temp', 'a.tmp'))).toBe(false);
      expect(existsSync(join(dir, 'temp', 'sub'))).toBe(false);
    });

    it('deletes matching thumbnail cache files by name, not the whole Explorer folder', async () => {
      const explorerDir = join(dir, 'localappdata', 'Microsoft', 'Windows', 'Explorer');
      mkdirSync(explorerDir, { recursive: true });
      writeFileSync(join(explorerDir, 'thumbcache_256.db'), '12345');
      writeFileSync(join(explorerDir, 'other.txt'), 'keep me');

      const result = await executeCleanup(['thumbnailCache']);
      expect(result.freedBytes).toBe(5);
      expect(existsSync(join(explorerDir, 'thumbcache_256.db'))).toBe(false);
      expect(existsSync(join(explorerDir, 'other.txt'))).toBe(true); // not a thumbcache file -- kept
    });

    it('runs Clear-RecycleBin via PowerShell and reports the size that was freed', async () => {
      vi.spyOn(powershell, 'runPowerShellJson')
        .mockResolvedValueOnce({ sizeBytes: 99999 }) // the "before" size read
        .mockResolvedValueOnce({ ok: true }); // the actual Clear-RecycleBin call

      const result = await executeCleanup(['recycleBin']);
      expect(result.freedBytes).toBe(99999);
    });

    // The actual requirement this exists to prove: a locked/in-use file
    // (EPERM/EBUSY, the real Windows "file is open in another program"
    // case) is caught PER FILE and reported, never aborts the rest of the
    // cleanup -- confirmed here with a real second file that DOES delete
    // successfully alongside the one that doesn't.
    it('skips a locked file and keeps going, reporting it rather than crashing', async () => {
      writeFileSync(join(dir, 'temp', 'locked.tmp'), '12345'); // 5 bytes -- rm will be mocked to fail for this one
      writeFileSync(join(dir, 'temp', 'ok.tmp'), '1234567890'); // 10 bytes -- deletes fine

      fs.promises.rm.mockImplementation((p, ...rest) => {
        if (String(p).endsWith('locked.tmp')) return Promise.reject(Object.assign(new Error('EBUSY'), { code: 'EBUSY' }));
        return fs.__actualPromises.rm(p, ...rest);
      });

      const result = await executeCleanup(['tempFiles']);
      expect(result.freedBytes).toBe(10); // only ok.tmp's size
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].path).toContain('locked.tmp');
      expect(result.skipped[0].reason).toBe('EBUSY');
      expect(existsSync(join(dir, 'temp', 'locked.tmp'))).toBe(true); // never actually removed
      expect(existsSync(join(dir, 'temp', 'ok.tmp'))).toBe(false);
    });

    it('processes multiple requested categories in one call', async () => {
      writeFileSync(join(dir, 'temp', 'a.tmp'), '12345'); // 5
      const explorerDir = join(dir, 'localappdata', 'Microsoft', 'Windows', 'Explorer');
      mkdirSync(explorerDir, { recursive: true });
      writeFileSync(join(explorerDir, 'thumbcache_1.db'), '1234567890'); // 10

      const result = await executeCleanup(['tempFiles', 'thumbnailCache']);
      expect(result.freedBytes).toBe(15);
    });
  });
});
