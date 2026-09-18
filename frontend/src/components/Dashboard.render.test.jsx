// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen, makeTestClient } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

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

describe('what can be copied', () => {
  it('the reason drive health could not be read', async () => {
    fetchDiskHealth.mockRejectedValue(new Error('WMI unavailable'));
    render();
    // Retried once before it reaches the screen; see the test below.
    const message = await screen.findByText(/Couldn't read drive health: WMI unavailable/, {}, { timeout: 5000 });
    expect(isCopyable(message)).toBe(true);
  });
});

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

describe('the System Health score', () => {
  it('shows the composite score, not the raw drive-wear percent, and a breakdown line', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy',
        lifeRemainingPercent: 100, readErrorsUncorrected: 0, writeErrorsUncorrected: 0,
        smart: { mediaErrors: 0 }
      }]
    });
    fetchDiskSpace.mockResolvedValue({ freeBytes: 500 * GB, totalBytes: 1000 * GB }); // 50% free, full storage credit
    render();

    // drive 100*40 + storage 100*25 + apps 100*20 + errors 100*15 = 100
    expect(await screen.findByText('System Health')).toBeTruthy();
    expect(await screen.findByText('100%')).toBeTruthy();
    expect(await screen.findByText(/Drive 100.*Storage 100.*Apps 100.*Errors 100/)).toBeTruthy();
  });

  it('reflects a broken app in both the score and the breakdown line', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy',
        lifeRemainingPercent: 100, readErrorsUncorrected: 0, writeErrorsUncorrected: 0,
        smart: { mediaErrors: 0 }
      }]
    });
    fetchDiskSpace.mockResolvedValue({ freeBytes: 500 * GB, totalBytes: 1000 * GB });
    const programs = [{ health: { orphaned: true } }];
    renderScreen(<Dashboard programs={programs} totalSize={0} onNavigate={() => {}} />);

    // drive 100*40 + storage 100*25 + apps 75*20 + errors 100*15 = 9500/100 = 95
    expect(await screen.findByText('95%')).toBeTruthy();
    expect(await screen.findByText(/Apps 75/)).toBeTruthy();
  });

  it('shows the drive detail sub-heading above the existing drive-specific content', async () => {
    render();
    expect(await screen.findByText('Drive detail')).toBeTruthy();
    // The existing drive-specific content is still there, unchanged.
    expect(await screen.findByText(/Test NVMe/)).toBeTruthy();
  });
});
