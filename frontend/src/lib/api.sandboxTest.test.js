import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSandboxTest } from './api.js';

global.fetch = vi.fn();

describe('runSandboxTest', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('POSTs to /sandbox-test and returns the structured report', async () => {
    const report = { passed: true, steps: [{ name: 'x', passed: true, detail: 'y' }], error: null };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => report });
    const result = await runSandboxTest();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3101/api/sandbox-test', { method: 'POST' });
    expect(result).toEqual(report);
  });

  it('throws on a genuine server error (not a failed sandbox verdict, which is still a 200)', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });
    await expect(runSandboxTest()).rejects.toThrow('boom');
  });
});
