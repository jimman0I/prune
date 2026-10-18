// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Chocolatey packages, unregistered folders and Windows' own features and
 * updates in Applications: where each is listed, and what its button does. */

vi.mock('../lib/api.js', () => ({
  fetchInstallTraces: vi.fn(async () => []),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (p) => p),
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(),
  openInstalledAppsSettings: vi.fn(),
  deleteInstallTrace: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;
const { rowMenuItems } = await import('./ProgramList.jsx');
const { batchIneligibleReason } = await import('../lib/batchSelection.js');
const { tagChocolateyManaged } = await import('../hooks/usePrograms.js');

const python = { id: 'p1', name: 'Python 3.14', publisher: 'PSF', uninstallString: 'msiexec /x{py}', sizeBytes: 100, chocolateyId: 'python314' };
const shim = { id: 'chocolatey:shim', name: 'Oscdimg in PATH', publisher: 'Microsoft', source: 'chocolatey', chocolateyId: 'windows-adk-oscdimg', sizeBytes: 5, installLocation: 'C:\\c\\lib\\shim' };
const plain = { id: 'p2', name: 'Notepad', publisher: 'X', uninstallString: 'u.exe', sizeBytes: 1 };
const oldTool = { id: 'unregistered:C:\\PF\\OldTool', name: 'OldTool', publisher: '', source: 'unregistered', installLocation: 'C:\\PF\\OldTool', sizeBytes: 9 };
const wsl = { id: 'feature:WSL', name: 'Windows Subsystem for Linux', featureName: 'WSL', publisher: 'Microsoft', source: 'feature', protected: false };
const netfx = { id: 'feature:NetFx4-AdvSrvs', name: '.NET Framework 4.8 Advanced Services', featureName: 'NetFx4-AdvSrvs', publisher: 'Microsoft', source: 'feature', protected: true };
const kb = { id: 'update:KB5127694', name: 'KB5127694', publisher: 'Microsoft', source: 'update' };

beforeEach(() => vi.clearAllMocks());

const show = (props = {}) => {
  const handlers = { onRemoveSourceItem: vi.fn(), onRemoveUnregistered: vi.fn(), onUninstall: vi.fn() };
  renderScreen(<ProgramList programs={[python, shim, plain]} unregistered={[oldTool]} windowsItems={[wsl, netfx, kb]} {...handlers} {...props} />);
  return handlers;
};

describe('filters', () => {
  it('offers Chocolatey, Not registered and Windows only with something in them, and keeps the last two out of All', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Chocolatey (2)' }));
    expect(screen.getAllByRole('row').map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Python 3\.14/), expect.stringMatching(/Oscdimg in PATH/)]));
    expect(screen.queryByRole('row', { name: /Notepad/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.queryByRole('row', { name: /OldTool/ })).toBeNull();
    expect(screen.queryByRole('row', { name: /KB5127694/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Not registered (1)' }));
    expect(await screen.findByText(/no installed program, service, driver or task claims/)).toBeTruthy();
    expect(screen.getByRole('row', { name: /OldTool/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Windows (3)' }));
    expect(screen.getByText(/changes Windows itself/)).toBeTruthy();
  });

  it('hides the chips when there is nothing to show', async () => {
    renderScreen(<ProgramList programs={[plain]} />);
    await screen.findByRole('row', { name: /Notepad/ });
    expect(screen.queryByRole('button', { name: /Chocolatey|Not registered|Windows \(/ })).toBeNull();
  });
});

describe('row actions', () => {
  it('hands each kind of row to its own removal', async () => {
    const user = userEvent.setup();
    const handlers = show();
    await user.click(await screen.findByRole('button', { name: 'Chocolatey (2)' }));
    await user.click(within(screen.getByRole('row', { name: /Oscdimg in PATH/ })).getByRole('button', { name: /Uninstall/ }));
    expect(handlers.onRemoveSourceItem).toHaveBeenCalledWith(shim);

    await user.click(screen.getByRole('button', { name: 'Not registered (1)' }));
    await user.click(within(screen.getByRole('row', { name: /OldTool/ })).getByRole('button', { name: /Remove/ }));
    expect(handlers.onRemoveUnregistered).toHaveBeenCalledWith(oldTool);

    await user.click(screen.getByRole('button', { name: 'Windows (3)' }));
    await user.click(within(screen.getByRole('row', { name: /Windows Subsystem for Linux/ })).getByRole('button', { name: /Turn off/ }));
    expect(handlers.onRemoveSourceItem).toHaveBeenCalledWith(wsl);
    await user.click(within(screen.getByRole('row', { name: /KB5127694/ })).getByRole('button', { name: /Uninstall/ }));
    expect(handlers.onRemoveSourceItem).toHaveBeenCalledWith(kb);
  });

  it('offers no button for a feature Windows depends on, and says why', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Windows (3)' }));
    const row = screen.getByRole('row', { name: /\.NET Framework 4\.8/ });
    expect(within(row).queryByRole('button', { name: /Turn off/ })).toBeNull();
    expect(within(row).getByText(/Windows needs this feature/)).toBeTruthy();
  });
});

describe('rowMenuItems', () => {
  const t = (key) => ({ 'applications.uninstall': 'Uninstall', 'sourcesV4.actions.chocoUninstall': 'Uninstall with Chocolatey', 'sourcesV4.actions.turnOff': 'Turn off', 'sourcesV4.actions.remove': 'Remove…' }[key] ?? key);
  const opts = (extra) => ({ t, toasts: {}, onUninstall: vi.fn(), onRemoveSourceItem: vi.fn(), onRemoveUnregistered: vi.fn(), ...extra });

  it('a program a package installed keeps its uninstaller and gets Chocolatey beside it', () => {
    const o = opts();
    const labels = rowMenuItems(python, o).map((i) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['Uninstall', 'Uninstall with Chocolatey']));
    rowMenuItems(python, o).find((i) => i.label === 'Uninstall with Chocolatey').onSelect();
    expect(o.onRemoveSourceItem).toHaveBeenCalledWith(python);
  });

  it('a protected feature offers nothing that removes', () => {
    expect(rowMenuItems(netfx, opts()).filter((i) => i.danger)).toEqual([]);
  });
});

describe('batch', () => {
  it('leaves every new kind of row out of a batch, with a reason', () => {
    for (const row of [shim, oldTool, wsl, kb]) expect(batchIneligibleReason(row), row.id).toMatch(/one at a time/);
    expect(batchIneligibleReason(python)).toBeNull();
  });
});

describe('tagChocolateyManaged', () => {
  it('marks the programs a package installed and returns the same array when there is nothing to mark', () => {
    const list = [plain, { id: 'p1', name: 'Python' }];
    expect(tagChocolateyManaged(list, { p1: 'python314' })[1]).toEqual({ id: 'p1', name: 'Python', chocolateyId: 'python314' });
    expect(tagChocolateyManaged(list, {})).toBe(list);
    expect(tagChocolateyManaged(list, undefined)).toBe(list);
  });
});
