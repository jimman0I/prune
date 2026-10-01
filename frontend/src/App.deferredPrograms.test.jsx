// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from './testSupport/renderScreen.jsx';
import { getLastProgramsCount, setLastProgramsCount } from './lib/lastProgramsCount.js';

/** Five of useProgramData's eight queries only feed Applications: icons,
 * versions, install dates, extensions, and the running-process poll.
 * App.jsx now defers all five -- via the real (unmocked) usePrograms.js --
 * until Applications has actually been opened once this session, using
 * `visited`, the same tracking that already decides which screens to
 * mount.
 *
 * Dashboard needs the base list and the measured sizes immediately for
 * its own space breakdown and largest-programs list, so those two (and
 * Store apps, which also feeds the total) must stay eager regardless of
 * which screen is showing -- this file checks both halves of that split.
 */

const fetchPrograms = vi.fn(async () => []);
const fetchProgramIcons = vi.fn(async () => ({}));
const fetchProgramSizes = vi.fn(async () => ({}));
const fetchProgramVersions = vi.fn(async () => ({}));
const fetchProgramInstallDates = vi.fn(async () => ({}));
const fetchStoreApps = vi.fn(async () => ([]));
const fetchBrowserExtensions = vi.fn(async () => ([]));
const fetchRunningPrograms = vi.fn(async () => ({}));
const fetchPackageIcons = vi.fn(async () => ({}));

vi.mock('./lib/api.js', () => ({
  fetchPrograms: (...a) => fetchPrograms(...a),
  fetchProgramIcons: (...a) => fetchProgramIcons(...a),
  fetchProgramSizes: (...a) => fetchProgramSizes(...a),
  fetchProgramVersions: (...a) => fetchProgramVersions(...a),
  fetchProgramInstallDates: (...a) => fetchProgramInstallDates(...a),
  fetchStoreApps: (...a) => fetchStoreApps(...a),
  fetchBrowserExtensions: (...a) => fetchBrowserExtensions(...a),
  fetchRunningPrograms: (...a) => fetchRunningPrograms(...a),
  fetchPackageIcons: (...a) => fetchPackageIcons(...a),
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
  fetchSettings: vi.fn(async () => ({})),
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
  setLastProgramsCount(null);
});

const goToApplications = async (user) => {
  const nav = await screen.findByRole('navigation', { name: 'Main' });
  await user.click(within(nav).getByRole('button', { name: 'Applications' }));
};

describe('deferred Applications-only reads', () => {
  it('fetches the base list, measured sizes and Store apps right away, on Dashboard', async () => {
    renderScreen(<App />);
    await waitFor(() => expect(fetchPrograms).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchProgramSizes).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchStoreApps).toHaveBeenCalledTimes(1));
  });

  it('does not fetch icons, versions, install dates, extensions or running processes while still on Dashboard', async () => {
    renderScreen(<App />);
    await waitFor(() => expect(fetchPrograms).toHaveBeenCalledTimes(1));
    // Give any wrongly-eager query a real chance to have fired.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchProgramIcons).not.toHaveBeenCalled();
    expect(fetchPackageIcons).not.toHaveBeenCalled();
    expect(fetchProgramVersions).not.toHaveBeenCalled();
    expect(fetchProgramInstallDates).not.toHaveBeenCalled();
    expect(fetchBrowserExtensions).not.toHaveBeenCalled();
    expect(fetchRunningPrograms).not.toHaveBeenCalled();
  });

  it('fetches all five once Applications is opened', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);
    await waitFor(() => expect(fetchPrograms).toHaveBeenCalledTimes(1));

    await goToApplications(user);

    await waitFor(() => expect(fetchProgramIcons).toHaveBeenCalledTimes(1));
    expect(fetchPackageIcons).toHaveBeenCalledTimes(1);
    expect(fetchProgramVersions).toHaveBeenCalledTimes(1);
    expect(fetchProgramInstallDates).toHaveBeenCalledTimes(1);
    expect(fetchBrowserExtensions).toHaveBeenCalledTimes(1);
    expect(fetchRunningPrograms).toHaveBeenCalledTimes(1);
  });

  it('keeps fetching the deferred five after leaving Applications, not just once', async () => {
    // Screens stay mounted once visited (Screen.jsx), and `visited` only
    // grows -- once true, loadDecorations must not flip back off on the
    // way back to Dashboard.
    const user = userEvent.setup();
    renderScreen(<App />);
    await waitFor(() => expect(fetchPrograms).toHaveBeenCalledTimes(1));
    await goToApplications(user);
    await waitFor(() => expect(fetchRunningPrograms).toHaveBeenCalledTimes(1));

    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('button', { name: 'Dashboard' }));

    // Still enabled: a real poll keeps running rather than having been
    // torn down by the trip back to Dashboard.
    expect(fetchRunningPrograms).toHaveBeenCalledTimes(1);
  });
});

/** Real bug, found live during this feature's own first manual check
 * (2026-10-01): an earlier version set this from ProgramList's own local
 * fetchPrograms() fallback, which only runs when ProgramList gets no
 * `programs` prop -- App.jsx always passes one (from the real
 * useProgramData() above), so that branch never ran in the shipped app
 * and the count silently stayed null forever, on every screen. Fixed by
 * setting it from App.jsx's own real `programs`/`loading` -- the same
 * values the rest of the app already uses -- instead. */
describe('the programs-found count App.jsx hands to the bug report', () => {
  it('is known within a render of the base list resolving, on Dashboard, without visiting Applications', async () => {
    fetchPrograms.mockResolvedValue(Array.from({ length: 128 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })));
    renderScreen(<App />);

    await waitFor(() => expect(getLastProgramsCount()).toBe(128));
  });

  it('reflects zero, not null, when the real machine genuinely has none', async () => {
    fetchPrograms.mockResolvedValue([]);
    renderScreen(<App />);

    await waitFor(() => expect(fetchPrograms).toHaveBeenCalled());
    await waitFor(() => expect(getLastProgramsCount()).toBe(0));
  });

  it('stays null while the list is still loading, never a stale value from a previous run', async () => {
    let resolveFetch;
    fetchPrograms.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    renderScreen(<App />);

    expect(getLastProgramsCount()).toBeNull();
    resolveFetch([{ id: 'a', name: 'A' }]);
    await waitFor(() => expect(getLastProgramsCount()).toBe(1));
  });
});
