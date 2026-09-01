import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendHistoryEntry, getRecentHistory } from './uninstallHistory.js';

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

  it('caps at the given limit', async () => {
    for (let i = 0; i < 8; i++) {
      await appendHistoryEntry({ programName: `App ${i}`, publisher: 'X', sizeBytes: 1 });
    }
    const entries = await getRecentHistory(5);
    expect(entries).toHaveLength(5);
    expect(entries[0].programName).toBe('App 7'); // newest of the 8
  });
});