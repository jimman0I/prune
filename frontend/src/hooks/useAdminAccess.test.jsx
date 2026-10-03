// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminAccess } from './useAdminAccess.js';

const fetchMftStatus = vi.fn();
vi.mock('../lib/api.js', () => ({ fetchMftStatus: (...a) => fetchMftStatus(...a) }));

const canRestartAsAdmin = vi.fn();
vi.mock('../lib/adminRelaunch.js', () => ({
  canRestartAsAdmin: (...a) => canRestartAsAdmin(...a),
  restartAsAdmin: vi.fn()
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useAdminAccess(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  canRestartAsAdmin.mockResolvedValue(true);
});

describe('useAdminAccess: when the restart button may show', () => {
  it('does not offer a restart while the status is still loading', async () => {
    fetchMftStatus.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    // Let the bridge answer "yes, this build can restart": the status is what is missing.
    await waitFor(() => expect(canRestartAsAdmin).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current.elevated).toBe(false);
    expect(result.current.canRestart).toBe(false);
  });

  it('does not offer a restart when the status could not be read', async () => {
    fetchMftStatus.mockRejectedValue(new Error('backend not ready'));
    const { result } = setup();
    await waitFor(() => expect(fetchMftStatus).toHaveBeenCalled());
    await waitFor(() => expect(result.current.elevated).toBe(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.canRestart).toBe(false);
  });

  it('does not offer a restart to a Prune that is already elevated', async () => {
    fetchMftStatus.mockResolvedValue({ elevated: true });
    const { result } = setup();
    await waitFor(() => expect(result.current.elevated).toBe(true));
    expect(result.current.canRestart).toBe(false);
  });

  it('offers a restart once the status says it is not elevated', async () => {
    fetchMftStatus.mockResolvedValue({ elevated: false });
    const { result } = setup();
    await waitFor(() => expect(result.current.canRestart).toBe(true));
    expect(result.current.elevated).toBe(false);
  });

  it('offers no restart outside the packaged app, even when the status says not elevated', async () => {
    canRestartAsAdmin.mockResolvedValue(false);
    fetchMftStatus.mockResolvedValue({ elevated: false });
    const { result } = setup();
    await waitFor(() => expect(fetchMftStatus).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.canRestart).toBe(false);
  });
});
