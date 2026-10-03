// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings -> General -> "Add Prune to the right-click menu".
 *
 * An opt-in that adds menu entries to File Explorer, so what is held still is
 * that the switch is off until pressed, that it shows the entries Windows has
 * (not a copy), that the backend is only ever sent one boolean, that it is off
 * with an honest reason where it cannot work, and that the sentence names the
 * two entries exactly as the registry holds them. */

const fetchExplorerMenu = vi.fn();
const setExplorerMenu = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchExplorerMenu: (...a) => fetchExplorerMenu(...a),
  setExplorerMenu: (...a) => setExplorerMenu(...a)
}));

const ExplorerMenuSetting = (await import('./ExplorerMenuSetting.jsx')).default;

const CAPTIONS = { shred: 'Shred with Prune', find: 'Find in Prune (uninstall)' };
const state = (over = {}) => ({ supported: true, enabled: false, incomplete: false, stale: false, foreign: false, captions: CAPTIONS, ...over });
const TITLE = 'Add Prune to the right-click menu';
const render = () => renderScreen(<ExplorerMenuSetting />);

beforeEach(() => {
  vi.clearAllMocks();
  fetchExplorerMenu.mockResolvedValue(state());
});

describe('the switch', () => {
  it('is off by default, and nothing is written', async () => {
    render();
    const toggle = await screen.findByRole('switch', { name: TITLE });
    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(setExplorerMenu).not.toHaveBeenCalled();
  });

  it('names both entries exactly as the registry holds them, and says it needs no administrator rights', async () => {
    render();
    expect(await screen.findByText(/Adds "Shred with Prune" to files and folders, and "Find in Prune \(uninstall\)" to programs and shortcuts/)).toBeTruthy();
    expect(screen.getByText(/needs no administrator rights/)).toBeTruthy();
    expect(screen.getByText(/Turning this off removes every entry/)).toBeTruthy();
  });

  it('uses the captions the backend says are in use, in the app\'s language', async () => {
    fetchExplorerMenu.mockResolvedValue(state({ captions: { shred: 'Mit Prune schreddern', find: 'In Prune suchen (deinstallieren)' } }));
    render();
    expect(await screen.findByText(/"Mit Prune schreddern"/)).toBeTruthy();
    expect(screen.getByText(/"In Prune suchen \(deinstallieren\)"/)).toBeTruthy();
  });

  it('turning it on sends only one boolean, then shows what Windows says', async () => {
    setExplorerMenu.mockResolvedValue(state({ enabled: true }));
    render();
    const toggle = await screen.findByRole('switch', { name: TITLE });
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    await waitFor(() => expect(setExplorerMenu).toHaveBeenCalledWith(true));
    expect(setExplorerMenu.mock.calls[0]).toEqual([true]);
    await waitFor(() => expect(screen.getByRole('switch', { name: TITLE }).getAttribute('aria-checked')).toBe('true'));
  });

  it('shows existing entries as on, and turning it off sends false', async () => {
    fetchExplorerMenu.mockResolvedValue(state({ enabled: true }));
    setExplorerMenu.mockResolvedValue(state());
    render();
    const toggle = await screen.findByRole('switch', { name: TITLE });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(toggle);
    await waitFor(() => expect(setExplorerMenu).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.getByRole('switch', { name: TITLE }).getAttribute('aria-checked')).toBe('false'));
  });

  it('says where the entries are on Windows 11', async () => {
    render();
    expect(await screen.findByText(/On Windows 11, the entries are under "Show more options"/)).toBeTruthy();
  });
});

describe('when it cannot be done', () => {
  it('is off and disabled, with the reason, in a development build', async () => {
    fetchExplorerMenu.mockResolvedValue(state({ supported: false, reason: 'notPackaged' }));
    render();
    expect(await screen.findByText("Available in the installed Prune app. This copy can't set it.")).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: TITLE });
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('gives its own reason when the install folder\'s name cannot be used in a menu entry', async () => {
    fetchExplorerMenu.mockResolvedValue(state({ supported: false, reason: 'unsafePath' }));
    render();
    expect(await screen.findByText(/folder name has a character that can't be used in a menu entry/)).toBeTruthy();
    expect(screen.queryByText(/Available in the installed Prune app/)).toBeNull();
    expect(screen.getByRole('switch', { name: TITLE }).disabled).toBe(true);
  });

  it('says what went wrong when Windows refuses the write, and leaves the switch where it was', async () => {
    setExplorerMenu.mockRejectedValue(new Error('ERROR: Access is denied.'));
    render();
    const toggle = await screen.findByRole('switch', { name: TITLE });
    await waitFor(() => expect(toggle.disabled).toBe(false));
    fireEvent.click(toggle);
    expect(await screen.findByText(/Couldn't change this setting: ERROR: Access is denied\./)).toBeTruthy();
    expect(screen.getByRole('switch', { name: TITLE }).getAttribute('aria-checked')).toBe('false');
  });

  it('says when the registry cannot be read, and disables the switch', async () => {
    fetchExplorerMenu.mockRejectedValue(new Error('reg.exe timed out'));
    render();
    expect(await screen.findByText(/Couldn't read this setting: reg\.exe timed out/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: TITLE }).disabled).toBe(true);
  });

  it('says so when some of the entries are missing', async () => {
    fetchExplorerMenu.mockResolvedValue(state({ enabled: true, incomplete: true }));
    render();
    expect(await screen.findByText(/Some of Prune's menu entries are missing/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: TITLE }).getAttribute('aria-checked')).toBe('true');
  });

  it('says so when a menu entry that is not Prune\'s already has one of the names', async () => {
    fetchExplorerMenu.mockResolvedValue(state({ foreign: true }));
    render();
    expect(await screen.findByText(/A menu entry that isn't Prune's already has one of these names/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: TITLE }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('the markup', () => {
  it('has no native hover text', async () => {
    const { container } = render();
    await screen.findByRole('switch', { name: TITLE });
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
