// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { endHuntedProcess: vi.fn(), revealInExplorer: vi.fn(), setStartupItemEnabled: vi.fn(), fetchSettings: vi.fn(), fetchMftStatus: vi.fn() };
vi.mock('../lib/api.js', () => ({
  endHuntedProcess: (...a) => api.endHuntedProcess(...a),
  revealInExplorer: (...a) => api.revealInExplorer(...a),
  setStartupItemEnabled: (...a) => api.setStartupItemEnabled(...a),
  fetchSettings: (...a) => api.fetchSettings(...a),
  fetchMftStatus: (...a) => api.fetchMftStatus(...a),
  updateSettings: vi.fn(async (p) => p)
}));

// The crosshair lives in the desktop app; here it is a bridge we drive by hand.
const bridge = { start: vi.fn(), cancel: vi.fn(), listeners: [] };
vi.mock('../lib/hunterBridge.js', () => ({
  startHunter: (...a) => bridge.start(...a),
  cancelHunter: (...a) => bridge.cancel(...a),
  onHunterResult: (cb) => { bridge.listeners.push(cb); return () => { bridge.listeners = bridge.listeners.filter((l) => l !== cb); }; }
}));

const adminBridge = { canRestartAsAdmin: vi.fn(), restartAsAdmin: vi.fn() };
vi.mock('../lib/adminRelaunch.js', () => ({
  canRestartAsAdmin: (...a) => adminBridge.canRestartAsAdmin(...a),
  restartAsAdmin: (...a) => adminBridge.restartAsAdmin(...a)
}));

const HunterDialog = (await import('./HunterDialog.jsx')).default;

const program = { id: 'thing', name: 'Thing', installLocation: 'D:\\Apps\\Thing' };
const picked = (extra = {}) => ({
  status: 'picked', pid: 4321, exePath: 'D:\\Apps\\Thing\\thing.exe', name: 'thing.exe', title: 'Thing - main',
  program, startupItems: [], endRefusal: null, ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  bridge.listeners = [];
  bridge.start.mockResolvedValue({ ok: true });
  bridge.cancel.mockResolvedValue({ ok: true, cancelled: true });
  api.fetchSettings.mockResolvedValue({});
  api.fetchMftStatus.mockResolvedValue({ elevated: false });
  adminBridge.canRestartAsAdmin.mockResolvedValue(true);
  adminBridge.restartAsAdmin.mockResolvedValue({ ok: true });
});

/** The crosshair reports back: what the main process sends once it was dropped. */
const dropped = (result) => act(async () => { bridge.listeners.forEach((cb) => cb(result)); });

const hunt = async (result, props = {}) => {
  const user = userEvent.setup();
  const handlers = { onClose: vi.fn(), onUninstall: vi.fn(), onForced: vi.fn() };
  renderScreen(<HunterDialog programs={[program]} {...handlers} {...props} />);
  await user.click(screen.getByRole('button', { name: 'Start hunting' }));
  await screen.findByText(/Drag the crosshair onto any window/);
  if (result) await dropped(result);
  return { user, ...handlers };
};

