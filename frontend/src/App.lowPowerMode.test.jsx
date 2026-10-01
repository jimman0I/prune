// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen } from './testSupport/renderScreen.jsx';

/** Settings -> General -> Low power mode. App.jsx reads the persisted
 * setting (via the same useSettings() SettingsPage uses, sharing its
 * React Query cache) and hands it to useLowPowerMode(), which stamps
 * data-low-power on <html> -- index.css's own tests already prove what
 * that attribute does; this file proves App.jsx actually wires the real
 * setting to it. */

const fetchSettings = vi.fn(async () => ({}));

vi.mock('./lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => []),
  fetchProgramIcons: vi.fn(async () => ({})),
  fetchProgramSizes: vi.fn(async () => ({})),
  fetchProgramVersions: vi.fn(async () => ({})),
  fetchProgramInstallDates: vi.fn(async () => ({})),
  fetchStoreApps: vi.fn(async () => ([])),
  fetchBrowserExtensions: vi.fn(async () => ([])),
  fetchRunningPrograms: vi.fn(async () => ({})),
  fetchPackageIcons: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(async () => []),
  fetchStartupIcons: vi.fn(async () => ({})),
  fetchAutomation: vi.fn(async () => ({})),
  checkAutomation: vi.fn(async () => ({})),
  fetchDuplicates: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(async () => ({})),
  setStartupItemEnabled: vi.fn(async () => ({})),
  revealInExplorer: vi.fn(async () => ({})),
  openInstalledAppsSettings: vi.fn(async () => ({})),
  scanForLeftovers: vi.fn(async () => ({})),
  scanForcedUninstall: vi.fn(async () => ({})),
  removeQuarantined: vi.fn(async () => ({})),
  fetchQuarantineBatches: vi.fn(async () => ({ batches: [] })),
  restoreQuarantineBatch: vi.fn(async () => ({})),
  deleteQuarantineBatch: vi.fn(async () => ({})),
  emptyQuarantine: vi.fn(async () => ({})),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async () => ({})),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '0.0.0' })),
  openUpdatePage: vi.fn(async () => ({})),
  runSandboxTest: vi.fn(async () => ({})),
  streamDeepCleanScan: vi.fn(async () => ({})),
  fetchDeepCleanRules: vi.fn(async () => []),
  fetchDeepCleanScan: vi.fn(async () => ({})),
  executeDeepClean: vi.fn(async () => ({})),
  streamDeepCleanExecute: vi.fn(async () => ({})),
  fetchDiskHealth: vi.fn(async () => ({})),
  unlockDiskWear: vi.fn(async () => ({})),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchDiskSpace: vi.fn(async () => ({})),
  scanDriveFast: vi.fn(async () => ({})),
  fetchDiskScan: vi.fn(async () => ({})),
  fetchUninstallHistory: vi.fn(async () => []),
  appendHistoryEntry: vi.fn(async () => ({})),
  parseSSELine: vi.fn(async () => ({})),
  streamUninstall: vi.fn(async () => new Promise(() => {}))
}));

const App = (await import('./App.jsx')).default;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({});
  document.documentElement.removeAttribute('data-low-power');
});

const stamped = () => document.documentElement.hasAttribute('data-low-power');

describe('low power mode, wired from the real persisted setting', () => {
  it('does not stamp the attribute when the setting is off', async () => {
    fetchSettings.mockResolvedValue({ lowPowerMode: false });
    renderScreen(<App />);
    await screen.findByRole('navigation', { name: 'Main' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stamped()).toBe(false);
  });

  it('stamps the attribute once the real setting loads as true', async () => {
    fetchSettings.mockResolvedValue({ lowPowerMode: true });
    renderScreen(<App />);
    await waitFor(() => expect(stamped()).toBe(true));
  });

  it('treats a missing lowPowerMode key (an old settings file) as off, not on', async () => {
    fetchSettings.mockResolvedValue({ theme: 'dark' }); // no lowPowerMode key at all
    renderScreen(<App />);
    await screen.findByRole('navigation', { name: 'Main' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stamped()).toBe(false);
  });
});
