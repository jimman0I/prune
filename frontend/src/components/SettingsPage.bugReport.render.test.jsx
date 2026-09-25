// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings > About has a "Report a bug" row that opens the same dialog the
 * rail does. The dialog belongs to App; the row only calls the handler it is
 * given. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({ updateCheck: false })),
  updateSettings: vi.fn(async (p) => p),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '2.3.4' })),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  runSandboxTest: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn(),
  fetchCookieDomains: vi.fn(async () => ({ domains: [], errors: [] }))
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;

describe('Settings > About', () => {
  it('has a Report a bug row whose button calls the handler', async () => {
    window.localStorage.clear();
    const onReportBug = vi.fn();
    const user = userEvent.setup();
    renderScreen(<SettingsPage onReportBug={onReportBug} />);

    await user.click(await screen.findByRole('tab', { name: 'About' }));
    await user.click(screen.getByRole('button', { name: 'Report a bug' }));
    expect(onReportBug).toHaveBeenCalledTimes(1);
  });
});
