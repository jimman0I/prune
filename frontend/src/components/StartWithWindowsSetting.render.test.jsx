// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings -> General -> "Start Prune when I sign in to Windows".
 *
 * An opt-in that writes a sign-in entry, so what is held still is that both
 * switches are off until pressed, that they show the entry Windows has (not a
 * copy), that the backend is only ever sent booleans, that it is off with a
 * reason where it cannot work, and that the clash with "Always run as
 * administrator" is a warning and not a decision. */

const fetchStartWithWindows = vi.fn();
const setStartWithWindows = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStartWithWindows: (...a) => fetchStartWithWindows(...a),
  setStartWithWindows: (...a) => setStartWithWindows(...a)
}));

const StartWithWindowsSetting = (await import('./StartWithWindowsSetting.jsx')).default;

const state = (over = {}) => ({ supported: true, enabled: false, minimized: false, stale: false, foreign: false, disabledByWindows: false, runAsAdmin: false, ...over });
const MAIN = 'Start Prune when I sign in to Windows';
const SUB = 'Start minimized to the tray';
const render = () => renderScreen(<StartWithWindowsSetting />);

beforeEach(() => {
  vi.clearAllMocks();
  fetchStartWithWindows.mockResolvedValue(state());
});

describe('the switches', () => {
  it('are off by default, the sub-option unavailable, and nothing is written', async () => {
    render();
    const main = await screen.findByRole('switch', { name: MAIN });
    await waitFor(() => expect(main.disabled).toBe(false));
    expect(main.getAttribute('aria-checked')).toBe('false');
    const sub = screen.getByRole('switch', { name: SUB });
    expect(sub.getAttribute('aria-checked')).toBe('false');
    expect(sub.disabled).toBe(true);
    expect(screen.getByText(/for your account only and with no administrator rights/)).toBeTruthy();
    expect(setStartWithWindows).not.toHaveBeenCalled();
  });

  it('turning it on sends only booleans, starting minimised, then shows what Windows says', async () => {
    setStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: true }));
    render();
    const main = await screen.findByRole('switch', { name: MAIN });
    await waitFor(() => expect(main.disabled).toBe(false));
    fireEvent.click(main);
    await waitFor(() => expect(setStartWithWindows).toHaveBeenCalledWith({ enabled: true, minimized: true }));
    await waitFor(() => expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByRole('switch', { name: SUB }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: SUB }).disabled).toBe(false);
  });

  it('shows an existing entry as on, and turning it off sends enabled false', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: true }));
    setStartWithWindows.mockResolvedValue(state());
    render();
    const main = await screen.findByRole('switch', { name: MAIN });
    await waitFor(() => expect(main.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(main);
    await waitFor(() => expect(setStartWithWindows).toHaveBeenCalledWith({ enabled: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('false'));
  });

  it('the sub-option changes only the minimised choice and keeps it on', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: true }));
    setStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: false }));
    render();
    const sub = await screen.findByRole('switch', { name: SUB });
    await waitFor(() => expect(sub.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(sub);
    await waitFor(() => expect(setStartWithWindows).toHaveBeenCalledWith({ enabled: true, minimized: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: SUB }).getAttribute('aria-checked')).toBe('false'));
    expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('true');
  });

  it('says where a minimised start goes, depending on the tray setting', async () => {
    render();
    expect(await screen.findByText(/Goes to the system tray when Minimize to tray is on, and to the taskbar when it is off\./)).toBeTruthy();
  });
});

describe('when it cannot be done', () => {
  it('is off and disabled, with the reason, in a development build', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ supported: false }));
    render();
    expect(await screen.findByText("Available in the installed Prune app. This copy can't set it.")).toBeTruthy();
    expect(screen.getByRole('switch', { name: MAIN }).disabled).toBe(true);
    expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: SUB }).disabled).toBe(true);
  });

  it('says what went wrong when Windows refuses the write', async () => {
    setStartWithWindows.mockRejectedValue(new Error('ERROR: Access is denied.'));
    render();
    const main = await screen.findByRole('switch', { name: MAIN });
    await waitFor(() => expect(main.disabled).toBe(false));
    fireEvent.click(main);
    expect(await screen.findByText(/Couldn't change this setting: ERROR: Access is denied\./)).toBeTruthy();
    expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('false');
  });

  it('says when the registry cannot be read, and leaves the switch off', async () => {
    fetchStartWithWindows.mockRejectedValue(new Error('reg.exe timed out'));
    render();
    expect(await screen.findByText(/Couldn't read this setting: reg\.exe timed out/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: MAIN }).disabled).toBe(true);
  });

  it('says so when Task Manager has switched the entry off', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ disabledByWindows: true }));
    render();
    expect(await screen.findByText(/Windows has Prune's startup entry switched off/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('false');
  });

  it('says so when a different entry already has the name', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ foreign: true }));
    render();
    expect(await screen.findByText(/A different entry named Prune is already in your sign-in list/)).toBeTruthy();
  });
});

describe('the clash with Always run as administrator', () => {
  const CLASH = /Windows won't start such a program silently when you sign in/;

  it('is a warning next to the switch when both are on, and changes nothing by itself', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: true, runAsAdmin: true }));
    render();
    expect(await screen.findByText(CLASH)).toBeTruthy();
    expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('true');
    expect(setStartWithWindows).not.toHaveBeenCalled();
  });

  it('is not shown when only one of the two is on', async () => {
    fetchStartWithWindows.mockResolvedValue(state({ enabled: true, runAsAdmin: false }));
    const first = render();
    await screen.findByRole('switch', { name: MAIN });
    await waitFor(() => expect(screen.getByRole('switch', { name: MAIN }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByText(CLASH)).toBeNull();
    first.unmount();
    fetchStartWithWindows.mockResolvedValue(state({ enabled: false, runAsAdmin: true }));
    render();
    await screen.findByRole('switch', { name: MAIN });
    await waitFor(() => expect(fetchStartWithWindows).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(CLASH)).toBeNull();
  });
});

describe('the markup', () => {
  it('has no native hover text', async () => {
    const { container } = render();
    await screen.findByRole('switch', { name: MAIN });
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
