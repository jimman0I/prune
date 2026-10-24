// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes, setSizeUnits } from '../lib/formatBytes.js';

/** Settings, General: how sizes are written, everywhere, the moment it changes. */

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
  quarantineMaxSizeGb: 5, cookieKeepList: [], updateCheck: false, lowDiskWarning: 10,
  deepCleanRemoval: 'quarantine', sizeUnits: 'windows',
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

/** Any screen that prints a size, standing in for all of them. */
function SizeProbe() {
  useLanguage();
  return <p data-testid="probe">{formatBytes(1.5 * 1024 ** 3)}</p>;
}

const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];
const theSelect = () => screen.findByRole('combobox', { name: 'Size units' });
const openTab = async (user, name) => user.click(await screen.findByRole('tab', { name }));

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
});
afterEach(() => {
  window.localStorage.clear();
  setSizeUnits('windows');
});

describe('Size units', () => {
  it('is in General, on the File Explorer way by default, with the three ways to choose from', async () => {
    renderScreen(<SettingsPage />);
    const select = await theSelect();
    expect(select.value).toBe('windows');
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Like File Explorer (KB, MB · 1024)', 'Binary (KiB, MiB · 1024)', 'Decimal (KB, MB · 1000)'
    ]);
    expect(screen.getByText(/a 1 TB drive shows as 931 GB in Windows/)).toBeTruthy();
  });

  it('saves the choice', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.selectOptions(await theSelect(), 'decimal');
    await waitFor(() => expect(lastSaved()).toEqual({ sizeUnits: 'decimal' }));
  });

  it('reads a missing or unknown value as the default', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, sizeUnits: 'metric' });
    renderScreen(<SettingsPage />);
    expect((await theSelect()).value).toBe('windows');
  });

  it('changes every size on screen at once, without a restart', async () => {
    const user = userEvent.setup();
    renderScreen(<><SettingsPage /><SizeProbe /></>);
    await theSelect();
    expect(screen.getByTestId('probe').textContent).toBe('1.5 GB');
    await user.selectOptions(await theSelect(), 'binary');
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('1.5 GiB'));
    await user.selectOptions(await theSelect(), 'decimal');
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('1.6 GB'));
  });

  it('opens in the saved units, remembered for the first paint before settings answer', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, sizeUnits: 'binary' });
    renderScreen(<SizeProbe />);
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('1.5 GiB'));
    expect(window.localStorage.getItem('prune.sizeUnits')).toBe('binary');
  });

  it('labels the quarantine cap GiB whenever GB would mean something else, since the cap stays 1024-based', async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen(<SettingsPage />);
    // The tab is remembered, so the renders below open on Cleanup too.
    await openTab(user, 'Cleanup');
    expect(await screen.findByText('GB')).toBeTruthy();
    unmount();
    for (const sizeUnits of ['binary', 'decimal']) {
      fetchSettings.mockResolvedValue({ ...DEFAULTS, sizeUnits });
      const view = renderScreen(<SettingsPage />);
      expect(await screen.findByText('GiB')).toBeTruthy();
      expect(screen.queryByText('GB')).toBeNull();
      view.unmount();
    }
  });
});
