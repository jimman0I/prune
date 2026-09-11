// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';
import { keys } from '../lib/queryClient.js';

/** The update button at the bottom of the side nav.
 *
 * It appears only when the (opt-in) update check has found a newer
 * release, and one click takes Prune from there to running the new
 * version: download, silent install, restart. The electron side of that
 * is tested in electron/updater.test.cjs; this file is about what the
 * button asks for and when -- above all, that nothing downloads before
 * the click unless "Install updates automatically" is on. */

const fetchSettings = vi.fn();
const fetchUpdateCheck = vi.fn();
const openUpdatePage = vi.fn(async () => ({ ok: true }));
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (partial) => partial),
  fetchUpdateCheck: (...a) => fetchUpdateCheck(...a),
  openUpdatePage: (...a) => openUpdatePage(...a)
}));

const UpdateButton = (await import('./UpdateButton.jsx')).default;

const newer = {
  enabled: true, current: '2.4.1', latest: '2.5.0', newer: true,
  url: 'https://github.com/jimman0I/prune/releases/tag/v2.5.0'
};

/** A stand-in for the bridge preload.cjs exposes. */
function fakeBridge() {
  let listener = null;
  return {
    prepare: vi.fn(async (version) => ({ version })),
    install: vi.fn(async () => {}),
    setInstallOnQuit: vi.fn(async () => {}),
    onProgress: vi.fn((callback) => { listener = callback; return () => { listener = null; }; }),
    emitProgress: (percent) => listener?.(percent)
  };
}

let bridge;
beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ updateCheck: true, autoInstallUpdates: false });
  fetchUpdateCheck.mockResolvedValue(newer);
  bridge = fakeBridge();
  window.pruneWindow = { updates: bridge };
});
afterEach(() => { delete window.pruneWindow; });

const updateButton = () => screen.findByRole('button', { name: 'Update to Prune 2.5.0' });
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('when the button is there at all', () => {
  it('appears when the check has found a newer release', async () => {
    renderScreen(<UpdateButton />);
    expect(await updateButton()).toBeTruthy();
  });

  it('never appears with the update check off', async () => {
    fetchSettings.mockResolvedValue({ updateCheck: false });
    renderScreen(<UpdateButton />);
    await settle();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never appears when there is nothing newer, or the check failed', async () => {
    for (const answer of [{ ...newer, newer: false }, { enabled: true, current: '2.4.1', error: 'offline' }]) {
      fetchUpdateCheck.mockResolvedValue(answer);
      const { unmount } = renderScreen(<UpdateButton />);
      await settle();
      expect(screen.queryByRole('button')).toBeNull();
      unmount();
    }
  });
});

describe('one click', () => {
  it('downloads the version it showed, then installs it', async () => {
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);
    await user.click(await updateButton());

    await waitFor(() => expect(bridge.install).toHaveBeenCalledTimes(1));
    expect(bridge.prepare).toHaveBeenCalledWith('2.5.0');
    expect(screen.getByText(/Restarting/)).toBeTruthy();
  });

  it('shows how far the download has got', async () => {
    let finish;
    bridge.prepare.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);
    await user.click(await updateButton());

    act(() => bridge.emitProgress(42));
    expect(await screen.findByText('42%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
    expect(bridge.install).not.toHaveBeenCalled();

    await act(async () => { finish({ version: '2.5.0' }); });
    await waitFor(() => expect(bridge.install).toHaveBeenCalledTimes(1));
  });

  it('downloads once, however many times it is clicked', async () => {
    bridge.prepare.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);
    const button = await updateButton();
    await user.dblClick(button);
    await user.click(button);
    expect(bridge.prepare).toHaveBeenCalledTimes(1);
  });

  it('says why it failed, in words that can be copied, and offers two ways on', async () => {
    bridge.prepare.mockRejectedValueOnce(new Error('GitHub is offering 2.5.1, not 2.5.0.'));
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);
    await user.click(await updateButton());

    const reason = await screen.findByText(/offering 2\.5\.1, not 2\.5\.0/);
    expect(isCopyable(reason)).toBe(true);
    expect(bridge.install).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(bridge.prepare).toHaveBeenCalledTimes(2));
  });

  it('can still send someone to the release page when it fails', async () => {
    bridge.prepare.mockRejectedValueOnce(new Error('net::ERR_CONNECTION_RESET'));
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);
    await user.click(await updateButton());

    await user.click(await screen.findByRole('button', { name: 'Open the download page' }));
    expect(openUpdatePage).toHaveBeenCalledTimes(1);
  });

  it('opens the release page instead when there is no installer to hand it to', async () => {
    // A dev build in a browser has no bridge. The release page is the
    // honest answer there, rather than a button that does nothing.
    delete window.pruneWindow;
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);
    await user.click(await updateButton());

    expect(openUpdatePage).toHaveBeenCalledTimes(1);
    expect(bridge.prepare).not.toHaveBeenCalled();
  });
});

describe('Install updates automatically', () => {
  it('downloads nothing before the click while it is off', async () => {
    renderScreen(<UpdateButton />);
    await updateButton();
    await settle();
    expect(bridge.prepare).not.toHaveBeenCalled();
    expect(bridge.setInstallOnQuit).not.toHaveBeenCalledWith(true);
  });

  it('downloads by itself when on, and installs when Prune next closes', async () => {
    fetchSettings.mockResolvedValue({ updateCheck: true, autoInstallUpdates: true });
    renderScreen(<UpdateButton />);

    await waitFor(() => expect(bridge.prepare).toHaveBeenCalledWith('2.5.0'));
    await waitFor(() => expect(bridge.setInstallOnQuit).toHaveBeenCalledWith(true));
    // Downloaded is not installed: nothing restarts under the user.
    expect(bridge.install).not.toHaveBeenCalled();
  });

  it('turns the button into a restart once it is downloaded', async () => {
    fetchSettings.mockResolvedValue({ updateCheck: true, autoInstallUpdates: true });
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);

    await user.click(await screen.findByRole('button', { name: 'Restart to update to Prune 2.5.0' }));
    expect(bridge.install).toHaveBeenCalledTimes(1);
    // It is already on disk: the restart installs it, it does not fetch it
    // again first.
    expect(bridge.prepare).toHaveBeenCalledTimes(1);
  });

  it('stops a downloaded update installing on quit when it is turned off', async () => {
    // Downloaded in the background while the setting was on, then the
    // user changed their mind. Closing Prune must not install it anyway.
    fetchSettings.mockResolvedValue({ updateCheck: true, autoInstallUpdates: true });
    const { client } = renderScreen(<UpdateButton />);
    await waitFor(() => expect(bridge.setInstallOnQuit).toHaveBeenCalledWith(true));

    act(() => { client.setQueryData(keys.settings, { updateCheck: true, autoInstallUpdates: false }); });
    await waitFor(() => expect(bridge.setInstallOnQuit).toHaveBeenLastCalledWith(false));
  });
});
