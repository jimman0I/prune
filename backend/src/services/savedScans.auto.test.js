import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, writeFileSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  saveScan, saveAutoScan, listScans, listAutoScans, loadScan, deleteAutoScans, AUTO_KEEP, MAX_SAVED_SCANS
} from './savedScans.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-auto-scans-'));
  process.env.UNREVO_SCANS_DIR = join(dir, 'disk-scans');
});
afterEach(() => {
  delete process.env.UNREVO_SCANS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const archive = (letter = 'C', size = 100) => ({
  v: 1,
  root: { n: `${letter}:`, s: size, a: size + 10, c: [{ n: 'Games', s: size }] },
  top: [{ p: `${letter}:\\Games\\a.pak`, s: 5 }]
});
const auto = (letter = 'C', size = 100, extra = {}) =>
  saveAutoScan({ drive: letter, label: `Automatic scan of ${letter}:`, source: 'fast', archive: archive(letter, size), ...extra });

describe('automatic scans', () => {
  it('saves one flagged as automatic, keyed by drive, and lists it', async () => {
    const saved = await auto('C', 500, { drive: 'c', capacityBytes: 1000, truncated: false });
    expect(saved.ok).toBe(true);
    expect(saved.meta).toMatchObject({ auto: true, drive: 'C', root: 'C:', totalBytes: 500, capacityBytes: 1000, source: 'fast' });
    const { scans } = await listAutoScans({ drive: 'C' });
    expect(scans.map((s) => s.id)).toEqual([saved.meta.id]);
    // The ordinary list shows it too, flagged, so the Saved scans panel can say what it is.
    expect((await listScans())[0]).toMatchObject({ id: saved.meta.id, auto: true });
  });

  it('keeps only the latest two per drive and removes the older files from disk', async () => {
    const first = await auto('C', 1);
    const second = await auto('C', 2);
    const third = await auto('C', 3);
    expect(AUTO_KEEP).toBe(2);
    expect(third.removed).toEqual([first.meta.id]);
    const { scans } = await listAutoScans({ drive: 'C' });
    expect(scans.map((s) => s.id)).toEqual([third.meta.id, second.meta.id]);
    expect(await loadScan(first.meta.id)).toBeNull();
    expect(readdirSync(process.env.UNREVO_SCANS_DIR).filter((f) => f.includes(first.meta.id))).toEqual([]);
  });

  it('prunes each drive on its own', async () => {
    const d1 = await auto('D', 1);
    await auto('C', 1);
    await auto('C', 2);
    await auto('C', 3);
    expect((await listAutoScans({ drive: 'D' })).scans.map((s) => s.id)).toEqual([d1.meta.id]);
    expect((await listAutoScans({ drive: 'C' })).scans).toHaveLength(2);
    expect((await listAutoScans()).scans).toHaveLength(3);
  });

  it('never touches a manual save, even of the same drive', async () => {
    const manual = await saveScan({ label: 'Before cleanup', archive: archive('C', 7) });
    for (let i = 0; i < 5; i++) await auto('C', i + 1);
    const ids = (await listScans()).map((s) => s.id);
    expect(ids).toContain(manual.meta.id);
    expect((await loadScan(manual.meta.id)).archive.root.s).toBe(7);
    expect(ids).toHaveLength(3); // the manual one and the latest two automatic ones
    expect((await listAutoScans()).scans.map((s) => s.id)).not.toContain(manual.meta.id);
  });

  it('is not held back by the manual limit, and does not use it up', async () => {
    for (let i = 0; i < MAX_SAVED_SCANS; i++) await saveScan({ label: `m${i}`, archive: archive() });
    expect((await auto('C')).ok).toBe(true);
    expect((await auto('C')).ok).toBe(true);
    // Still the same 50 manual saves allowed, no more and no fewer.
    const over = await saveScan({ label: 'one too many', archive: archive() });
    expect(over.ok).toBe(false);
  }, 60000);

  it('refuses a bad drive or an archive of another drive, saving nothing', async () => {
    for (const drive of ['', 'CC', '1', '..', null, undefined, 'C:']) {
      expect((await saveAutoScan({ drive, archive: archive() })).ok, String(drive)).toBe(false);
    }
    expect((await saveAutoScan({ drive: 'D', archive: archive('C') })).ok).toBe(false);
    expect((await saveAutoScan({ drive: 'C', archive: { v: 1, root: { n: '', s: 1 } } })).ok).toBe(false);
    expect(await listScans()).toEqual([]);
  });

  it('records a partial scan as partial', async () => {
    const saved = await auto('C', 1, { source: 'crawl', truncated: true });
    expect(saved.meta).toMatchObject({ source: 'crawl', truncated: true });
  });

  it('orders saves made in the same millisecond, newest first', async () => {
    const saves = [];
    for (let i = 0; i < 4; i++) saves.push(await auto('C', i));
    const { scans } = await listAutoScans({ drive: 'C' });
    expect(scans.map((s) => s.id)).toEqual([saves[3].meta.id, saves[2].meta.id]);
    expect(scans[0].savedAt).toBeGreaterThan(scans[1].savedAt);
  });

  it('ends up with two even when saves overlap', async () => {
    await Promise.all([auto('C', 1), auto('C', 2), auto('C', 3), auto('C', 4)]);
    expect((await listAutoScans({ drive: 'C' })).scans).toHaveLength(2);
    expect(readdirSync(process.env.UNREVO_SCANS_DIR).filter((f) => f.endsWith('.scan.gz'))).toHaveLength(2);
  });

  it('reports how much disk they use', async () => {
    await auto('C', 1);
    await auto('D', 1);
    const all = await listAutoScans();
    expect(all.count).toBe(2);
    expect(all.bytes).toBeGreaterThan(0);
    const justC = await listAutoScans({ drive: 'C' });
    expect(justC.count).toBe(1);
    expect(justC.bytes).toBeLessThan(all.bytes);
  });

  it('deletes only the automatic ones', async () => {
    const manual = await saveScan({ label: 'keep me', archive: archive() });
    await auto('C');
    await auto('D');
    expect(await deleteAutoScans()).toBe(2);
    expect((await listScans()).map((s) => s.id)).toEqual([manual.meta.id]);
    expect(readdirSync(process.env.UNREVO_SCANS_DIR).sort()).toEqual([`${manual.meta.id}.meta.json`, `${manual.meta.id}.scan.gz`].sort());
    expect(await deleteAutoScans()).toBe(0);
  });
});

describe('automatic scans and damaged files', () => {
  it('skips a damaged sidecar without failing the save or the list', async () => {
    await auto('C', 1);
    writeFileSync(join(process.env.UNREVO_SCANS_DIR, 'zzzzzz1.meta.json'), '{ broken');
    const saved = await auto('C', 2);
    expect(saved.ok).toBe(true);
    expect((await listAutoScans({ drive: 'C' })).scans).toHaveLength(2);
  });

  it('does not list, or count towards the two, a sidecar whose scan file is gone', async () => {
    const first = await auto('C', 1);
    const second = await auto('C', 2);
    // The newest one loses its file (disk cleaner, antivirus quarantine, ...).
    rmSync(join(process.env.UNREVO_SCANS_DIR, `${second.meta.id}.scan.gz`));
    expect((await listAutoScans({ drive: 'C' })).scans.map((s) => s.id)).toEqual([first.meta.id]);
    const third = await auto('C', 3);
    // The orphaned sidecar is cleaned away and the older, intact scan survives.
    expect((await listAutoScans({ drive: 'C' })).scans.map((s) => s.id)).toEqual([third.meta.id, first.meta.id]);
    expect(existsSync(join(process.env.UNREVO_SCANS_DIR, `${second.meta.id}.meta.json`))).toBe(false);
  });

  it('still saves and prunes when an old scan file is corrupt', async () => {
    const first = await auto('C', 1);
    writeFileSync(join(process.env.UNREVO_SCANS_DIR, `${first.meta.id}.scan.gz`), 'not gzip');
    expect(await loadScan(first.meta.id)).toBeNull();
    await auto('C', 2);
    const third = await auto('C', 3);
    expect(third.ok).toBe(true);
    expect((await listAutoScans({ drive: 'C' })).scans).toHaveLength(2);
    expect(await loadScan(first.meta.id)).toBeNull();
  });

  it('sweeps a stale scan file with no sidecar, but not a fresh one that may be mid-write', async () => {
    await auto('C', 1);
    const stale = join(process.env.UNREVO_SCANS_DIR, 'staleorphan1.scan.gz');
    const fresh = join(process.env.UNREVO_SCANS_DIR, 'freshorphan1.scan.gz');
    writeFileSync(stale, 'x');
    writeFileSync(fresh, 'x');
    const old = new Date(Date.now() - 60 * 60 * 1000);
    utimesSync(stale, old, old);
    await auto('C', 2);
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });

  it('answers nothing for a folder that does not exist yet', async () => {
    expect(await listAutoScans({ drive: 'C' })).toEqual({ scans: [], count: 0, bytes: 0 });
    expect(await deleteAutoScans()).toBe(0);
  });
});
