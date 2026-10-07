// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Icons and Store apps are answered from what the backend saved last launch, so
 * they are on screen at once; the real answer is made behind that. The hook asks
 * once more when it has had time to land, so a program installed since the last
 * launch gets its icon without a restart. */

const fetchProgramIcons = vi.fn(async () => ({}));
const fetchPackageIcons = vi.fn(async () => ({}));
const fetchStoreApps = vi.fn(async () => []);
vi.mock('../lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => []),
  fetchProgramIcons: (...a) => fetchProgramIcons(...a),
  fetchProgramSizes: vi.fn(async () => ({})),
  fetchProgramVersions: vi.fn(async () => ({})),
  fetchProgramInstallDates: vi.fn(async () => ({})),
  fetchStoreApps: (...a) => fetchStoreApps(...a),
  fetchBrowserExtensions: vi.fn(async () => []),
  fetchPackageIcons: (...a) => fetchPackageIcons(...a),
  fetchRunningPrograms: vi.fn(async () => ({}))
}));

const { useProgramData, REFRESH_AFTER_LAUNCH_MS } = await import('./usePrograms.js');

const wrapper = (client) => ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe('useProgramData: the one refresh after launch', () => {
  it('asks for the icons and Store apps again once, after the backend has had time to refresh', async () => {
    const client = newClient();
    const { unmount } = renderHook(() => useProgramData({ loadDecorations: true }), { wrapper: wrapper(client) });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(fetchProgramIcons).toHaveBeenCalledTimes(1);
    expect(fetchPackageIcons).toHaveBeenCalledTimes(1);
    expect(fetchStoreApps).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_LAUNCH_MS); });
    expect(fetchProgramIcons).toHaveBeenCalledTimes(2);
    expect(fetchPackageIcons).toHaveBeenCalledTimes(2);
    expect(fetchStoreApps).toHaveBeenCalledTimes(2);

    // once only
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_LAUNCH_MS * 3); });
    expect(fetchProgramIcons).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does nothing before Applications has been opened, and nothing after the screen is gone', async () => {
    const client = newClient();
    const idle = renderHook(() => useProgramData({ loadDecorations: false }), { wrapper: wrapper(client) });
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_LAUNCH_MS * 2); });
    expect(fetchProgramIcons).not.toHaveBeenCalled();
    idle.unmount();

    const gone = renderHook(() => useProgramData({ loadDecorations: true }), { wrapper: wrapper(newClient()) });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    gone.unmount();
    fetchProgramIcons.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_LAUNCH_MS * 2); });
    expect(fetchProgramIcons).not.toHaveBeenCalled();
  });
});
