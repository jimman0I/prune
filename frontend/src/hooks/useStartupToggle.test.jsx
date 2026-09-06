// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { keys } from '../lib/queryClient.js';

/** The startup toggle's optimistic update, under overlapping clicks.
 *
 * Two behaviours that only differ when more than one write is in flight,
 * which is exactly the case nothing was testing.
 */

const setStartupItemEnabled = vi.fn();
vi.mock('../lib/api.js', () => ({
  setStartupItemEnabled: (...a) => setStartupItemEnabled(...a),
  fetchStartupItems: vi.fn(async () => []),
  fetchStartupIcons: vi.fn(async () => ({})),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchSettings: vi.fn(), updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const { useStartupToggle } = await import('./useSystemQueries.js');

const ITEMS = [
  { id: 'a', name: 'Discord', enabled: false },
  { id: 'b', name: 'Steam', enabled: false }
];

let client;
const wrapper = ({ children }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(keys.startupItems, ITEMS);
});

const rowState = (id) =>
  client.getQueryData(keys.startupItems).find((i) => i.id === id).enabled;

describe('rolling back a failed toggle', () => {
  it('returns the row to what it actually was, not to the inverse of the request', async () => {
    // Deliberately a request whose value MATCHES the row's current state.
    // That is the case the two rollbacks disagree on: the inverse of
    // "disable" is "enabled", so an inverse-based rollback switches on a
    // row that was off and stays off. It arises for real from a
    // re-click after an optimistic update has already moved the row.
    client.setQueryData(keys.startupItems, [{ id: 'a', name: 'Discord', enabled: false }]);
    setStartupItemEnabled.mockResolvedValueOnce({ ok: false, error: 'registry write failed' });

    const { result } = renderHook(() => useStartupToggle(), { wrapper });
    await act(async () => {
      await result.current.mutation.mutateAsync({ id: 'a', enabled: false }).catch(() => {});
    });

    // Still off. The inverse rollback would have turned it on.
    await waitFor(() => expect(rowState('a')).toBe(false));
  });

  // Two overlapping writes to the SAME row are deliberately not asserted
  // here, because they have no well-defined resting state: each rolls
  // back to the snapshot it captured, and whichever settles last wins.
  // That is what the invalidateQueries on settle is for -- the machine is
  // re-read afterwards and is authoritative over any guess either
  // mutation made. Asserting an order here would be asserting a race.

  it('does not undo a different row that succeeded meanwhile', async () => {
    // Why the rollback restores one row rather than the whole captured
    // list: b's successful change must survive a's failure.
    let settleA;
    setStartupItemEnabled
      .mockImplementationOnce(() => new Promise((r) => { settleA = r; }))
      .mockResolvedValueOnce({ ok: true, enabled: true });

    const { result } = renderHook(() => useStartupToggle(), { wrapper });

    act(() => { result.current.mutation.mutate({ id: 'a', enabled: true }); });
    act(() => { result.current.mutation.mutate({ id: 'b', enabled: true }); });
    await waitFor(() => expect(rowState('b')).toBe(true));

    await act(async () => { settleA({ ok: false, error: 'nope' }); });

    await waitFor(() => expect(rowState('a')).toBe(false));
    expect(rowState('b')).toBe(true);
  });
});

describe('which rows report as busy', () => {
  it('keeps the first row busy while a second is toggled', async () => {
    // Read from mutation.variables before this, which holds only the
    // latest call -- so a's busy state cleared while a was still writing,
    // and the switch (which ignores clicks while busy) became clickable
    // again mid-write.
    let settleA;
    setStartupItemEnabled
      .mockImplementationOnce(() => new Promise((r) => { settleA = r; }))
      .mockImplementationOnce(() => new Promise(() => {}));

    const { result } = renderHook(() => useStartupToggle(), { wrapper });

    act(() => { result.current.mutation.mutate({ id: 'a', enabled: true }); });
    await waitFor(() => expect(result.current.pendingIds.has('a')).toBe(true));

    act(() => { result.current.mutation.mutate({ id: 'b', enabled: true }); });
    await waitFor(() => expect(result.current.pendingIds.has('b')).toBe(true));

    // Both, because both are genuinely still writing.
    expect(result.current.pendingIds.has('a')).toBe(true);

    await act(async () => { settleA({ ok: true, enabled: true }); });
    await waitFor(() => expect(result.current.pendingIds.has('a')).toBe(false));
    expect(result.current.pendingIds.has('b')).toBe(true);
  });
});
