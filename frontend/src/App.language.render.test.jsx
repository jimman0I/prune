// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from './testSupport/renderScreen.jsx';

/** App.jsx's own inline "Applications" screen, and the three
 * ModalOverlay `label`s it builds itself -- found on a final sweep after
 * every screen-level component was already translated. Two of the three
 * labels reuse an already-translated modal's own title function rather
 * than duplicating text (uninstallModal.titleNormal, batchUninstallModal.title);
 * this file is what proves that reuse actually reaches the dialog's
 * accessible name, in Greek, and is not just true of the modal's own
 * internal heading. */

const fetchSettings = vi.fn();
vi.mock('./lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async () => ({})),
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
  streamUninstall: vi.fn(async () => new Promise(() => {})),
}));

const alpha = {
  id: 'alpha', name: 'Alpha', publisher: 'Acme', sizeBytes: 1024 * 1024, source: 'registry',
  uninstallString: 'C:\\Alpha\\uninstall.exe'
};
const beta = {
  id: 'beta', name: 'Beta', publisher: 'Acme', sizeBytes: 2 * 1024 * 1024, source: 'registry',
  uninstallString: 'C:\\Beta\\uninstall.exe'
};
const gamma = { id: 'gamma', name: 'Gamma', publisher: 'Microsoft', sizeBytes: 512 * 1024, source: 'store' };

vi.mock('./hooks/usePrograms.js', () => ({
  useProgramData: () => ({
    programs: [alpha, beta, gamma], icons: {}, totalSize: alpha.sizeBytes + beta.sizeBytes + gamma.sizeBytes,
    extensions: [], running: {}, loading: false, error: null, refresh: () => {}
  })
}));

const App = (await import('./App.jsx')).default;

beforeEach(() => {
  fetchSettings.mockResolvedValue({ language: 'el' });
});

const goToApplications = async (user) => {
  const nav = await screen.findByRole('navigation', { name: 'Κύρια' });
  await user.click(within(nav).getByRole('button', { name: 'Εφαρμογές' }));
};

describe('the nav landmark in Greek', () => {
  it('translates the <nav> element\'s own aria-label, not just its buttons', async () => {
    renderScreen(<App />);
    expect(await screen.findByRole('navigation', { name: 'Κύρια' })).toBeTruthy();
  });
});

describe('the Applications screen in Greek', () => {
  it('renders the heading, summary and Quarantine button in Greek', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);

    await goToApplications(user);

    const heading = await screen.findByText('Εγκατεστημένες εφαρμογές');
    expect(heading).toBeTruthy();
    expect(screen.getByText(/3 εφαρμογές/)).toBeTruthy();
    expect(screen.getByText(/εγκατεστημένα/)).toBeTruthy();
    // Scoped past the heading, since the nav rail has its OWN "Καραντίνα"
    // button (translated in an earlier session pass) with the same name.
    const main = heading.closest('div').parentElement;
    expect(within(main).getByRole('button', { name: 'Καραντίνα' })).toBeTruthy();
  });

  it('labels the single-uninstall dialog in Greek, reusing uninstallModal.titleNormal', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);
    await goToApplications(user);
    await screen.findByText('Alpha');

    const row = screen.getByText('Alpha').closest('div[class*="grid"]');
    await user.click(within(row).getByRole('button', { name: 'Απεγκατάσταση' }));

    expect(await screen.findByRole('dialog', { name: 'Απεγκατάσταση Alpha' })).toBeTruthy();
  });

  it('labels the Store-app removal dialog in Greek with app.removeStoreApp', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);
    await goToApplications(user);
    await screen.findByText('Gamma');

    const row = screen.getByText('Gamma').closest('div[class*="grid"]');
    await user.click(within(row).getByRole('button', { name: 'Απεγκατάσταση' }));

    expect(await screen.findByRole('dialog', { name: 'Κατάργηση Gamma' })).toBeTruthy();
  });

  it('labels the batch-uninstall dialog in Greek, reusing batchUninstallModal.title', async () => {
    const user = userEvent.setup();
    renderScreen(<App />);
    await goToApplications(user);
    await screen.findByText('Alpha');

    await user.click(screen.getByRole('checkbox', { name: 'Επιλογή Alpha' }));
    await user.click(screen.getByRole('checkbox', { name: 'Επιλογή Beta' }));
    await user.click(screen.getByRole('button', { name: 'Απεγκατάσταση 2 προγραμμάτων' }));

    expect(await screen.findByRole('dialog', { name: 'Απεγκατάσταση 2 προγραμμάτων' })).toBeTruthy();
  });
});
