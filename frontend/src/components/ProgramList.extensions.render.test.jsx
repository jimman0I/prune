// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { manageBrowserExtension: vi.fn(), fetchInstallTraces: vi.fn(), fetchSettings: vi.fn() };
vi.mock('../lib/api.js', () => ({
  manageBrowserExtension: (...a) => api.manageBrowserExtension(...a),
  fetchInstallTraces: (...a) => api.fetchInstallTraces(...a),
  fetchSettings: (...a) => api.fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p),
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(),
  openInstalledAppsSettings: vi.fn(),
  deleteInstallTrace: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;

const extension = {
  id: 'extension:chrome:Default:' + 'a'.repeat(32), name: 'Dark Reader', publisher: '', version: '1.0', source: 'extension',
  browser: 'Chrome', sizeBytes: 1024, installLocation: 'C:\\x'
};

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.fetchInstallTraces.mockResolvedValue([]);
});

const ToastHost = (await import('./ToastHost.jsx')).default;
const show = () => renderScreen(
  <>
    <ToastHost />
    <ProgramList programs={[]} extensions={[extension]} onUninstall={vi.fn()} />
  </>
);
const openExtensions = async (user) => {
  await user.click(await screen.findByRole('button', { name: /Extensions/ }));
  return screen.findByRole('row', { name: /Dark Reader/ });
};

describe('browser extensions in Applications', () => {
  it('offers Manage, which opens the extension in its browser, and says Prune cannot remove it itself', async () => {
    api.manageBrowserExtension.mockResolvedValue({ ok: true, browser: 'Chrome' });
    const user = userEvent.setup();
    show();
    const row = await openExtensions(user);
    await user.click(within(row).getByRole('button', { name: 'Manage Dark Reader in its browser' }));
    expect(api.manageBrowserExtension).toHaveBeenCalledWith(extension.id);
    expect(await screen.findByText(/Prune can.t remove an extension itself; remove it there/)).toBeTruthy();
  });

  it('reports a browser that could not be opened', async () => {
    api.manageBrowserExtension.mockRejectedValue(new Error('Prune could not find Chrome on this PC.'));
    const user = userEvent.setup();
    show();
    const row = await openExtensions(user);
    await user.click(within(row).getByRole('button', { name: 'Manage Dark Reader in its browser' }));
    expect(await screen.findByText(/Couldn.t open the browser.s extensions page/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/could not find Chrome/)).toBeTruthy());
  });

  it('still says the extension is removed via the browser, and has no Uninstall button', async () => {
    const user = userEvent.setup();
    show();
    const row = await openExtensions(user);
    expect(within(row).getByText('via browser')).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Uninstall' })).toBeNull();
  });
});
