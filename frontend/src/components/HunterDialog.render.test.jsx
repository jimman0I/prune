// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { startHunt: vi.fn(), cancelHunt: vi.fn(), endHuntedProcess: vi.fn(), revealInExplorer: vi.fn(), setStartupItemEnabled: vi.fn(), fetchSettings: vi.fn() };
vi.mock('../lib/api.js', () => ({
  startHunt: (...a) => api.startHunt(...a),
  cancelHunt: (...a) => api.cancelHunt(...a),
  endHuntedProcess: (...a) => api.endHuntedProcess(...a),
  revealInExplorer: (...a) => api.revealInExplorer(...a),
  setStartupItemEnabled: (...a) => api.setStartupItemEnabled(...a),
  fetchSettings: (...a) => api.fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p)
}));

const HunterDialog = (await import('./HunterDialog.jsx')).default;

const program = { id: 'thing', name: 'Thing', installLocation: 'D:\\Apps\\Thing' };
const picked = (extra = {}) => ({
  status: 'picked', pid: 4321, exePath: 'D:\\Apps\\Thing\\thing.exe', name: 'thing.exe', title: 'Thing - main',
  program, startupItems: [], endRefusal: null, ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.cancelHunt.mockResolvedValue({ cancelled: true });
});

const hunt = async (result, props = {}) => {
  api.startHunt.mockResolvedValue(result);
  const user = userEvent.setup();
  const handlers = { onClose: vi.fn(), onUninstall: vi.fn(), onForced: vi.fn() };
  renderScreen(<HunterDialog programs={[program]} {...handlers} {...props} />);
  await user.click(screen.getByRole('button', { name: 'Start hunting' }));
  return { user, ...handlers };
};

describe('Hunter', () => {
  it('explains what it will do before it does it', () => {
    renderScreen(<HunterDialog onClose={vi.fn()} />);
    expect(screen.getByText(/catches the click so nothing in that window is pressed/)).toBeTruthy();
    expect(api.startHunt).not.toHaveBeenCalled();
  });

  it('names the program the clicked window belongs to, and offers to uninstall it', async () => {
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

  it('says so when nothing was clicked, and can hunt again', async () => {
    const { user } = await hunt({ status: 'timeout' });
    expect(await screen.findByText('Nothing was clicked in 30 seconds.')).toBeTruthy();
    api.startHunt.mockResolvedValue(picked());
    await user.click(screen.getByRole('button', { name: 'Hunt again' }));
    expect(await screen.findByText(/belongs to the installed program/)).toBeTruthy();
  });

  it('says when the hunt was cancelled and when it could not run', async () => {
    await hunt({ status: 'cancelled' });
    expect(await screen.findByText('Hunt cancelled.')).toBeTruthy();
  });

  it('reports a hunt that could not run, and returns to the start', async () => {
    api.startHunt.mockRejectedValue(new Error('A hunt is already running.'));
    const user = userEvent.setup();
    renderScreen(<HunterDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start hunting' }));
    expect(await screen.findByText(/The hunt couldn.t run: A hunt is already running/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start hunting' })).toBeTruthy());
  });
});
