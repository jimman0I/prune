import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveScan, listScans, loadScan, deleteScan, compareSaved, isScanId, MAX_SAVED_SCANS } from './savedScans.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-saved-scans-'));
  process.env.UNREVO_SCANS_DIR = join(dir, 'disk-scans');
});
afterEach(() => {
  delete process.env.UNREVO_SCANS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const archive = (size = 100, extra = {}) => ({
  v: 1,
  root: { n: 'C:', s: size, a: size + 10, c: [{ n: 'Games', s: size }], ...extra },
  top: [{ p: 'C:\\Games\\a.pak', s: 5 }]
});

describe('saved scans', () => {
  it('saves a scan and lists it with what the list shows', async () => {
    const saved = await saveScan({ label: 'Before cleanup', source: 'fast', archive: archive(500) });
    expect(saved.ok).toBe(true);
    const list = await listScans();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: saved.meta.id, label: 'Before cleanup', root: 'C:', source: 'fast', truncated: false,
      totalBytes: 500, allocatedBytes: 510, folders: 2
    });
    expect(typeof list[0].savedAt).toBe('number');
  });

  it('stores it compressed', async () => {
    await saveScan({ label: 'x', archive: archive() });
    const files = readdirSync(process.env.UNREVO_SCANS_DIR);
    expect(files.some((f) => f.endsWith('.scan.gz'))).toBe(true);
    expect(files.some((f) => f.endsWith('.meta.json'))).toBe(true);
  });

  it('loads exactly what was saved', async () => {
    const { meta } = await saveScan({ label: 'x', archive: archive(321) });
    const loaded = await loadScan(meta.id);
    expect(loaded.archive).toEqual(archive(321));
    expect(loaded.meta.label).toBe('x');
  });

  it('lists the newest first', async () => {
    const first = await saveScan({ label: 'first', archive: archive(1) });
    await new Promise((r) => setTimeout(r, 5));
    const second = await saveScan({ label: 'second', archive: archive(2) });
    expect((await listScans()).map((m) => m.id)).toEqual([second.meta.id, first.meta.id]);
  });

  it('names an unlabelled scan after its root, and trims and cleans a label', async () => {
    expect((await saveScan({ archive: archive() })).meta.label).toBe('C:');
    expect((await saveScan({ label: '  tidy\u0000name  ', archive: archive() })).meta.label).toBe('tidy name');
    expect((await saveScan({ label: 'x'.repeat(500), archive: archive() })).meta.label).toHaveLength(120);
  });

  it('records that a scan was partial', async () => {
    const { meta } = await saveScan({ label: 'cut', source: 'crawl', truncated: true, archive: archive() });
    expect(meta).toMatchObject({ source: 'crawl', truncated: true });
  });

  it('refuses an archive that is not valid, saving nothing', async () => {
    const result = await saveScan({ label: 'bad', archive: { v: 1, root: { n: '', s: 1 } } });
    expect(result.ok).toBe(false);
    expect(await listScans()).toEqual([]);
  });

  it('deletes a scan, both files, and says whether there was one', async () => {
    const { meta } = await saveScan({ label: 'x', archive: archive() });
    expect(await deleteScan(meta.id)).toBe(true);
    expect(await listScans()).toEqual([]);
    expect(readdirSync(process.env.UNREVO_SCANS_DIR)).toEqual([]);
    expect(await deleteScan(meta.id)).toBe(false);
  });

  // The id is the only thing from a request that reaches a file path.
  it('accepts only ids of the shape it generates, so no id can name another path', async () => {
    for (const bad of ['../../settings', '..\\x', 'a/b', '', 'x', null, undefined, 5, 'a'.repeat(80), 'ABC DEF']) {
      expect(isScanId(bad), String(bad)).toBe(false);
      expect(await loadScan(bad)).toBeNull();
      expect(await deleteScan(bad)).toBe(false);
    }
  });

  it('answers null for a scan that is not there, or whose file is damaged', async () => {
    expect(await loadScan('abcdef123456')).toBeNull();
    const { meta } = await saveScan({ label: 'x', archive: archive() });
    writeFileSync(join(process.env.UNREVO_SCANS_DIR, `${meta.id}.scan.gz`), 'not gzip');
    expect(await loadScan(meta.id)).toBeNull();
  });

  it('lists nothing before the first save and survives a damaged sidecar', async () => {
    expect(await listScans()).toEqual([]);
    await saveScan({ label: 'good', archive: archive() });
    writeFileSync(join(process.env.UNREVO_SCANS_DIR, 'zzzzzz1.meta.json'), '{ broken');
    expect(await listScans()).toHaveLength(1);
  });

  it('keeps a bounded number', async () => {
    for (let i = 0; i < MAX_SAVED_SCANS; i++) await saveScan({ label: `s${i}`, archive: archive() });
    const over = await saveScan({ label: 'one too many', archive: archive() });
    expect(over.ok).toBe(false);
    expect(over.error).toMatch(/50/);
  }, 30000);

  it('compares two saved scans with the older one as the starting point, in either order', async () => {
    const a = await saveScan({ label: 'old', archive: archive(100) });
    await new Promise((r) => setTimeout(r, 5));
    const b = await saveScan({ label: 'new', archive: archive(900) });
    for (const [x, y] of [[a, b], [b, a]]) {
      const result = await compareSaved(x.meta.id, y.meta.id);
      expect(result.older.label).toBe('old');
      expect(result.newer.label).toBe('new');
      expect(result.delta).toBe(800);
      expect(result.grew[0].path).toBe('C:\\Games');
    }
  });

  it('compares nothing when either scan is missing', async () => {
    const a = await saveScan({ label: 'old', archive: archive(100) });
    expect(await compareSaved(a.meta.id, 'abcdef123456')).toBeNull();
  });
});