describe('Hunter: starting', () => {
  it('explains the drag before it opens anything', () => {
    renderScreen(<HunterDialog onClose={vi.fn()} />);
    expect(screen.getByText(/crosshair/i)).toBeTruthy();
    expect(screen.queryByText(/catches the click/)).toBeNull();
    expect(bridge.start).not.toHaveBeenCalled();
  });

  it('opens the crosshair with its two labels, in the current language, and waits for the drop', async () => {
    await hunt();
    expect(bridge.start).toHaveBeenCalledWith({ hint: 'Drag onto a window', cancel: 'Cancel' });
    expect(screen.getByRole('status').textContent).toMatch(/Drag the crosshair onto any window/);
    expect(screen.getByRole('button', { name: 'Cancel hunt' })).toBeTruthy();
  });

  it('cannot be closed while the crosshair is out', async () => {
    await hunt();
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true);
  });

  it('says Hunter needs the desktop app when there is no crosshair to open', async () => {
    bridge.start.mockResolvedValue({ ok: false, unsupported: true });
    const user = userEvent.setup();
    renderScreen(<HunterDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start hunting' }));
    expect(await screen.findByText(/desktop app/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start hunting' })).toBeTruthy();
  });

  it('reports a crosshair that could not open, and returns to the start', async () => {
    bridge.start.mockResolvedValue({ ok: false, error: 'Prune\'s window is not available.' });
    const user = userEvent.setup();
    renderScreen(<HunterDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start hunting' }));
    expect(await screen.findByText(/The hunt couldn.t run: Prune.s window is not available/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start hunting' })).toBeTruthy());
  });
});

describe('Hunter: the result of a drop', () => {
  it('names the program the window belongs to, and offers to uninstall it', async () => {
    const { user, onUninstall } = await hunt(picked());
    expect(await screen.findByText('This window belongs to the installed program Thing.')).toBeTruthy();
    expect(screen.getByText('D:\\Apps\\Thing\\thing.exe')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Uninstall' }));
    expect(onUninstall).toHaveBeenCalledWith(program);
  });

  it('hands a forced uninstall the name and the folder', async () => {
    const { user, onForced } = await hunt(picked());
    await user.click(await screen.findByRole('button', { name: 'Forced uninstall…' }));
    expect(onForced).toHaveBeenCalledWith({ name: 'Thing', folder: 'D:\\Apps\\Thing' });
  });

  it('for a window that is no installed program, offers the forced uninstall on its folder and no Uninstall', async () => {
    const { user, onForced } = await hunt(picked({ program: null }));
    expect(await screen.findByText(/not in your installed programs list/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Forced uninstall…' }));
    expect(onForced).toHaveBeenCalledWith({ name: '', folder: 'D:\\Apps\\Thing' });
  });

  it('turns off a startup entry that launches it', async () => {
    api.setStartupItemEnabled.mockResolvedValue({ ok: true });
    const { user } = await hunt(picked({ startupItems: [{ id: 'run:1', name: 'Thing Tray', enabled: true }] }));
    await user.click(await screen.findByRole('button', { name: 'Stop Thing Tray starting with Windows' }));
    expect(api.setStartupItemEnabled).toHaveBeenCalledWith('run:1', false);
    expect(await screen.findByText('Thing Tray will no longer start with Windows.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Stop Thing Tray/ })).toBeNull();
  });

  it('offers no startup button for an entry that is already off', async () => {
    await hunt(picked({ startupItems: [{ id: 'run:1', name: 'Thing Tray', enabled: false }] }));
    await screen.findByText(/belongs to the installed program/);
    expect(screen.queryByRole('button', { name: /starting with Windows/ })).toBeNull();
  });

  it('asks before ending the process, and ends it only when confirmed', async () => {
    api.endHuntedProcess.mockResolvedValue({ ok: true });
    const { user } = await hunt(picked());
    await user.click(await screen.findByRole('button', { name: 'End process' }));
    expect(api.endHuntedProcess).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved work in it will be lost.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'End it now' }));
    expect(api.endHuntedProcess).toHaveBeenCalledWith(4321, 'D:\\Apps\\Thing\\thing.exe');
    expect(await screen.findByText('thing.exe was ended.')).toBeTruthy();
  });

  it('can change its mind about ending it', async () => {
    const { user } = await hunt(picked());
    await user.click(await screen.findByRole('button', { name: 'End process' }));
    await user.click(screen.getByRole('button', { name: 'Keep it running' }));
    expect(api.endHuntedProcess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'End process' })).toBeTruthy();
  });

  it('says why a process could not be ended', async () => {
    api.endHuntedProcess.mockResolvedValue({ ok: false, error: 'That process is no longer running.' });
    const { user } = await hunt(picked());
    await user.click(await screen.findByRole('button', { name: 'End process' }));
    await user.click(screen.getByRole('button', { name: 'End it now' }));
    expect(await screen.findByText(/no longer running/)).toBeTruthy();
  });

  it('does not offer to end a process the backend refuses', async () => {
    await hunt(picked({ endRefusal: 'That is part of Windows.' }));
    await screen.findByText(/belongs to the installed program/);
    expect(screen.queryByRole('button', { name: 'End process' })).toBeNull();
  });

  it('offers nothing to act on when the window was Prune itself', async () => {
    await hunt(picked({ program: null, endRefusal: 'That is Prune itself.' }));
    expect(await screen.findByText('That is Prune itself.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End process' })).toBeNull();
  });

  it('opens the program\'s folder', async () => {
    api.revealInExplorer.mockResolvedValue({ ok: true });
    const { user } = await hunt(picked());
    await user.click(await screen.findByRole('button', { name: 'Open folder' }));
    expect(api.revealInExplorer).toHaveBeenCalledWith('D:\\Apps\\Thing\\thing.exe');
  });
});

describe('Hunter: when nothing useful was picked', () => {
  it('says so when the crosshair was dropped on the desktop or the taskbar, and can hunt again', async () => {
    const { user } = await hunt({ status: 'nothing' });
    expect(await screen.findByText(/Nothing to identify there/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Hunt again' }));
    await dropped(picked());
    expect(await screen.findByText(/belongs to the installed program/)).toBeTruthy();
    expect(bridge.start).toHaveBeenCalledTimes(2);
  });

  it('says when the crosshair was cancelled with Esc or its cross', async () => {
    await hunt({ status: 'cancelled' });
    expect(await screen.findByText('Hunt cancelled.')).toBeTruthy();
  });

  it('says when the lookup failed', async () => {
    await hunt({ status: 'failed', error: 'ECONNREFUSED' });
    expect(await screen.findByText(/Couldn.t tell which window that was/)).toBeTruthy();
  });

  it('explains a window it could not read and offers to restart as administrator', async () => {
    adminBridge.restartAsAdmin.mockResolvedValue({ ok: true });
    const { user } = await hunt({ status: 'unreadable', pid: 900, name: null });
    expect((await screen.findByRole('status')).textContent).toMatch(/runs as administrator/);
    const restart = await screen.findByRole('button', { name: 'Restart Prune as administrator' });
    await user.click(restart);
    expect(adminBridge.restartAsAdmin).toHaveBeenCalledTimes(1);
  });

  it('does not offer the restart when Prune already runs as administrator', async () => {
    api.fetchMftStatus.mockResolvedValue({ elevated: true });
    await hunt({ status: 'unreadable', pid: 900, name: null });
    expect((await screen.findByRole('status')).textContent).toMatch(/runs as administrator/);
    await waitFor(() => expect(api.fetchMftStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Restart Prune as administrator' })).toBeNull();
  });
});

describe('Hunter: cancelling and leaving', () => {
  it('Cancel hunt closes the crosshair through the main process and shows the cancel', async () => {
    const { user } = await hunt();
    await user.click(screen.getByRole('button', { name: 'Cancel hunt' }));
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Hunt cancelled.')).toBeTruthy();
  });

  it('closing the dialog while the crosshair is out puts the crosshair away', async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen(<HunterDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start hunting' }));
    await screen.findByText(/Drag the crosshair onto any window/);
    unmount();
    expect(bridge.cancel).toHaveBeenCalledTimes(1);
  });

  it('leaving without ever starting does not touch the crosshair', () => {
    const { unmount } = renderScreen(<HunterDialog onClose={vi.fn()} />);
    unmount();
    expect(bridge.cancel).not.toHaveBeenCalled();
  });

  it('stops listening for results once it is gone', () => {
    const { unmount } = renderScreen(<HunterDialog onClose={vi.fn()} />);
    expect(bridge.listeners).toHaveLength(1);
    unmount();
    expect(bridge.listeners).toHaveLength(0);
  });
});
