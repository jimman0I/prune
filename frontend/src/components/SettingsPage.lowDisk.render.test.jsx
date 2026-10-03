// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings, General: the low-disk warning is a small select. */

const updateSettings = vi.fn(async (partial) => partial);
const fetchSettings = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchCustomCleaners: vi.fn(async () => ({ locations: [], imported: [] })),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '3.0.0' })),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  runSandboxTest: vi.fn(),
  fetchCookieDomains: vi.fn(async () => ({ domains: [], errors: [] }))
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;

const DEFAULTS = {
  excludeFolders: [], excludeExtensions: [], autoQuarantine: true, theme: 'dark',
  skipRecentHours: 24, hideUnavailableRules: false, quarantineRetentionDays: null,
  quarantineMaxSizeGb: null, cookieKeepList: [], updateCheck: false, lowDiskWarning: 10,
  deepCleanRemoval: 'quarantine',
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
});

describe('Low disk space warning', () => {
  const theSelect = () => screen.findByRole('combobox', { name: 'Low disk space warning' });

  it('is in General, set to 10% by default, with Off and 5 / 10 / 15% to choose from', async () => {
    renderScreen(<SettingsPage />);
    const select = await theSelect();
    expect(select.value).toBe('10');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Off', '5%', '10%', '15%']);
  });

  it('explains what it does, including that drives with lots of room are never flagged', async () => {
    renderScreen(<SettingsPage />);
    await theSelect();
    expect(screen.getByText(/Warns on the Dashboard/)).toBeTruthy();
    expect(screen.getByText(/more than 100 GB free are never flagged/)).toBeTruthy();
  });

  it('saves the share as a number', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.selectOptions(await theSelect(), '15');
    await waitFor(() => expect(lastSaved()).toEqual({ lowDiskWarning: 15 }));
  });

  it('saves Off as 0', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.selectOptions(await theSelect(), '0');
    await waitFor(() => expect(lastSaved()).toEqual({ lowDiskWarning: 0 }));
  });

  it('shows what was saved earlier', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, lowDiskWarning: 5 });
    renderScreen(<SettingsPage />);
    expect((await theSelect()).value).toBe('5');
  });

  it('shows 10% for a settings file from before the warning existed', async () => {
    const { lowDiskWarning, ...old } = DEFAULTS;
    void lowDiskWarning;
    fetchSettings.mockResolvedValue(old);
    renderScreen(<SettingsPage />);
    expect((await theSelect()).value).toBe('10');
  });
});
