import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The streamed folder walk: no deadline, a picture of what has been read so
 * far, and a real percent for any drive. */

const scanDirectory = vi.fn();
vi.mock('../services/diskScan.js', () => ({
  scanDirectory: (...a) => scanDirectory(...a),
  DEFAULT_MAX_DEPTH: 4
}));
vi.mock('../services/settings.js', () => ({
  getSettings: async () => ({ excludeFolders: [], excludeExtensions: [] }),
  updateSettings: async (p) => p
}));
const getSystemDriveSpace = vi.fn();
const getDriveSpace = vi.fn();
vi.mock('../services/diskSpace.js', () => ({
  getSystemDriveSpace: (...a) => getSystemDriveSpace(...a),
  getDriveSpace: (...a) => getDriveSpace(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  getSystemDriveSpace.mockResolvedValue(null);
  getDriveSpace.mockResolvedValue(null);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readStream(query) {
  const res = await fetch(`${server.base}/disk-scan/stream${query}`);
  const text = await res.text();
  const events = text.split('\n\n').filter(Boolean).map((block) => ({
    event: /^event: (.*)$/m.exec(block)?.[1],
    data: JSON.parse(/^data: (.*)$/m.exec(block)[1])
  }));
  return { events };
}

const TREE = { name: 'Users', size: 30, type: 'directory', children: [] };

describe('a streamed folder walk has no deadline', () => {
  it('announces no time limit and sends no countdown', async () => {
    scanDirectory.mockImplementationOnce(async (p, d, s, e, onFile) => { onFile(10); await sleep(500); return TREE; });
    const { events } = await readStream('?path=C%3A%5CUsers');
    expect(events.find((e) => e.event === 'start').data).not.toHaveProperty('remainingMs');
    for (const p of events.filter((e) => e.event === 'progress')) expect(p.data).not.toHaveProperty('remainingMs');
  });

  it('is not aborted by the clock: only Stop or the client leaving ends it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let signal;
      let finish;
      const started = new Promise((resolve) => {
        scanDirectory.mockImplementationOnce(async (p, d, sig) => {
          signal = sig;
          resolve();
          await new Promise((r) => { finish = r; });
          return TREE;
        });
      });
      const request = readStream('?path=C%3A%5C');
      await started;
      vi.advanceTimersByTime(10 * 60_000);
      expect(signal.aborted).toBe(false);
      finish();
      const { events } = await request;
      expect(events.at(-1)).toMatchObject({ event: 'complete', data: { truncated: false, stoppedByUser: false } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('when it finds nothing readable the error does not blame the time', async () => {
    scanDirectory.mockResolvedValueOnce(null);
    const { events } = await readStream('?path=C%3A%5Cnope');
    expect(events.at(-1).event).toBe('error');
    expect(events.at(-1).data.message).not.toMatch(/too long/);
    expect(events.at(-1).data.message).toContain('C:\\nope');
  });
});

describe('a picture of what has been read so far', () => {
  it('rides on progress events as a partial tree whose sizes add up', async () => {
    scanDirectory.mockImplementationOnce(async (p, d, s, e, onFile) => {
      onFile(100, { path: 'C:\\Users\\me\\a.bin', allocated: 4096 });
      onFile(50, { path: 'C:\\Windows\\b.dll', allocated: 4096 });
      await sleep(2200);
      return TREE;
    });
    const { events } = await readStream('?path=C%3A%5C');
    const withSnapshot = events.filter((e) => e.event === 'progress' && e.data.snapshot);
    expect(withSnapshot.length).toBeGreaterThanOrEqual(1);
    const snapshot = withSnapshot.at(-1).data.snapshot;
    expect(snapshot).toMatchObject({ name: 'C:', size: 150, allocated: 8192, partial: true, truncated: true });
    expect(snapshot.children.map((c) => c.name)).toEqual(['Users', 'Windows']);
    expect(snapshot.children[0].children[0]).toMatchObject({ name: 'me', size: 100 });
  });

  it('is sent now and then, not on every progress tick', async () => {
    scanDirectory.mockImplementationOnce(async (p, d, s, e, onFile) => {
      onFile(1, { path: 'C:\\a.bin', allocated: 0 });
      await sleep(3300);
      return TREE;
    });
    const { events } = await readStream('?path=C%3A%5C');
    const progress = events.filter((e) => e.event === 'progress');
    const snapshots = progress.filter((e) => e.data.snapshot);
    // One new file, so one snapshot: nothing changed after it was sent.
    expect(snapshots).toHaveLength(1);
    expect(progress.length).toBeGreaterThan(8);
  });

  it('is not sent when nothing has been read', async () => {
    scanDirectory.mockImplementationOnce(async () => { await sleep(1800); return TREE; });
    const { events } = await readStream('?path=C%3A%5C');
    expect(events.filter((e) => e.data.snapshot)).toHaveLength(0);
  });

  it('copes with a scan whose files carry no detail', async () => {
    scanDirectory.mockImplementationOnce(async (p, d, s, e, onFile) => { onFile(10); await sleep(300); return TREE; });
    const { events } = await readStream('?path=C%3A%5CUsers');
    expect(events.at(-1).event).toBe('complete');
  });
});

describe('percent for a whole-drive walk', () => {
  it('uses the named drive\'s own in-use figure for a drive other than C', async () => {
    getDriveSpace.mockResolvedValue({ totalBytes: 2000, freeBytes: 1000 });
    scanDirectory.mockImplementationOnce(async (p, d, s, e, onFile) => { onFile(100); await sleep(500); return TREE; });
    const { events } = await readStream('?path=D%3A%5C');
    const progress = events.filter((e) => e.event === 'progress');
    for (const p of progress) expect(p.data.percent).toBe(10);
    expect(getDriveSpace).toHaveBeenCalledWith('D');
    expect(getSystemDriveSpace).not.toHaveBeenCalled();
  });

  it('is still null when that drive\'s space cannot be read', async () => {
    getDriveSpace.mockRejectedValue(new Error('no such drive'));
    scanDirectory.mockImplementationOnce(async (p, d, s, e, onFile) => { onFile(100); await sleep(500); return TREE; });
    const { events } = await readStream('?path=E%3A%5C');
    for (const p of events.filter((e) => e.event === 'progress')) expect(p.data.percent).toBeNull();
  });

  it('asks for no drive figure for a folder', async () => {
    scanDirectory.mockResolvedValueOnce(TREE);
    await readStream('?path=D%3A%5CGames');
    expect(getDriveSpace).not.toHaveBeenCalled();
    expect(getSystemDriveSpace).not.toHaveBeenCalled();
  });
});
