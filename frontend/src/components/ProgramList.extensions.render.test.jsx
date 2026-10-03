// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { fetchExtensionPageAddress: vi.fn(), fetchInstallTraces: vi.fn(), fetchSettings: vi.fn() };
vi.mock('../lib/api.js', () => ({
  fetchExtensionPageAddress: (...a) => api.fetchExtensionPageAddress(...a),
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
const ADDRESS = `chrome://extensions/?id=${'a'.repeat(32)}`;
const BUTTON = 'Copy page address for Dark Reader';

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.fetchInstallTraces.mockResolvedValue([]);
  api.fetchExtensionPageAddress.mockResolvedValue({ ok: true, browser: 'Chrome', address: ADDRESS });
});
afterEach(() => { delete document.execCommand; });

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
// userEvent.setup() installs its own clipboard, so the spy goes on after it.
const setup = () => {
  const user = userEvent.setup();
  return { user, writeText: vi.spyOn(navigator.clipboard, 'writeText') };
};

describe('browser extensions in Applications', () => {
  it('copies the extension page address, and says where to paste it and that Prune cannot remove it itself', async () => {
    const { user, writeText } = setup();
    show();
    const row = await openExtensions(user);
    const button = within(row).getByRole('button', { name: BUTTON });
    expect(button.textContent).toBe('Copy page address');
    expect(button.hasAttribute('title')).toBe(false);
    await user.click(button);
    expect(api.fetchExtensionPageAddress).toHaveBeenCalledWith(extension.id);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ADDRESS));
    expect(await screen.findByText(/Paste it into Chrome.s address bar/)).toBeTruthy();
    expect(screen.getByText(/Prune can.t remove an extension itself/)).toBeTruthy();
  });

  it('has no Manage button any more', async () => {
    const { user } = setup();
    show();
    const row = await openExtensions(user);
    expect(within(row).queryByRole('button', { name: /Manage/ })).toBeNull();
  });

  it('reports a page address that could not be worked out', async () => {
    api.fetchExtensionPageAddress.mockRejectedValue(new Error('That extension is no longer installed.'));
    const { user, writeText } = setup();
    show();
    const row = await openExtensions(user);
    await user.click(within(row).getByRole('button', { name: BUTTON }));
    expect(await screen.findByText(/Couldn.t copy the page address/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/no longer installed/)).toBeTruthy());
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to a selected hidden field when the clipboard API refuses', async () => {
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = vi.fn(() => true);
    show();
    const row = await openExtensions(user);
    await user.click(within(row).getByRole('button', { name: BUTTON }));
    expect(await screen.findByText(/Paste it into Chrome.s address bar/)).toBeTruthy();
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('shows the address so it can be typed when every way of copying fails', async () => {
    const { user, writeText } = setup();
    writeText.mockRejectedValue(new Error('denied'));
    document.execCommand = vi.fn(() => { throw new Error('nope'); });
    show();
    const row = await openExtensions(user);
    await user.click(within(row).getByRole('button', { name: BUTTON }));
    expect(await screen.findByText(/Couldn.t copy the page address/)).toBeTruthy();
    expect(screen.getByText(ADDRESS)).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('still says the extension is removed via the browser, and has no Uninstall button', async () => {
    const { user } = setup();
    show();
    const row = await openExtensions(user);
    expect(within(row).getByText('via browser')).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Uninstall' })).toBeNull();
  });
});
