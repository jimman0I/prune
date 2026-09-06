// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSingleFlight } from './useSingleFlight.js';

/** One async action at a time, however fast the button is clicked.
 *
 * The bug this exists for, in DiskMap: a handler read the pending node
 * out of its own closure and then called setState to clear it. That
 * reads like a guard and is not one -- setState does not change the value
 * the CURRENT closure captured, so two clicks landing before the
 * re-render both saw the node and both called the API. The second removal
 * failed with "that path is no longer there", so a successful removal was
 * followed by an error toast reporting it.
 *
 * A ref is the fix because a ref changes synchronously. The same shape
 * guards the batch uninstall, whose only protection was its own button
 * unmounting.
 */

describe('useSingleFlight', () => {
  it('runs the action', async () => {
    const action = vi.fn(async () => 'done');
    const { result } = renderHook(() => useSingleFlight(action));
    await act(async () => { await result.current(); });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('ignores a second call while the first is still running', async () => {
    // The double-click. Both calls happen before any re-render, which is
    // exactly the window a setState-based guard leaves open.
    let release;
    const action = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useSingleFlight(action));

    act(() => { result.current(); result.current(); result.current(); });
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => { release(); });
  });

  it('accepts a new call once the first has finished', async () => {
    // A guard that never reopened would break the button after one use.
    const action = vi.fn(async () => {});
    const { result } = renderHook(() => useSingleFlight(action));
    await act(async () => { await result.current(); });
    await act(async () => { await result.current(); });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('reopens even when the action throws', async () => {
    // Otherwise one failure disables the control for the rest of the
    // session, with nothing on screen to explain why.
    const action = vi.fn(async () => { throw new Error('EBUSY'); });
    const { result } = renderHook(() => useSingleFlight(action));

    await act(async () => { await expect(result.current()).rejects.toThrow('EBUSY'); });
    await act(async () => { await expect(result.current()).rejects.toThrow('EBUSY'); });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('passes arguments through and returns the result', async () => {
    const action = vi.fn(async (a, b) => a + b);
    const { result } = renderHook(() => useSingleFlight(action));
    let value;
    await act(async () => { value = await result.current(2, 3); });
    expect(action).toHaveBeenCalledWith(2, 3);
    expect(value).toBe(5);
  });

  it('keeps a stable identity across renders', async () => {
    // It is handed to onClick, and a new function every render would make
    // it useless as a dependency and defeat any memoised child holding it.
    const action = vi.fn(async () => {});
    const { result, rerender } = renderHook(() => useSingleFlight(action));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('always calls the latest action, not the one captured first', async () => {
    // The stability above must not reintroduce the very problem this
    // replaces: a stale closure over an older handler.
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    const { result, rerender } = renderHook(({ fn }) => useSingleFlight(fn), {
      initialProps: { fn: first }
    });
    rerender({ fn: second });
    await act(async () => { await result.current(); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
