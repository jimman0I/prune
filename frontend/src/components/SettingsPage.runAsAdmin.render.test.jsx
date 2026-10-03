// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Where the switch lives: Settings, General -- and only there. */

const fetchSettings = vi.fn();
const fetchRunAsAdmin = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p),
  fetchRunAsAdmin: (...a) => fetchRunAsAdmin(...a),
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

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ theme: 'dark', updateCheck: false, language: 'en', excludeFolders: [], excludeExtensions: [] });
  fetchRunAsAdmin.mockResolvedValue({ supported: true, enabled: false, elevatedNow: false, startsWithWindows: false });
});

describe('Settings: General tab', () => {
  it('has the Always run as administrator switch, off, with its costs listed', async () => {
    renderScreen(<SettingsPage />);
    const sw = await screen.findByRole('switch', { name: 'Always run as administrator' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    const panel = sw.closest('.glass-panel');
    expect(within(panel).getByText('What it costs')).toBeTruthy();
  });

  it('is not on the other tabs', async () => {
    window.localStorage.setItem('prune.settingsTab', 'cleanup');
    renderScreen(<SettingsPage />);
    await screen.findByRole('tab', { name: 'Cleanup' });
    expect(screen.queryByRole('switch', { name: 'Always run as administrator' })).toBeNull();
  });
});
