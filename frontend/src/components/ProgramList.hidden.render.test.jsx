// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Hiding programs from the Applications list: the row menu's Hide from list,
 * the hiddenPrograms setting it saves, Show hidden (N) with its badge and
 * Unhide, and the guarantee that a batch never reaches a program nobody can
 * see. The settings API is mocked as a tiny store, so what is saved is what
 * the next render reads. */

let stored = {};
vi.mock('../lib/api.js', () => ({
  fetchInstallTraces: vi.fn(async () => []),
  fetchSettings: vi.fn(async () => stored),
  updateSettings: vi.fn(async (partial) => { stored = { ...stored, ...partial }; return stored; }),
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(),
  openInstalledAppsSettings: vi.fn(),
  deleteInstallTrace: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;
const ToastHost = (await import('./ToastHost.jsx')).default;
const { updateSettings } = await import('../lib/api.js');

const KEY = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\';
const toolbar = { id: 'tb', name: 'Search Toolbar', publisher: 'Ads Inc', uninstallString: 'u.exe', sizeBytes: 3 * 1024 ** 2, registryKey: `${KEY}Toolbar` };
const editor = { id: 'ed', name: 'Text Editor', publisher: 'Writer', uninstallString: 'u.exe', sizeBytes: 5 * 1024 ** 2, registryKey: `${KEY}Editor` };
const driver = { id: 'dr', name: 'Printer Driver', publisher: 'Print Co', uninstallString: 'u.exe', sizeBytes: 1024 ** 2, registryKey: `${KEY}Driver` };
const hiddenKey = (program) => `reg:${program.registryKey.toLowerCase()}`;

const render = (props = {}) => renderScreen(<><ProgramList programs={[toolbar, editor, driver]} {...props} /><ToastHost /></>);
// The partial each save sent (TanStack passes the mutation's own context second).
const lastSave = () => updateSettings.mock.calls.at(-1)?.[0];
const openMenu = (name) => fireEvent.contextMenu(screen.getByRole('row', { name: new RegExp(name) }));

beforeEach(() => {
  stored = {};
  vi.clearAllMocks();
});

describe('hiding a program', () => {
  it('takes it out of the rows and saves its stable key, with Undo on the toast', async () => {
    // The toast layer is pointer-events:none around its cards, as in the app.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render();
    await screen.findByRole('row', { name: /Search Toolbar/ });

    openMenu('Search Toolbar');
    await user.click(screen.getByRole('menuitem', { name: 'Hide from list' }));

    expect(lastSave()).toEqual({ hiddenPrograms: [hiddenKey(toolbar)] });
    await waitFor(() => expect(screen.queryByRole('row', { name: /Search Toolbar/ })).toBeNull());
    expect(await screen.findByText('Search Toolbar is hidden from the list.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('row', { name: /Search Toolbar/ })).toBeTruthy();
    expect(stored.hiddenPrograms).toEqual([]);
  });

  it('narrows the footer and its total the way a filter does', async () => {
    stored = { hiddenPrograms: [hiddenKey(toolbar)] };
    render();
    // The rows can render before the settings arrive; the hidden one goes then.
    await waitFor(() => expect(screen.queryByRole('row', { name: /Search Toolbar/ })).toBeNull());
    expect(screen.getByRole('row', { name: /Text Editor/ })).toBeTruthy();
    expect(screen.getByText('Showing 2 of 3')).toBeTruthy();
    expect(screen.getByText(/^6 MB/)).toBeTruthy();
  });

  it('Show hidden (N) brings them back, badged, with Unhide in their menu', async () => {
    stored = { hiddenPrograms: [hiddenKey(toolbar)] };
    const user = userEvent.setup();
    render();

    const toggle = await screen.findByRole('button', { name: 'Show hidden (1)' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    const row = screen.getByRole('row', { name: /Search Toolbar/ });
    expect(within(row).getByText('Hidden')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Text Editor/ })).queryByText('Hidden')).toBeNull();

    openMenu('Search Toolbar');
    expect(screen.queryByRole('menuitem', { name: 'Hide from list' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Unhide' }));
    expect(lastSave()).toEqual({ hiddenPrograms: [] });
    // Nothing hidden is left, so the toggle goes and the row is an ordinary one.
    await waitFor(() => expect(screen.queryByRole('button', { name: /Show hidden/ })).toBeNull());
    expect(within(screen.getByRole('row', { name: /Search Toolbar/ })).queryByText('Hidden')).toBeNull();
  });

  it('offers no toggle while nothing is hidden', async () => {
    render();
    await screen.findByRole('row', { name: /Text Editor/ });
    expect(screen.queryByRole('button', { name: /Show hidden/ })).toBeNull();
  });

  it('says so, and offers the way back, when everything in view is hidden', async () => {
    stored = { hiddenPrograms: [toolbar, editor, driver].map(hiddenKey) };
    const user = userEvent.setup();
    render();
    expect(await screen.findByText('Everything here is hidden from the list.')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Show hidden (3)' });
    await user.click(buttons[buttons.length - 1]);
    expect(screen.getByRole('row', { name: /Printer Driver/ })).toBeTruthy();
  });
});

describe('batches never reach a hidden program', () => {
  it('Select all skips hidden rows, even while they are shown', async () => {
    stored = { hiddenPrograms: [hiddenKey(toolbar)] };
    const onBatchUninstall = vi.fn();
    const user = userEvent.setup();
    render({ onBatchUninstall });

    await user.click(await screen.findByRole('button', { name: 'Show hidden (1)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown' }));
    await user.click(screen.getByRole('button', { name: /Uninstall 2/ }));
    expect(onBatchUninstall.mock.calls[0][0].map((p) => p.id).sort()).toEqual(['dr', 'ed']);
  });

  it('hiding a ticked program unticks it', async () => {
    const onBatchUninstall = vi.fn();
    const user = userEvent.setup();
    render({ onBatchUninstall });

    await user.click(await screen.findByRole('checkbox', { name: /Search Toolbar/ }));
    await user.click(screen.getByRole('checkbox', { name: /Text Editor/ }));
    openMenu('Search Toolbar');
    await user.click(screen.getByRole('menuitem', { name: 'Hide from list' }));
    await waitFor(() => expect(screen.queryByRole('row', { name: /Search Toolbar/ })).toBeNull());

    // Shown again, it is not ticked: nothing kept a selection nobody could see.
    await user.click(screen.getByRole('button', { name: 'Show hidden (1)' }));
    expect(screen.getByRole('checkbox', { name: /Search Toolbar/ }).getAttribute('aria-checked')).toBe('false');
    await user.click(screen.getByRole('button', { name: /Uninstall 1/ }));
    expect(onBatchUninstall.mock.calls[0][0].map((p) => p.id)).toEqual(['ed']);
  });
});
