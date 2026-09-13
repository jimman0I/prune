// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDeepCleanExecute } from './useDeepCleanExecute.js';

const streamDeepCleanExecute = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a)
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('useDeepCleanExecute', () => {
  it('starts idle, with no log and nothing cleaning', () => {
    const { result } = renderHook(() => useDeepCleanExecute());
    expect(result.current.cleaning).toBe(false);
    expect(result.current.log).toEqual([]);
    expect(result.current.currentId).toBeNull();
  });

  it('builds a BleachBit-style log line as each rule streams in, and reports the current one', async () => {
    let deliver;
    streamDeepCleanExecute.mockImplementation((ids, onEvent) => new Promise((resolve) => {
      deliver = async () => {
        onEvent('start', { total: 2 });
        onEvent('rule', { id: 'a', name: 'A Cache', freedBytes: 1024, skipped: [] });
        onEvent('rule', { id: 'b', name: 'B Cache', freedBytes: 2048, skipped: [] });
        resolve();
      };
    }));

    const { result } = renderHook(() => useDeepCleanExecute());

    let runPromise;
    act(() => { runPromise = result.current.run(['a', 'b']); });
    expect(result.current.cleaning).toBe(true);

    await act(async () => { await deliver(); await runPromise; });

    expect(result.current.cleaning).toBe(false);
    expect(result.current.log.map((l) => l.label)).toEqual(['Delete A Cache', 'Delete B Cache']);
    expect(result.current.executed).toBe(2);
    expect(result.current.total).toBe(2);
  });

  it('resolves with the same {freedBytes, results} shape the old one-shot executeDeepClean returned', async () => {
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('rule', { id: 'a', name: 'A Cache', freedBytes: 500, skipped: [{ path: 'x', reason: 'locked' }] });
    });

    const { result } = renderHook(() => useDeepCleanExecute());
    let outcome;
    await act(async () => { outcome = await result.current.run(['a']); });

    expect(outcome.freedBytes).toBe(500);
    expect(outcome.results).toEqual([{ id: 'a', name: 'A Cache', freedBytes: 500, skipped: [{ path: 'x', reason: 'locked' }] }]);
  });

  it('throws on a mid-stream error event, same contract the one-shot call had', async () => {
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('error', { message: 'disk full' });
    });

    const { result } = renderHook(() => useDeepCleanExecute());
    await expect(result.current.run(['a'])).rejects.toThrow('disk full');
    expect(result.current.cleaning).toBe(false);
  });

  it('throws when the stream cannot even be opened, same as before', async () => {
    streamDeepCleanExecute.mockRejectedValue(new Error('EBUSY: C:\\Windows\\Temp\\locked.tmp'));
    const { result } = renderHook(() => useDeepCleanExecute());
    await expect(result.current.run(['a'])).rejects.toThrow(/EBUSY/);
  });

  it('treats stop() as a normal outcome, not an error', async () => {
    let controller;
    streamDeepCleanExecute.mockImplementation((ids, onEvent, signal) => new Promise((resolve, reject) => {
      controller = signal;
      signal.addEventListener('abort', () => reject(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })));
    }));

    const { result } = renderHook(() => useDeepCleanExecute());
    let runPromise;
    act(() => { runPromise = result.current.run(['a']); });
    act(() => { result.current.stop(); });

    const outcome = await act(async () => runPromise);
    expect(controller.aborted).toBe(true);
    expect(outcome.aborted).toBe(true);
    expect(result.current.cleaning).toBe(false);
  });

  it('clears the previous run\'s log when a new one starts', async () => {
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('rule', { id: 'a', name: 'A Cache', freedBytes: 10, skipped: [] });
    });
    const { result } = renderHook(() => useDeepCleanExecute());
    await act(async () => { await result.current.run(['a']); });
    expect(result.current.log).toHaveLength(1);

    streamDeepCleanExecute.mockImplementation(async () => {});
    await act(async () => { await result.current.run(['b']); });
    expect(result.current.log).toEqual([]);
  });
});
