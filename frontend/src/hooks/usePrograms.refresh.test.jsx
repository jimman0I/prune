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
const fetchPrograms = vi.fn(async () => []);
const fetchProgramSizes = vi.fn(async () => ({}));
const requestStoreRefresh = vi.fn(async () => {});
vi.mock('../lib/api.js', () => ({
  fetchPrograms: (...a) => fetchPrograms(...a),
  requestStoreRefresh: (...a) => requestStoreRefresh(...a),
  fetchProgramIcons: (...a) => fetchProgramIcons(...a),
  fetchProgramSizes: (...a) => fetchProgramSizes(...a),
  fetchProgramVersions: vi.fn(async () => ({})),
  fetchProgramInstallDates: vi.fn(async () => ({})),
  fetchStoreApps: (...a) => fetchStoreApps(...a),
  fetchBrowserExtensions: vi.fn(async () => []),
  fetchPackageIcons: (...a) => fetchPackageIcons(...a),
  fetchRunningPrograms: vi.fn(async () => ({}))
}));

const { useProgramData, REFRESH_AFTER_LAUNCH_MS, REFRESH_AFTER_RETURN_MS } = await import('./usePrograms.js');
const { RETURN_MIN_AWAY_MS } = await import('./useReturnToWindow.js');

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

describe('useProgramData: coming back to the window', () => {
  let focused;
  beforeEach(() => {
    focused = true;
    vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  });

  const leave = () => { focused = false; window.dispatchEvent(new Event('blur')); };
  const comeBack = () => { focused = true; window.dispatchEvent(new Event('focus')); };

  it('after a real absence reads the list now, and the Store list once its re-scan has had time', async () => {
    const client = newClient();
    const { unmount } = renderHook(() => useProgramData({ loadDecorations: true }), { wrapper: wrapper(client) });
    // past the launch refresh, so what is counted below is the return and nothing else
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_LAUNCH_MS + 500); });
    vi.clearAllMocks();

    await act(async () => { leave(); await vi.advanceTimersByTimeAsync(RETURN_MIN_AWAY_MS + 1_000); comeBack(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(fetchPrograms).toHaveBeenCalledTimes(1);
    expect(fetchProgramSizes).toHaveBeenCalledTimes(1);
    expect(requestStoreRefresh).toHaveBeenCalledTimes(1);
    expect(fetchStoreApps).not.toHaveBeenCalled(); // not until the backend's scan can have finished

    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_RETURN_MS); });
    expect(fetchStoreApps).toHaveBeenCalledTimes(1);
    expect(fetchProgramIcons).toHaveBeenCalledTimes(1);
    expect(fetchPackageIcons).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does nothing for a quick alt-tab', async () => {
    const { unmount } = renderHook(() => useProgramData({ loadDecorations: true }), { wrapper: wrapper(newClient()) });
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_LAUNCH_MS + 500); });
    vi.clearAllMocks();
    await act(async () => { leave(); await vi.advanceTimersByTimeAsync(2_000); comeBack(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_RETURN_MS + 1_000); });
    expect(fetchPrograms).not.toHaveBeenCalled();
    expect(requestStoreRefresh).not.toHaveBeenCalled();
    unmount();
  });

  it('leaves the icons alone until Applications has been opened', async () => {
    const { unmount } = renderHook(() => useProgramData({ loadDecorations: false }), { wrapper: wrapper(newClient()) });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.clearAllMocks();
    await act(async () => { leave(); await vi.advanceTimersByTimeAsync(RETURN_MIN_AWAY_MS + 1_000); comeBack(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(REFRESH_AFTER_RETURN_MS + 500); });
    expect(fetchPrograms).toHaveBeenCalledTimes(1);
    expect(fetchProgramIcons).not.toHaveBeenCalled();
    expect(fetchPackageIcons).not.toHaveBeenCalled();
    unmount();
  });
});
