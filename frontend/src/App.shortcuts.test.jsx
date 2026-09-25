// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderScreen } from './testSupport/renderScreen.jsx';
import { SCREEN_ORDER } from './lib/screenOrder.js';

/** Ctrl+1 to Ctrl+8 through the real App: the shortcut reaches the rail.
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
const current = () => rail().getAllByRole('button').find((b) => b.getAttribute('aria-current') === 'page')?.getAttribute('aria-label');
const press = (key, target = document.body, init = {}) => fireEvent.keyDown(target, { key, ctrlKey: true, ...init });

const LABEL_BY_ID = {
  dashboard: 'Dashboard', diskmap: 'Disk Map', applications: 'Applications', quarantine: 'Quarantine',
  startup: 'Startup', duplicates: 'Duplicates', deepclean: 'Deep Clean', settings: 'Settings'
};

describe('Ctrl+1 to Ctrl+8', () => {
  it('open the screens in rail order, all the way to Settings', () => {
    renderScreen(<App />);
    expect(current()).toBe('Dashboard');
    SCREEN_ORDER.forEach((id, index) => {
      press(String(index + 1));
      expect(current()).toBe(LABEL_BY_ID[id]);
    });
  });

  it('are ignored while typing in a field', () => {
    renderScreen(<App />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('3', input);
    input.remove();
    expect(current()).toBe('Dashboard');
  });

  it('do not navigate behind an open dialog', () => {
    renderScreen(<App />);
    press('/');
    expect(screen.getByRole('dialog')).toBeTruthy();
    press('4');
    expect(current()).toBe('Dashboard');
  });

  it('leave Ctrl+comma opening Settings', () => {
    renderScreen(<App />);
    press(',');
    expect(current()).toBe('Settings');
  });
});
