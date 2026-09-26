// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useJunkMeasure } from './useJunkMeasure.js';

const streamDeepCleanScan = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a)
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('useJunkMeasure', () => {
  it('starts idle, with nothing measured', () => {
    const { result } = renderHook(() => useJunkMeasure());
    expect(result.current.status).toBe('idle');
    expect(result.current.bytes).toBeNull();
  });

  it('sums only recommended, present, readable rules that have a size, and reports progress', async () => {
    let finish;
    let emit;
    streamDeepCleanScan.mockImplementation((onEvent) => new Promise((resolve) => {
      emit = onEvent;
      finish = resolve;
    }));
    const { result } = renderHook(() => useJunkMeasure());
    act(() => { result.current.start(); });
    expect(result.current.status).toBe('measuring');

    act(() => {
      emit('start', { total: 5 });
      emit('rule', { id: 'a', recommended: true, present: true, accessible: true, sizeBytes: 1000 });
      emit('rule', { id: 'b', recommended: true, present: true, accessible: true, sizeBytes: 500 });
      emit('rule', { id: 'c', recommended: false, present: true, accessible: true, sizeBytes: 9999 });
      emit('rule', { id: 'd', recommended: true, present: false, sizeBytes: 7777 });
      emit('rule', { id: 'e', recommended: true, present: true, accessible: false, sizeBytes: null });
    });
    // Progress is live, but the total is withheld until the scan is done.
    expect(result.current.scanned).toBe(5);
    expect(result.current.total).toBe(5);
    expect(result.current.bytes).toBeNull();

    await act(async () => { finish(); });
    expect(result.current.status).toBe('done');
    expect(result.current.bytes).toBe(1500);
    expect(result.current.cleanerCount).toBe(2);
  });

  it('says why it failed, and can be started again', async () => {
    streamDeepCleanScan.mockRejectedValueOnce(new Error('scan broke'));
    const { result } = renderHook(() => useJunkMeasure());
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('scan broke');
    expect(result.current.bytes).toBeNull();

    streamDeepCleanScan.mockImplementationOnce(async () => {});
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('done');
    expect(result.current.bytes).toBe(0);
  });

  it('treats an error event mid-stream as a failure, not a small total', async () => {
    streamDeepCleanScan.mockImplementation(async (onEvent) => { onEvent('error', { message: 'disk gone' }); });
    const { result } = renderHook(() => useJunkMeasure());
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('disk gone');
  });

  it('aborts the walk when the Dashboard goes away, and reports nothing after', async () => {
    let signal;
    streamDeepCleanScan.mockImplementation((onEvent, s) => new Promise((resolve, reject) => {
      signal = s;
      s.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const { result, unmount } = renderHook(() => useJunkMeasure());
    act(() => { result.current.start(); });
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('ignores a second start while one is running', () => {
    streamDeepCleanScan.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useJunkMeasure());
    act(() => { result.current.start(); result.current.start(); });
    expect(streamDeepCleanScan).toHaveBeenCalledTimes(1);
  });
});
