// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings, Cleanup: the exclusions panel takes folders, file types and, now,
 * registry keys (Revo's RegExclude list), from one field, each kept in its own
 * list and each with its own badge. */

const fetchSettings = vi.fn();
const updateSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchAutoScans: vi.fn(async () => ({ scans: [], count: 0, bytes: 0 })),
  deleteAutoScans: vi.fn(),
  fetchRunAsAdmin: vi.fn(async () => ({ supported: true, enabled: false, elevatedNow: false, startsWithWindows: false })),
  setRunAsAdmin: vi.fn(),
  fetchMftStatus: vi.fn(async () => ({ elevated: false })),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '3.0.0' })),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  fetchCustomCleaners: vi.fn(async () => ({ locations: [], imported: [] })),
  fetchCookieDomains: vi.fn(async () => ({ domains: [], errors: [] })),
  runSandboxTest: vi.fn()
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;
const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];
const BASE = { theme: 'dark', updateCheck: false, language: 'en', excludeFolders: [], excludeExtensions: [], excludeRegistryKeys: [] };
const FIELD = 'Folder path, file type or registry key to exclude';

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...BASE });
  updateSettings.mockImplementation(async (partial) => ({ ...BASE, ...partial }));
});

async function openPanel(user) {
  renderScreen(<SettingsPage />);
  await user.click(await screen.findByRole('tab', { name: /cleanup/i }));
  return screen.findByLabelText(FIELD);
}

describe('Settings: exclusions', () => {
  it('says all three kinds are accepted', async () => {
    const user = userEvent.setup();
    const field = await openPanel(user);
    expect(field.getAttribute('placeholder')).toMatch(/HKCU\\Software\\Vendor/);
    expect(screen.getByText(/registry key such as HKCU\\Software\\Vendor/)).toBeTruthy();
  });

  it('files a registry key under excludeRegistryKeys, not the folder or type lists', async () => {
    const user = userEvent.setup();
    const field = await openPanel(user);
    await user.type(field, 'HKCU:\\Software\\Vendor{Enter}');
    await waitFor(() => expect(lastSaved()).toEqual({ excludeRegistryKeys: ['HKCU\\Software\\Vendor'] }));
  });

  it('still files a folder and a file type where they always went', async () => {
    const user = userEvent.setup();
    const field = await openPanel(user);
    await user.type(field, 'D:\\Games{Enter}');
    await waitFor(() => expect(lastSaved()).toEqual({ excludeFolders: ['D:\\Games'] }));
    await user.type(field, '*.iso{Enter}');
    await waitFor(() => expect(lastSaved()).toEqual({ excludeExtensions: ['.iso'] }));
  });

  it('lists a saved registry key with a Registry badge, and removes it from the right list', async () => {
    const seeded = { ...BASE, excludeFolders: ['D:\\Games'], excludeRegistryKeys: ['HKCU\\Software\\Vendor'] };
    fetchSettings.mockResolvedValue(seeded);
    updateSettings.mockImplementation(async (partial) => ({ ...seeded, ...partial }));
    const user = userEvent.setup();
    await openPanel(user);
    const row = (await screen.findByText('HKCU\\Software\\Vendor')).closest('div.flex.items-center.justify-between');
    expect(within(row).getByText('Registry')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Stop excluding HKCU\\Software\\Vendor' }));
    await waitFor(() => expect(lastSaved()).toEqual({ excludeRegistryKeys: [] }));
    // the folder is untouched
    expect(screen.getByText('D:\\Games')).toBeTruthy();
  });

  it('refuses a bare hive with the message that says the three formats', async () => {
    const user = userEvent.setup();
    const field = await openPanel(user);
    await user.type(field, 'HKCU{Enter}');
    expect(await screen.findByText(/registry key \(HKCU\\Software\\Vendor\)/)).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
