import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteQuarantineBatch, emptyQuarantine } from './api.js';

global.fetch = vi.fn();

describe('deleteQuarantineBatch', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('DELETEs the batch by path parameter', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true, freedBytes: 500 }) });
    const result = await deleteQuarantineBatch('1705312200000-TestApp');
    expect(fetch).toHaveBeenCalledWith(
      `http://127.0.0.1:3101/api/quarantine/${encodeURIComponent('1705312200000-TestApp')}`,
      { method: 'DELETE' }
    );
    expect(result).toEqual({ deleted: true, freedBytes: 500 });
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Batch not found' }) });
    await expect(deleteQuarantineBatch('nope')).rejects.toThrow('Batch not found');
  });
});

describe('emptyQuarantine', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('POSTs to /quarantine/empty and returns the summary', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ deletedCount: 3, freedBytes: 1500 }) });
    const result = await emptyQuarantine();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3101/api/quarantine/empty', { method: 'POST' });
    expect(result).toEqual({ deletedCount: 3, freedBytes: 1500 });
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });
    await expect(emptyQuarantine()).rejects.toThrow('boom');
  });
});
