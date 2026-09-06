import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Both limits, run together.
 *
 * The thing every caller actually wants: "make the quarantine obey what
 * the user asked for". Age and size are separate rules with separate
 * settings, and nobody outside this file should have to remember that
 * there are two of them or which order they go in.
 */

const purgeExpiredQuarantine = vi.fn(async () => ({ ok: true, purged: [], failed: [] }));
// Partial: retentionDaysFrom and RETENTION_OFF are the real ones, because
// which settings count as "off" is the thing being relied on here, not
// something this test should get to redefine.
vi.mock('./quarantineRetention.js', async (importOriginal) => ({
  ...(await importOriginal()),
  purgeExpiredQuarantine: (...a) => purgeExpiredQuarantine(...a)
}));

const purgeOversizeQuarantine = vi.fn(async () => ({
  ok: true, purged: [], failed: [], stillOverCap: false, totalBytes: 0
}));
vi.mock('./quarantineSizeCap.js', async (importOriginal) => ({
  ...(await importOriginal()),
  purgeOversizeQuarantine: (...a) => purgeOversizeQuarantine(...a)
}));

const listQuarantineBatches = vi.fn(async () => []);
vi.mock('./quarantine.js', () => ({
  listQuarantineBatches: (...a) => listQuarantineBatches(...a),
  deletePermanently: vi.fn()
}));

const { enforceQuarantineLimits } = await import('./quarantineLimits.js');

/** Both limits switched on. Most of these tests are about what the two
 * passes do together, which the default -- both off -- deliberately
 * short-circuits before either runs. */
const BOTH_ON = { quarantineRetentionDays: 30, quarantineMaxSizeGb: 5 };

const batch = (name, createdAt, totalSizeBytes) => ({
  programName: name, createdAt, totalSizeBytes, batchDir: `C:\\q\\${createdAt}-${name}`
});

beforeEach(() => {
  vi.clearAllMocks();
  purgeExpiredQuarantine.mockResolvedValue({ ok: true, purged: [], failed: [] });
  purgeOversizeQuarantine.mockResolvedValue({
    ok: true, purged: [], failed: [], stillOverCap: false, totalBytes: 0
  });
  listQuarantineBatches.mockResolvedValue([]);
});

describe('enforceQuarantineLimits', () => {
  it('applies age before size', async () => {
    // Order matters and it is not arbitrary. An expired batch should go
    // for being expired, whatever the total happens to be; running size
    // first could evict a batch that was about to be removed anyway and
    // spare one the user had said to stop keeping.
    const order = [];
    purgeExpiredQuarantine.mockImplementationOnce(async () => {
      order.push('age');
      return { ok: true, purged: [], failed: [] };
    });
    purgeOversizeQuarantine.mockImplementationOnce(async () => {
      order.push('size');
      return { ok: true, purged: [], failed: [], stillOverCap: false, totalBytes: 0 };
    });
    await enforceQuarantineLimits(BOTH_ON);
    expect(order).toEqual(['age', 'size']);
  });

  it('hands the size pass the list left after the age pass', async () => {
    // Otherwise it would decide against batches that no longer exist and
    // report deleting things the age pass had already taken.
    const remaining = [batch('Kept', 5, 100)];
    listQuarantineBatches.mockResolvedValue(remaining);
    await enforceQuarantineLimits({ quarantineMaxSizeGb: 1 });
    expect(purgeOversizeQuarantine).toHaveBeenCalledWith(
      { quarantineMaxSizeGb: 1 }, { batches: remaining }
    );
  });

  it('reports everything that went, and why each one went', async () => {
    // "Purged 3" tells nobody whether the thing they wanted back is gone.
    purgeExpiredQuarantine.mockResolvedValueOnce({
      ok: true, purged: [batch('Ancient', 1, 10)], failed: []
    });
    purgeOversizeQuarantine.mockResolvedValueOnce({
      ok: true, purged: [batch('Big', 2, 999)], failed: [], stillOverCap: false, totalBytes: 5
    });
    const result = await enforceQuarantineLimits(BOTH_ON);
    expect(result.purged).toEqual([
      { programName: 'Ancient', reason: 'age' },
      { programName: 'Big', reason: 'size' }
    ]);
  });

  it('carries the failures through from both passes', async () => {
    purgeExpiredQuarantine.mockResolvedValueOnce({
      ok: true, purged: [], failed: [{ ...batch('Locked', 1, 10), error: 'EBUSY' }]
    });
    purgeOversizeQuarantine.mockResolvedValueOnce({
      ok: true, purged: [], failed: [{ ...batch('Busy', 2, 10), error: 'EPERM' }],
      stillOverCap: true, totalBytes: 9
    });
    const result = await enforceQuarantineLimits(BOTH_ON);
    expect(result.failed).toEqual([
      { programName: 'Locked', reason: 'age', error: 'EBUSY' },
      { programName: 'Busy', reason: 'size', error: 'EPERM' }
    ]);
    expect(result.stillOverCap).toBe(true);
  });

  it('runs the size pass even when the age pass failed', async () => {
    // They are independent limits. An unreadable directory listing in one
    // is not a reason to leave the other unenforced -- and the disk is
    // the thing the size cap is protecting.
    purgeExpiredQuarantine.mockResolvedValueOnce({ ok: false, error: 'EACCES', purged: [], failed: [] });
    const result = await enforceQuarantineLimits(BOTH_ON);
    expect(purgeOversizeQuarantine).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('EACCES');
  });

  it('does nothing at all when neither limit is set', async () => {
    // The default. Both passes are cheap no-ops on their own, but this is
    // called after every removal, so "cheap" has to mean no directory
    // read either.
    const result = await enforceQuarantineLimits({});
    expect(listQuarantineBatches).not.toHaveBeenCalled();
    expect(result.purged).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('survives being handed no settings at all', async () => {
    const result = await enforceQuarantineLimits(undefined);
    expect(result.ok).toBe(true);
    expect(result.purged).toEqual([]);
  });
});
