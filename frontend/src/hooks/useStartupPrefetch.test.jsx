// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { keys } from '../lib/queryClient.js';

/** Warming the startup screen before anyone asks for it.
 *
 * Measured on this machine against a cold backend: the startup list takes
 * 1.19s and its icons 2.30s, both spawning PowerShell. Nothing was asking
 * for either until the Startup tab was first opened, so the first visit
 * always showed a table of lettered tiles that swapped to real icons a
 * couple of seconds later. That pop is the whole complaint -- the data was
 * never wrong, it just arrived while the user was already looking.
 */

const fetchStartupItems = vi.fn(async () => [{ id: 'a', name: 'Discord' }]);
const fetchStartupIcons = vi.fn(async () => ({ a: 'data:image/png;base64,AAA' }));

vi.mock('../lib/api.js', () => ({
  fetchStartupItems: (...a) => fetchStartupItems(...a),
  fetchStartupIcons: (...a) => fetchStartupIcons(...a),
  setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchSettings: vi.fn(), updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const { useStartupPrefetch } = await import('./useStartupPrefetch.js');

let client;
const wrapper = ({ children }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 } }
  });
});

afterEach(() => {
  client.clear();
});

describe('useStartupPrefetch', () => {
  it('fetches the list and the icons without the screen being open', async () => {
    renderHook(() => useStartupPrefetch({ delayMs: 10 }), { wrapper });

    await waitFor(() => expect(fetchStartupItems).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchStartupIcons).toHaveBeenCalledTimes(1));
  });

  it('leaves the answers in the cache under the keys the screen reads', async () => {
    // The prefetch is worth nothing if it lands somewhere the screen does
    // not look. Same keys, so the screen's own useQuery finds them warm
    // and never enters a pending state at all.
    renderHook(() => useStartupPrefetch({ delayMs: 10 }), { wrapper });

    await waitFor(() => {
      expect(client.getQueryData(keys.startupItems)).toEqual([{ id: 'a', name: 'Discord' }]);
    });
    expect(client.getQueryData(keys.startupIcons)).toEqual({ a: 'data:image/png;base64,AAA' });
  });

  it('does not re-fetch data the screen already loaded', async () => {
    // Someone who opens Startup first and comes back later should not pay
    // for a second read of the registry: a fresh cache entry makes this a
    // no-op. Note this does NOT distinguish prefetchQuery from fetchQuery
    // -- both honour staleTime. The case that separates them is below.
    client.setQueryData(keys.startupItems, [{ id: 'existing' }]);
    client.setQueryData(keys.startupIcons, { existing: 'x' });

    renderHook(() => useStartupPrefetch({ delayMs: 10 }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fetchStartupItems).not.toHaveBeenCalled();
    expect(fetchStartupIcons).not.toHaveBeenCalled();
  });

  it('asks once, however often the app re-renders', async () => {
    // App re-renders on every tab switch, and each of those must not
    // spawn another pair of PowerShell reads.
    const { rerender } = renderHook(() => useStartupPrefetch({ delayMs: 10 }), { wrapper });
    await waitFor(() => expect(fetchStartupItems).toHaveBeenCalledTimes(1));

    rerender();
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fetchStartupItems).toHaveBeenCalledTimes(1);
    expect(fetchStartupIcons).toHaveBeenCalledTimes(1);
  });

  it('does not fire after the app has unmounted', async () => {
    // The warm-up is deferred, so there is a window where the work is
    // scheduled and the app is already gone. What protects that window is
    // the effect cleanup cancelling the pending callback -- verified by
    // mutation, since an in-callback guard turned out to be unreachable
    // and its removal changed nothing.
    const { unmount } = renderHook(() => useStartupPrefetch({ delayMs: 40 }), { wrapper });
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(fetchStartupItems).not.toHaveBeenCalled();
    expect(fetchStartupIcons).not.toHaveBeenCalled();
  });

  it('swallows a failed read instead of rejecting into nothing', async () => {
    // This is the actual reason for prefetchQuery over fetchQuery. Nobody
    // awaits this call, so a rejection here becomes an unhandled promise
    // rejection from a background warm-up the user never asked for -- and
    // in Electron that reaches the console of a shipped app. The failure
    // still belongs in the cache, for the screen to report if it is ever
    // opened.
    const boom = new Error('registry unavailable');
    fetchStartupItems.mockRejectedValueOnce(boom);
    // Hooked on the Node process, not via a DOM 'unhandledrejection'
    // event: vitest's jsdom environment does not dispatch that one, so a
    // listener on globalThis stays silent whether or not anything
    // rejected -- an assertion that cannot fail. Mutation testing caught
    // exactly that, by swapping in fetchQuery and watching the test pass.
    const unhandled = [];
    const onUnhandled = (reason) => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);

    try {
      renderHook(() => useStartupPrefetch({ delayMs: 10 }), { wrapper });
      await waitFor(() => expect(fetchStartupItems).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(unhandled).toEqual([]);
      expect(client.getQueryState(keys.startupItems)?.error).toBe(boom);
      // The other half still succeeded: one failure must not cost the row
      // its icons too.
      expect(client.getQueryData(keys.startupIcons)).toEqual({ a: 'data:image/png;base64,AAA' });
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
