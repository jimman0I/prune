import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = { appendHistoryEntry: vi.fn(), updateHistoryEntry: vi.fn() };
vi.mock('./api.js', () => ({
  appendHistoryEntry: (...a) => api.appendHistoryEntry(...a),
  updateHistoryEntry: (...a) => api.updateHistoryEntry(...a)
}));
const { recordHistory, patchHistory, removalFields } = await import('./historyRecord.js');

beforeEach(() => vi.clearAllMocks());

describe('recordHistory', () => {
  it('resolves the id of the entry it wrote', async () => {
    api.appendHistoryEntry.mockResolvedValue({ ok: true, id: 'abc' });
    expect(await recordHistory({ programName: 'A' })).toBe('abc');
    expect(api.appendHistoryEntry).toHaveBeenCalledWith({ programName: 'A' });
  });

  it('resolves null, never throws, when nothing was written', async () => {
    api.appendHistoryEntry.mockResolvedValue({ ok: true, skipped: true });
    expect(await recordHistory({ programName: 'A' })).toBeNull();
    api.appendHistoryEntry.mockRejectedValue(new Error('backend down'));
    expect(await recordHistory({ programName: 'A' })).toBeNull();
  });
});

describe('patchHistory', () => {
  it('updates the entry', async () => {
    api.updateHistoryEntry.mockResolvedValue({ ok: true });
    expect(await patchHistory('abc', { outcome: 'removed' })).toBe(true);
    expect(api.updateHistoryEntry).toHaveBeenCalledWith('abc', { outcome: 'removed' });
  });

  it('does nothing without an id and never throws', async () => {
    expect(await patchHistory(null, {})).toBe(false);
    expect(api.updateHistoryEntry).not.toHaveBeenCalled();
    api.updateHistoryEntry.mockRejectedValue(new Error('x'));
    expect(await patchHistory('abc', {})).toBe(false);
  });
});

describe('removalFields', () => {
  const scan = { files: { items: [1, 2, 3] }, registryKeys: { items: [1] }, scheduledTasks: { items: [1] } };

  it('adds up what was found, removed and freed', () => {
    const fields = removalFields({
      destination: 'quarantine', batchDir: 'Q:\\b', totalSizeBytes: 500, files: [1, 2], registryKeys: [1],
      scheduledTasks: { removed: [1], failed: [] }, restorePoint: { created: false, reason: 'turned off' }
    }, scan);
    expect(fields).toEqual({
      leftoversFound: 5, leftoversRemoved: 4, bytesFreed: 500, tasksRemoved: 1, failedCount: 0, outcome: 'removed',
      destination: 'quarantine', quarantineBatch: 'Q:\\b', restorePoint: { created: false, reason: 'turned off' }
    });
  });

  it('calls an outcome with failures partial', () => {
    const fields = removalFields({ files: [1], registryKeys: [], failedFiles: [{}], failedRegistryKeys: [{}, {}] }, scan);
    expect(fields.failedCount).toBe(3);
    expect(fields.outcome).toBe('partial');
  });

  it('copes with a thin manifest', () => {
    expect(removalFields({}, {})).toMatchObject({ leftoversFound: 0, leftoversRemoved: 0, bytesFreed: 0, outcome: 'removed' });
    expect(removalFields(undefined, undefined).leftoversFound).toBe(0);
  });
});
