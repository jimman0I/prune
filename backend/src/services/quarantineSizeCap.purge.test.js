import { describe, it, expect, beforeEach, vi } from 'vitest';

/** purgeOversizeQuarantine, which is the half that actually deletes.
 *
 * Its own file because it needs quarantine.js mocked, and the pure
 * functions beside it are better tested without that.
 */

const listQuarantineBatches = vi.fn();
const deletePermanently = vi.fn(async () => ({ deleted: true }));
vi.mock('./quarantine.js', () => ({
  listQuarantineBatches: (...a) => listQuarantineBatches(...a),
  deletePermanently: (...a) => deletePermanently(...a)
}));

const { purgeOversizeQuarantine, SIZE_CAP_OFF, GIB } = await import('./quarantineSizeCap.js');

const batch = (name, createdAt, totalSizeBytes) => ({
  programName: name, createdAt, totalSizeBytes, batchDir: `C:\\q\\${createdAt}-${name}`
});

beforeEach(() => {
  vi.clearAllMocks();
  deletePermanently.mockResolvedValue({ deleted: true });
});

describe('purgeOversizeQuarantine', () => {
  it('deletes nothing, and does not even look, when no cap is set', async () => {
    // Off is the default. Reading the whole quarantine directory on every
    // call to decide to do nothing would be a cost paid by every user who
    // never turned this on.
    const result = await purgeOversizeQuarantine({});
    expect(result).toEqual({
      ok: true, maxBytes: SIZE_CAP_OFF, purged: [], failed: [], stillOverCap: false
    });
    expect(listQuarantineBatches).not.toHaveBeenCalled();
    expect(deletePermanently).not.toHaveBeenCalled();
  });

  it('deletes the oldest batches and names them', async () => {
    // A count is not something a user can check or dispute. Which
    // programs lost their backup is.
    listQuarantineBatches.mockResolvedValueOnce([
      batch('Kept', 5, 0.6 * GIB), batch('Dropped', 4, 0.6 * GIB), batch('AlsoDropped', 3, 0.6 * GIB)
    ]);
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 1 });
    expect(result.ok).toBe(true);
    expect(result.purged.map((b) => b.programName)).toEqual(['Dropped', 'AlsoDropped']);
    expect(deletePermanently).toHaveBeenCalledWith('C:\\q\\4-Dropped');
    expect(deletePermanently).toHaveBeenCalledWith('C:\\q\\3-AlsoDropped');
    expect(deletePermanently).not.toHaveBeenCalledWith('C:\\q\\5-Kept');
  });

  it('keeps a quarantine sitting exactly on the cap', async () => {
    // The boundary rounds toward keeping the backup, the same direction
    // expiredBatches rounds -- "at the limit" is not "over the limit",
    // and this operation has no undo of its own.
    listQuarantineBatches.mockResolvedValueOnce([
      batch('A', 5, 0.5 * GIB), batch('B', 4, 0.5 * GIB)
    ]);
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 1 });
    expect(result.purged).toEqual([]);
    expect(result.stillOverCap).toBe(false);
    expect(deletePermanently).not.toHaveBeenCalled();
  });

  it('reports a batch it could not delete instead of claiming it went', async () => {
    // A locked file inside one batch must not leave the other four
    // sitting there, and must not be counted as freed either.
    listQuarantineBatches.mockResolvedValueOnce([
      batch('Kept', 5, GIB), batch('Locked', 4, GIB), batch('Fine', 3, GIB)
    ]);
    deletePermanently.mockImplementation(async (dir) => {
      if (dir.includes('Locked')) throw new Error('EBUSY');
      return { deleted: true };
    });
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 1 });
    expect(result.purged.map((b) => b.programName)).toEqual(['Fine']);
    expect(result.failed.map((b) => b.programName)).toEqual(['Locked']);
    expect(result.failed[0].error).toBe('EBUSY');
  });

  it('treats a batch that was already gone as a failure to report, not a success', async () => {
    listQuarantineBatches.mockResolvedValueOnce([
      batch('Kept', 5, GIB), batch('Vanished', 4, GIB)
    ]);
    deletePermanently.mockResolvedValue({ deleted: false, freedBytes: 0 });
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 1 });
    expect(result.purged).toEqual([]);
    expect(result.failed.map((b) => b.programName)).toEqual(['Vanished']);
  });

  it('says when the cap still does not hold afterwards', async () => {
    // One batch larger than the entire budget. Everything else went and
    // it is still over, and a limit quietly not holding is worse than one
    // that admits it -- this is what lets the screen say so.
    listQuarantineBatches.mockResolvedValueOnce([
      batch('Huge', 5, 60 * GIB), batch('Old', 4, GIB)
    ]);
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 5 });
    expect(result.purged.map((b) => b.programName)).toEqual(['Old']);
    expect(result.stillOverCap).toBe(true);
    expect(result.totalBytes).toBe(60 * GIB);
  });

  it('says when it does hold', async () => {
    listQuarantineBatches.mockResolvedValueOnce([
      batch('New', 5, GIB), batch('Old', 4, 10 * GIB)
    ]);
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 5 });
    expect(result.stillOverCap).toBe(false);
    expect(result.totalBytes).toBe(GIB);
  });

  it('reports a failed listing rather than deleting on a guess', async () => {
    listQuarantineBatches.mockRejectedValueOnce(new Error('EACCES'));
    const result = await purgeOversizeQuarantine({ quarantineMaxSizeGb: 1 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('EACCES');
    expect(deletePermanently).not.toHaveBeenCalled();
  });

  it('can be handed a list it has already read', async () => {
    // The caller that runs this right after creating a batch has just
    // listed them. Reading the directory a second time would be work for
    // an answer it already has.
    const result = await purgeOversizeQuarantine(
      { quarantineMaxSizeGb: 1 },
      { batches: [batch('New', 5, GIB), batch('Old', 4, GIB)] }
    );
    expect(listQuarantineBatches).not.toHaveBeenCalled();
    expect(result.purged.map((b) => b.programName)).toEqual(['Old']);
  });
});
