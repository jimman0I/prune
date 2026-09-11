// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The pop-up tile that says a newer release exists.
 *
 * Only with the update check on -- the tile is a way of showing the
 * check's answer, never a reason to make one. And once dismissed, that
 * version is not offered again: a tile that comes back on every launch
 * teaches people to close it without reading. */

const fetchSettings = vi.fn();
const updateSettings = vi.fn(async (partial) => partial);
const fetchUpdateCheck = vi.fn();
const openUpdatePage = vi.fn(async () => ({ ok: true }));
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchUpdateCheck: (...a) => fetchUpdateCheck(...a),
  openUpdatePage: (...a) => openUpdatePage(...a)
}));

const UpdateTile = (await import('./UpdateTile.jsx')).default;

const newer = { enabled: true, current: '2.3.4', latest: '2.4.1', newer: true, url: 'https://github.com/jimman0I/prune/releases/tag/v2.4.1' };

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ updateCheck: true, dismissedUpdateVersion: null });
  fetchUpdateCheck.mockResolvedValue(newer);
});

const tile = () => screen.queryByRole('region', { name: 'Update available' });

describe('the update tile', () => {
  it('appears when the check has found a newer release', async () => {
    renderScreen(<UpdateTile />);
    await waitFor(() => expect(tile()).toBeTruthy());
    expect(screen.getByText(/Prune 2\.4\.1 is available/)).toBeTruthy();
    expect(screen.getByText(/you have 2\.3\.4/i)).toBeTruthy();
  });

  it('opens the download page from Download', async () => {
    const user = userEvent.setup();
    renderScreen(<UpdateTile />);
    await user.click(await screen.findByRole('button', { name: 'Download' }));
    expect(openUpdatePage).toHaveBeenCalledTimes(1);
  });

  it('remembers a dismissal for that version, and goes away', async () => {
    const user = userEvent.setup();
    renderScreen(<UpdateTile />);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    // The first argument is what was saved; react-query adds its own
    // context as a second one, which is not part of the contract.
    expect(updateSettings.mock.calls.at(-1)[0]).toEqual({ dismissedUpdateVersion: '2.4.1' });
    await waitFor(() => expect(tile()).toBeNull());
  });

  it('stays hidden for a version already dismissed', async () => {
    fetchSettings.mockResolvedValue({ updateCheck: true, dismissedUpdateVersion: '2.4.1' });
    renderScreen(<UpdateTile />);
    await waitFor(() => expect(fetchUpdateCheck).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(tile()).toBeNull();
  });

  it('comes back for a newer version than the one dismissed', async () => {
    fetchSettings.mockResolvedValue({ updateCheck: true, dismissedUpdateVersion: '2.4.0' });
    renderScreen(<UpdateTile />);
    await waitFor(() => expect(tile()).toBeTruthy());
  });

  it('never appears with the update check off, whatever the answer', async () => {
    fetchSettings.mockResolvedValue({ updateCheck: false });
    renderScreen(<UpdateTile />);
    await new Promise((r) => setTimeout(r, 50));
    expect(tile()).toBeNull();
  });

  it('never appears when there is nothing newer, or the check failed', async () => {
    for (const answer of [{ ...newer, newer: false }, { enabled: true, current: '2.3.4', error: 'offline' }]) {
      fetchUpdateCheck.mockResolvedValue(answer);
      const { unmount } = renderScreen(<UpdateTile />);
      await new Promise((r) => setTimeout(r, 50));
      expect(tile()).toBeNull();
      unmount();
    }
  });
});
