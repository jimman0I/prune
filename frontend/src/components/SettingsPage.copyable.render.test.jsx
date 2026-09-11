// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** What on the Settings screen can be selected and copied.
 *
 * Text selection is off across the app. What is left on here is error
 * text, because an error is what somebody pastes into a search or a bug
 * report -- and the sandbox test's output, whose details are paths. */

const fetchSettings = vi.fn();
const fetchUpdateCheck = vi.fn();
const runSandboxTest = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (partial) => partial),
  fetchUpdateCheck: (...a) => fetchUpdateCheck(...a),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  runSandboxTest: (...a) => runSandboxTest(...a),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;

const DEFAULTS = {
  excludeFolders: [],
  excludeExtensions: [],
  theme: 'dark',
  updateCheck: false,
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
  fetchUpdateCheck.mockResolvedValue({ enabled: false, current: '2.4.0' });
});

describe('what can be copied on the Settings screen', () => {
  it('the reason an update check failed', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.4.0', error: 'GitHub answered 403.' });
    renderScreen(<SettingsPage />);

    expect(isCopyable(await screen.findByText(/Couldn.t check.*GitHub answered 403/))).toBe(true);
  });

  it('what the sandbox test reported, but not the names of its steps', async () => {
    runSandboxTest.mockResolvedValue({
      passed: false,
      steps: [{
        name: 'Delete the planted file',
        passed: false,
        detail: 'EPERM: C:\\Users\\jim\\AppData\\Local\\Temp\\prune-sandbox\\a.tmp'
      }],
      error: 'The sandbox could not be cleaned up.'
    });
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Cleanup' }));
    await user.click(screen.getByRole('button', { name: 'Run Sandbox Test' }));

    expect(isCopyable(await screen.findByText(/^EPERM: C:/))).toBe(true);
    expect(isCopyable(screen.getByText('The sandbox could not be cleaned up.'))).toBe(true);
    // A step's name is a label, and labels stay as unselectable as the
    // rest of the app. Only what the step found is worth copying.
    expect(isCopyable(screen.getByText('Delete the planted file'))).toBe(false);
  });

  it('the reason a setting could not be saved', async () => {
    const { updateSettings } = await import('../lib/api.js');
    updateSettings.mockRejectedValueOnce(new Error('EPERM: settings.json is read-only'));
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);

    await user.click(await screen.findByRole('switch', { name: 'Check for updates' }));
    expect(isCopyable(await screen.findByText(/Couldn't save: EPERM/))).toBe(true);
  });

  it('the reason the download page could not be opened', async () => {
    const { openUpdatePage } = await import('../lib/api.js');
    openUpdatePage.mockRejectedValueOnce(new Error('explorer.exe was not found'));
    fetchSettings.mockResolvedValue({ ...DEFAULTS, updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({
      enabled: true, current: '2.4.0', latest: '2.4.1', newer: true,
      url: 'https://github.com/jimman0I/prune/releases/tag/v2.4.1'
    });
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Open the download page' }));
    expect(isCopyable(await screen.findByText(/Couldn't open the page: explorer\.exe/))).toBe(true);
  });
});
