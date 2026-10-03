// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { fetchRunAsAdmin: vi.fn(), setRunAsAdmin: vi.fn(), fetchMftStatus: vi.fn(), fetchSettings: vi.fn() };
vi.mock('../lib/api.js', () => ({
  fetchRunAsAdmin: (...a) => api.fetchRunAsAdmin(...a),
  setRunAsAdmin: (...a) => api.setRunAsAdmin(...a),
  fetchMftStatus: (...a) => api.fetchMftStatus(...a),
  fetchSettings: (...a) => api.fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p)
}));

const adminBridge = { canRestartAsAdmin: vi.fn(), restartAsAdmin: vi.fn() };
vi.mock('../lib/adminRelaunch.js', () => ({
  canRestartAsAdmin: (...a) => adminBridge.canRestartAsAdmin(...a),
  restartAsAdmin: (...a) => adminBridge.restartAsAdmin(...a)
}));

const RunAsAdminSetting = (await import('./RunAsAdminSetting.jsx')).default;

const state = (over = {}) => ({ supported: true, enabled: false, elevatedNow: false, startsWithWindows: false, ...over });
const toggle = () => screen.findByRole('switch', { name: 'Always run as administrator' });

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.fetchMftStatus.mockResolvedValue({ elevated: false });
  adminBridge.canRestartAsAdmin.mockResolvedValue(true);
  adminBridge.restartAsAdmin.mockResolvedValue({ ok: true });
});

describe('Settings: Always run as administrator', () => {
  it('is off by default, and says honestly what it costs before anyone turns it on', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state());
    renderScreen(<RunAsAdminSetting />);
    const sw = await toggle();
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
    expect(screen.getByText(/Windows asks for your approval every time Prune starts/)).toBeTruthy();
    expect(screen.getByText(/can't receive files dragged from a normal Explorer window/)).toBeTruthy();
    expect(screen.getByText(/can't start silently when you sign in/)).toBeTruthy();
    expect(screen.getByText(/mistake can reach protected files/)).toBeTruthy();
    expect(api.setRunAsAdmin).not.toHaveBeenCalled();
  });

  it('turns it on, and says it takes effect from the next start, with a way to apply it now', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state());
    api.setRunAsAdmin.mockResolvedValue(state({ enabled: true }));
    const user = userEvent.setup();
    renderScreen(<RunAsAdminSetting />);
    const sw = await toggle();
    await waitFor(() => expect(sw.disabled).toBe(false));
    await user.click(sw);
    expect(api.setRunAsAdmin).toHaveBeenCalledWith(true);
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    expect(await screen.findByText('Takes effect the next time Prune starts.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Restart Prune as administrator' }));
    expect(adminBridge.restartAsAdmin).toHaveBeenCalledTimes(1);
  });

  it('offers no restart where the desktop app cannot relaunch itself', async () => {
    adminBridge.canRestartAsAdmin.mockResolvedValue(false);
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true }));
    renderScreen(<RunAsAdminSetting />);
    expect(await screen.findByText('Takes effect the next time Prune starts.')).toBeTruthy();
    await waitFor(() => expect(adminBridge.canRestartAsAdmin).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Restart Prune as administrator' })).toBeNull();
  });

  it('turns it off', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true }));
    api.setRunAsAdmin.mockResolvedValue(state({ enabled: false }));
    const user = userEvent.setup();
    renderScreen(<RunAsAdminSetting />);
    const sw = await toggle();
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    await user.click(sw);
    expect(api.setRunAsAdmin).toHaveBeenCalledWith(false);
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
  });

  it('says Prune is running as administrator now, and does not offer a restart', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true, elevatedNow: true }));
    api.fetchMftStatus.mockResolvedValue({ elevated: true });
    renderScreen(<RunAsAdminSetting />);
    expect(await screen.findByText('Prune is running as administrator now.')).toBeTruthy();
    expect(screen.queryByText('Takes effect the next time Prune starts.')).toBeNull();
    await waitFor(() => expect(api.fetchMftStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Restart Prune as administrator' })).toBeNull();
  });

  it('says turning it off takes effect from the next start when Prune is elevated now', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: false, elevatedNow: true }));
    renderScreen(<RunAsAdminSetting />);
    expect(await screen.findByText('Prune is running as administrator now.')).toBeTruthy();
    expect(screen.getByText('Takes effect the next time Prune starts.')).toBeTruthy();
  });

  it('is disabled, off and explained where it cannot be set (a development build)', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ supported: false }));
    renderScreen(<RunAsAdminSetting />);
    expect(await screen.findByText(/Available in the installed Prune app/)).toBeTruthy();
    const sw = await toggle();
    expect(sw.disabled).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('warns when Prune is set to start with Windows, since an administrator app is not started silently', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true, startsWithWindows: true }));
    renderScreen(<RunAsAdminSetting />);
    const warning = await screen.findByText(/set to start with Windows/);
    expect(warning.textContent).toMatch(/asks for approval every time, or doesn't start/);
    expect(warning.textContent).toMatch(/“Startup”/);
  });

  it('does not warn about startup when it is off, or when Prune does not start with Windows', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: false, startsWithWindows: true }));
    const { unmount } = renderScreen(<RunAsAdminSetting />);
    await toggle();
    await waitFor(() => expect(api.fetchRunAsAdmin).toHaveBeenCalled());
    expect(screen.queryByText(/set to start with Windows/)).toBeNull();
    unmount();
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true, startsWithWindows: false }));
    renderScreen(<RunAsAdminSetting />);
    await screen.findByText('Takes effect the next time Prune starts.');
    expect(screen.queryByText(/set to start with Windows/)).toBeNull();
  });

  it('leaves the choice to the person: the warning has no button that changes startup', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true, startsWithWindows: true }));
    renderScreen(<RunAsAdminSetting />);
    await screen.findByText(/set to start with Windows/);
    expect(screen.queryByRole('button', { name: /startup/i })).toBeNull();
  });

  it('says so when the setting cannot be read', async () => {
    api.fetchRunAsAdmin.mockRejectedValue(new Error('reg.exe timed out'));
    renderScreen(<RunAsAdminSetting />);
    expect(await screen.findByText(/Couldn't read this setting: reg.exe timed out/)).toBeTruthy();
    expect((await toggle()).disabled).toBe(true);
  });

  it('says why a change failed, and the switch stays where Windows has it', async () => {
    api.fetchRunAsAdmin.mockResolvedValue(state());
    api.setRunAsAdmin.mockRejectedValue(new Error('ERROR: Access is denied.'));
    const user = userEvent.setup();
    renderScreen(<RunAsAdminSetting />);
    const sw = await toggle();
    await waitFor(() => expect(sw.disabled).toBe(false));
    await user.click(sw);
    expect(await screen.findByText(/Couldn't change this setting: ERROR: Access is denied/)).toBeTruthy();
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('shows a declined restart as an answer, not an error', async () => {
    adminBridge.restartAsAdmin.mockResolvedValue({ ok: false, cancelled: true });
    api.fetchRunAsAdmin.mockResolvedValue(state({ enabled: true }));
    const user = userEvent.setup();
    renderScreen(<RunAsAdminSetting />);
    await user.click(await screen.findByRole('button', { name: 'Restart Prune as administrator' }));
    expect(await screen.findByText(/Not approved/)).toBeTruthy();
  });
});
