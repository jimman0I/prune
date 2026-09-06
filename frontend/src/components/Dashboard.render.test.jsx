// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen, makeTestClient } from '../testSupport/renderScreen.jsx';

/** The Dashboard, which until this audit was the one screen still
 * fetching outside the query layer.
 *
 * It held disk space and drive health in local state, filled by a bare
 * useEffect, while useDiskSpace and useDiskHealth sat exported and unused
 * a file away. These tests pin the two things that migration has to keep
 * true: the numbers still render, and the elevated wear unlock still
 * replaces the health reading rather than being thrown away by a refetch.
 */

const fetchDiskSpace = vi.fn();
const fetchDiskHealth = vi.fn();
const unlockDiskWear = vi.fn();
const fetchUninstallHistory = vi.fn(async () => []);
const fetchAutomation = vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 }));

vi.mock('../lib/api.js', () => ({
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskHealth: (...a) => fetchDiskHealth(...a),
  unlockDiskWear: (...a) => unlockDiskWear(...a),
  fetchUninstallHistory: (...a) => fetchUninstallHistory(...a),
  fetchAutomation: (...a) => fetchAutomation(...a),
  fetchResources: vi.fn(async () => ({ cpuPercent: 5, ram: { percent: 40 }, diskBytesPerSec: 0 })),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn()
}));

const Dashboard = (await import('./Dashboard.jsx')).default;

const GB = 1024 ** 3;

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 500 * GB });
  fetchDiskHealth.mockResolvedValue({
    disks: [{ deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy', lifeRemainingPercent: 93 }]
  });
});

const render = () => renderScreen(<Dashboard programs={[]} totalSize={0} onNavigate={() => {}} />);

describe('the Dashboard reads', () => {
  it('shows disk space from the query layer', async () => {
    render();
    await waitFor(() => expect(fetchDiskSpace).toHaveBeenCalled());
    expect(await screen.findByText(/400 GB Used/)).toBeTruthy();
  });

  it('shows the drive model once health resolves', async () => {
    render();
    expect(await screen.findByText(/Test NVMe/)).toBeTruthy();
  });

  it('says a health read failed rather than rendering an empty drive', async () => {
    // Not every machine exposes SMART. "No drives" is never true, so the
    // failure has to say so.
    fetchDiskHealth.mockRejectedValue(new Error('WMI unavailable'));
    render();
    // Generous, and deliberately so: useDiskHealth sets retry: 1, so the
    // failure is retried once with backoff before it reaches the screen.
    // That is real behaviour rather than a test artifact -- a machine
    // with no SMART support shows the message a second or two after the
    // rest of the Dashboard, and the default 1000ms matcher timeout was
    // landing inside that window.
    expect(await screen.findByText(/Couldn't read drive health: WMI unavailable/, {}, { timeout: 5000 }))
      .toBeTruthy();
  });

  it('fetches each reading once even when two consumers ask', async () => {
    // What the migration buys. Two Dashboards sharing one client dedupe
    // through the cache; the old local-state version issued a request per
    // mount, and the drive-health read is the slowest call on the screen.
    const client = makeTestClient();
    renderScreen(<Dashboard programs={[]} totalSize={0} onNavigate={() => {}} />, { client });
    renderScreen(<Dashboard programs={[]} totalSize={0} onNavigate={() => {}} />, { client });
    await waitFor(() => expect(fetchDiskHealth).toHaveBeenCalled());
    expect(fetchDiskHealth).toHaveBeenCalledTimes(1);
    expect(fetchDiskSpace).toHaveBeenCalledTimes(1);
  });
});
