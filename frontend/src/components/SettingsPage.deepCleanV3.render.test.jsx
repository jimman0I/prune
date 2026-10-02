// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Deep Clean settings added for the BleachBit-parity track, reached
 * the way a person reaches them: Settings, then the Cleanup tab. */

const updateSettings = vi.fn(async (partial) => partial);
const fetchSettings = vi.fn();

vi.mock('../lib/api.js', () => ({
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
  quarantineMaxSizeGb: null, cookieKeepList: [], updateCheck: false,
  deepCleanRemoval: 'quarantine',
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

async function openCleanupTab() {
  const user = userEvent.setup();
  renderScreen(<SettingsPage />);
  await user.click(await screen.findByRole('tab', { name: 'Cleanup' }));
  return user;
}
const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
});

describe('Overwrite files before deleting', () => {
  const theSwitch = () => screen.findByRole('switch', { name: 'Overwrite files before deleting' });

  it('is off by default and saves when switched on', async () => {
    const user = await openCleanupTab();
    expect((await theSwitch()).getAttribute('aria-checked')).toBe('false');
    await user.click(await theSwitch());
    await waitFor(() => expect(lastSaved()).toEqual({ overwriteBeforeDelete: true }));
  });

  it('says plainly that it is not reliable on SSDs, and does not apply to Quarantine', async () => {
    await openCleanupTab();
    await theSwitch();
    expect(screen.getByText(/not reliable on SSDs/)).toBeTruthy();
    expect(screen.getByText(/does not apply to Quarantine or the Recycle Bin/)).toBeTruthy();
  });

  it('offers the passes only while it is on, and saves the choice', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, overwriteBeforeDelete: false });
    await openCleanupTab();
    await theSwitch();
    expect(screen.queryByRole('radiogroup', { name: 'Overwrite passes' })).toBeNull();
  });

  it('shows 1 pass selected, then saves 3 passes', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, overwriteBeforeDelete: true, overwritePasses: 1 });
    const user = await openCleanupTab();
    const group = await screen.findByRole('radiogroup', { name: 'Overwrite passes' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: /1 pass/ }).checked).toBe(true);
    await user.click(screen.getByRole('radio', { name: /3 passes/ }));
    await waitFor(() => expect(lastSaved()).toEqual({ overwritePasses: 3 }));
  });
});

describe('Delete locked files on next restart, from the Deep Clean settings', () => {
  it('is the same setting the uninstall tab uses, off by default', async () => {
    const user = await openCleanupTab();
    const toggle = await screen.findByRole('switch', { name: 'Delete locked files on next restart' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.click(toggle);
    await waitFor(() => expect(lastSaved()).toEqual({ deleteLockedFilesOnRestart: true }));
  });
});
