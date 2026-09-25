// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { renderScreen } from './testSupport/renderScreen.jsx';

/** The "Report a bug" rail item through the real App: it opens the dialog
 * and is an action, not a screen.
 *
 * Screens are stubbed to nothing -- what is measured is which rail item is
 * current (`aria-current`) after the chord, which is App's whole part in it
 * (matching is shortcutMatch.test.js, the id lookup is
 * useKeyboardShortcuts.test.js). */

const stub = (name) => () => <div>{name} screen</div>;
vi.mock('./components/Dashboard.jsx', () => ({ default: stub('dashboard') }));
vi.mock('./components/DiskMap.jsx', () => ({ default: stub('diskmap') }));
vi.mock('./components/QuarantineManager.jsx', () => ({ default: stub('quarantine') }));
vi.mock('./components/StartupItems.jsx', () => ({ default: stub('startup') }));
vi.mock('./components/SettingsPage.jsx', () => ({ default: stub('settings') }));
vi.mock('./components/DeepClean.jsx', () => ({ default: stub('deepclean') }));
vi.mock('./components/Duplicates.jsx', () => ({ default: stub('duplicates') }));
vi.mock('./components/ProgramList.jsx', () => ({ default: stub('programlist') }));

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
  fetchBugReportInfo: vi.fn(async () => ({ version: '2.8.0', windows: 'Windows_NT 10', arch: 'x64' })),
  openBugReport: vi.fn(async () => ({ ok: true })),
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
  streamDeepCleanExecute: vi.fn(async () => ({})),
  fetchDiskHealth: vi.fn(async () => ({})),
  unlockDiskWear: vi.fn(async () => ({})),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  // useIdlePrefetch warms this on a 1.2 s timer; a slow run reaches it.
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
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

vi.mock('./hooks/usePrograms.js', () => ({
  useProgramData: () => ({
    programs: [], icons: {}, totalSize: 0, extensions: [], running: {},
    loading: false, error: null, refresh: () => {}
  })
}));

const App = (await import('./App.jsx')).default;

const rail = () => within(screen.getByRole('navigation', { name: 'Main' }));

describe('the Report a bug rail item', () => {
  it('opens the report dialog, and Escape closes it', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(rail().getByRole('button', { name: 'Report a bug' }));
    expect(screen.getByRole('dialog', { name: 'Report a bug' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is an action: it never becomes the current screen', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);
    const item = rail().getByRole('button', { name: 'Report a bug' });
    await user.click(item);
    expect(item.getAttribute('aria-current')).toBeNull();
    expect(item.getAttribute('aria-keyshortcuts')).toBeNull();
    expect(rail().getByRole('button', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
  });
});
