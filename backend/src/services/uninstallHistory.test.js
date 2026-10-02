import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendHistoryEntry, getRecentHistory, getAllHistory, updateHistoryEntry, clearHistory } from './uninstallHistory.js';

describe('uninstall history (real file I/O)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'unrevo-history-'));
    process.env.UNREVO_HISTORY_FILE = join(dir, 'uninstall-history.jsonl');
  });

  afterEach(() => {
    delete process.env.UNREVO_HISTORY_FILE;
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty array when no history file exists yet', async () => {
    const entries = await getRecentHistory();
    expect(entries).toEqual([]);
  });

  it('appends an entry and reads it back', async () => {
    await appendHistoryEntry({ programName: '7-Zip 22.01', publisher: 'Igor Pavlov', sizeBytes: 4194304 });
    const entries = await getRecentHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].programName).toBe('7-Zip 22.01');
    expect(entries[0].sizeBytes).toBe(4194304);
    expect(typeof entries[0].timestamp).toBe('number');
  });

  it('returns entries newest-first', async () => {
    await appendHistoryEntry({ programName: 'First', publisher: 'A', sizeBytes: 1 });
    await appendHistoryEntry({ programName: 'Second', publisher: 'B', sizeBytes: 2 });
    const entries = await getRecentHistory();
    expect(entries.map(e => e.programName)).toEqual(['Second', 'First']);
  });

  it('gives every entry an id and returns the entry it wrote', async () => {
    const written = await appendHistoryEntry({ programName: 'A', publisher: 'X', sizeBytes: 1 });
    expect(written.id).toMatch(/^[a-f0-9]{12}$/);
    expect((await getRecentHistory())[0].id).toBe(written.id);
  });

  it('records the richer fields, and only those', async () => {
    await appendHistoryEntry({
      programName: 'A', version: '1.0', scanMode: 'safe', leftoversFound: 5, leftoversRemoved: 4, bytesFreed: 1000,
      destination: 'recycle', outcome: 'removed', kind: 'uninstall', quarantineBatch: 'Q:\\b', registryBackup: 'B:\\r',
      restorePoint: { created: true }, surprise: 'dropped', leftoversFound2: 1, sizeBytes: 'not a number'
    });
    const [entry] = await getRecentHistory();
    expect(entry).toMatchObject({
      programName: 'A', version: '1.0', scanMode: 'safe', leftoversFound: 5, leftoversRemoved: 4, bytesFreed: 1000,
      destination: 'recycle', outcome: 'removed', kind: 'uninstall', restorePoint: { created: true }
    });
    expect(entry).not.toHaveProperty('surprise');
    expect(entry).not.toHaveProperty('sizeBytes');
  });

  it('lists all of them, not only the latest', async () => {
    for (let i = 0; i < 12; i += 1) await appendHistoryEntry({ programName: `App ${i}` });
    expect(await getAllHistory()).toHaveLength(12);
    expect(await getRecentHistory()).toHaveLength(5);
  });

  it('reads an entry from before ids and the new fields existed, and skips a damaged line', async () => {
    const file = process.env.UNREVO_HISTORY_FILE;
    writeFileSync(file, [
      JSON.stringify({ programName: 'Old One', publisher: 'P', sizeBytes: 10, timestamp: 1 }),
      '{this is not json',
      JSON.stringify({ programName: 'Old Two', publisher: 'P', sizeBytes: 20, timestamp: 2 })
    ].join('\n') + '\n');
    const entries = await getAllHistory();
    expect(entries.map((e) => e.programName)).toEqual(['Old Two', 'Old One']);
    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
    expect(entries[0].id).toBe('legacy-2');
  });

  it('adds the outcome of the review to an entry, identified by its id, even an old one', async () => {
    const file = process.env.UNREVO_HISTORY_FILE;
    writeFileSync(file, JSON.stringify({ programName: 'Old', timestamp: 1 }) + '\n');
    await appendHistoryEntry({ programName: 'New' });
    const [newest, oldest] = await getAllHistory();

    expect(await updateHistoryEntry(newest.id, { leftoversRemoved: 3, outcome: 'removed', programName: 'Renamed?' })).toBe(true);
    expect(await updateHistoryEntry(oldest.id, { outcome: 'uninstalled' })).toBe(true);
    const after = await getAllHistory();
    expect(after[0]).toMatchObject({ programName: 'Renamed?', leftoversRemoved: 3, outcome: 'removed', id: newest.id });
    expect(after[1]).toMatchObject({ programName: 'Old', outcome: 'uninstalled' });
  });

  it('says so when the entry is not there, and for a missing file', async () => {
    expect(await updateHistoryEntry('nope', { outcome: 'x' })).toBe(false);
    await appendHistoryEntry({ programName: 'A' });
    expect(await updateHistoryEntry('nope', { outcome: 'x' })).toBe(false);
    expect(await updateHistoryEntry(undefined, {})).toBe(false);
  });

  it('clears the log and says how many entries it held', async () => {
    await appendHistoryEntry({ programName: 'A' });
    await appendHistoryEntry({ programName: 'B' });
    expect(await clearHistory()).toBe(2);
    expect(await getAllHistory()).toEqual([]);
    expect(await clearHistory()).toBe(0);
  });

  it('caps at the given limit', async () => {
    for (let i = 0; i < 8; i++) {
      await appendHistoryEntry({ programName: `App ${i}`, publisher: 'X', sizeBytes: 1 });
    }
    const entries = await getRecentHistory(5);
    expect(entries).toHaveLength(5);
    expect(entries[0].programName).toBe('App 7'); // newest of the 8
  });
});