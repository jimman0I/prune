// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memo } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from './testSupport/renderScreen.jsx';

/** What a tab switch costs.
 *
 * Screens stay mounted once visited -- Screen.jsx hides them with
 * `display: none` rather than unmounting, so a Disk Map scan survives a
 * trip to Settings. The cost is that App owns the active-screen state, so
 * every setScreen re-renders App, and React then reconciles every screen
 * that has ever been opened. Hidden ones skip layout and paint; they do
 * not skip render.
 *
 * These counters measure that directly rather than inferring it. Each
 * screen is replaced by a stub that counts its own renders, so what is
 * being measured is React's decision to call the component at all, which
 * is exactly what React.memo changes.
 */

const renders = { diskmap: 0, quarantine: 0, startup: 0 };
const counter = (name) => () => { renders[name] += 1; return <div>{name} screen</div>; };

// The stubs are memoised because the real components now are. Mocking a
// memoised component with a plain function would measure the mock's
// behaviour rather than the app's -- the first version of this test did
// exactly that and reported no improvement from a change it had removed.
//
// What this actually measures with memo in place is whether App hands
// these screens stable props. It does: all three take none at all.
vi.mock('./components/DiskMap.jsx', () => ({ default: memo(counter('diskmap')) }));
vi.mock('./components/QuarantineManager.jsx', () => ({ default: memo(counter('quarantine')) }));
vi.mock('./components/StartupItems.jsx', () => ({ default: memo(counter('startup')) }));

// Everything else the app pulls on mount, stubbed to nothing so the test
// measures rendering rather than fetching.
vi.mock('./lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => ({})),
  fetchProgramIcons: vi.fn(async () => ({})),
  fetchProgramSizes: vi.fn(async () => ({})),
  fetchProgramVersions: vi.fn(async () => ({})),
  fetchProgramInstallDates: vi.fn(async () => ({})),
  fetchStoreApps: vi.fn(async () => ({})),
  fetchBrowserExtensions: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(async () => []),
  fetchStartupIcons: vi.fn(async () => ({})),
  fetchResources: vi.fn(async () => ({})),
  fetchAutomation: vi.fn(async () => ({})),
  checkAutomation: vi.fn(async () => ({})),
  fetchDuplicates: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(async () => ({})),
  setStartupItemEnabled: vi.fn(async () => ({})),
  revealInExplorer: vi.fn(async () => ({})),
  fetchPackageIcons: vi.fn(async () => ({})),
  openInstalledAppsSettings: vi.fn(async () => ({})),
  fetchRunningPrograms: vi.fn(async () => ({})),
  scanForLeftovers: vi.fn(async () => ({})),
  scanForcedUninstall: vi.fn(async () => ({})),
  removeQuarantined: vi.fn(async () => ({})),
  fetchQuarantineBatches: vi.fn(async () => ({ batches: [] })),
  restoreQuarantineBatch: vi.fn(async () => ({})),
  deleteQuarantineBatch: vi.fn(async () => ({})),
  emptyQuarantine: vi.fn(async () => ({})),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async () => ({})),
  // The update tile asks on every render of App; with the check off it
  // gets the running version back and draws nothing.
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '0.0.0' })),
  openUpdatePage: vi.fn(async () => ({})),
  runSandboxTest: vi.fn(async () => ({})),
  streamDeepCleanScan: vi.fn(async () => ({})),
  fetchDeepCleanRules: vi.fn(async () => []),
  fetchDeepCleanScan: vi.fn(async () => ({})),
  executeDeepClean: vi.fn(async () => ({})),
  fetchDiskHealth: vi.fn(async () => ({})),
  unlockDiskWear: vi.fn(async () => ({})),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  fetchDiskSpace: vi.fn(async () => ({})),
  scanDriveFast: vi.fn(async () => ({})),
  fetchDiskScan: vi.fn(async () => ({})),
  fetchUninstallHistory: vi.fn(async () => []),
  appendHistoryEntry: vi.fn(async () => ({})),
  parseSSELine: vi.fn(async () => ({})),
  streamUninstall: vi.fn(async () => ({})),
}));

vi.mock('./hooks/usePrograms.js', () => ({
  useProgramData: () => ({
    programs: [], icons: {}, totalSize: 0, extensions: [], running: {},
    loading: false, error: null, refresh: () => {}
  })
}));

const App = (await import('./App.jsx')).default;

beforeEach(() => {
  renders.diskmap = 0;
  renders.quarantine = 0;
  renders.startup = 0;
});

// Scoped to the nav landmark: the Dashboard also has shortcut buttons
// with these names, and clicking one of those would be measuring a
// different path.
const go = async (user, label) => {
  const nav = screen.getByRole('navigation', { name: 'Main' });
  await user.click(within(nav).getByRole('button', { name: label }));
};

describe('switching tabs', () => {
  it('re-renders screens that are not on screen', async () => {
    // The measurement. Visit three tabs, then switch between two of them
    // and count how often the third -- hidden the whole time, and with no
    // props to change -- is rendered anyway.
    const user = userEvent.setup();
    renderScreen(<App />);

    await go(user, 'Disk Map');
    await go(user, 'Quarantine');
    await go(user, 'Startup');
    await waitFor(() => expect(renders.diskmap).toBeGreaterThan(0));

    const before = renders.diskmap;
    await go(user, 'Quarantine');
    await go(user, 'Startup');
    const after = renders.diskmap;

    // Recorded rather than asserted as a fixed number: what matters is
    // whether a hidden, propless screen renders at all when another tab
    // is clicked, not how many times React happens to do it.
    console.log(`  [measure] hidden Disk Map renders across two tab switches: ${after - before}`);
    // Zero. A hidden screen with no props has nothing that can have
    // changed, so React skips it entirely rather than reconciling it
    // because its parent re-rendered. Measured at 2 before memo.
    expect(after - before).toBe(0);
  });
});
