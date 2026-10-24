// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Properties in an Applications row's menu: Windows' own Properties sheet
 * for the program's main executable, which the server finds -- the list
 * only names the program. */

const showFileProperties = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchInstallTraces: vi.fn(async () => []),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (p) => p),
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(),
  openInstalledAppsSettings: vi.fn(),
  deleteInstallTrace: vi.fn(),
  showFileProperties: (...a) => showFileProperties(...a)
}));

const ProgramList = (await import('./ProgramList.jsx')).default;
const ToastHost = (await import('./ToastHost.jsx')).default;

const editor = { id: 'ed', name: 'Text Editor', publisher: 'Writer', uninstallString: 'u.exe', sizeBytes: 5, installLocation: 'C:\\Program Files\\Editor' };
const iconOnly = { id: 'ic', name: 'Icon Only', publisher: 'X', uninstallString: 'u.exe', sizeBytes: 4, displayIcon: 'C:\\Tools\\icon.exe,0' };
const bare = { id: 'nb', name: 'Nowhere', publisher: 'X', uninstallString: 'u.exe', sizeBytes: 3 };
const store = { id: 'store:Calc_1', name: 'Calculator', publisher: 'Microsoft', source: 'store', installLocation: 'C:\\Program Files\\WindowsApps\\Calc', sizeBytes: 2 };

const menuOf = (name) => {
  fireEvent.contextMenu(screen.getByRole('row', { name: new RegExp(name) }));
  return screen.getAllByRole('menuitem').map((b) => b.textContent);
};

beforeEach(() => vi.clearAllMocks());

describe('Properties in the row menu', () => {
  it('names the program by id, for the server to find its executable', async () => {
    showFileProperties.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderScreen(<ProgramList programs={[editor]} />);
    await screen.findByRole('row', { name: /Text Editor/ });
    expect(menuOf('Text Editor')).toContain('Properties');
    await user.click(screen.getByRole('menuitem', { name: 'Properties' }));
    expect(showFileProperties).toHaveBeenCalledWith({ programId: 'ed' });
  });

  it('is offered when the program names a folder or an icon file, and not otherwise', async () => {
    renderScreen(<ProgramList programs={[editor, iconOnly, bare, store]} />);
    await screen.findByRole('row', { name: /Icon Only/ });
    expect(menuOf('Icon Only')).toContain('Properties');
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(menuOf('Nowhere')).not.toContain('Properties');
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(menuOf('Calculator')).not.toContain('Properties');
  });

  it('says why in a toast when the sheet would not open', async () => {
    showFileProperties.mockResolvedValue({ ok: false, error: 'No program file was found for this program.' });
    const user = userEvent.setup();
    renderScreen(<><ProgramList programs={[editor]} /><ToastHost /></>);
    await screen.findByRole('row', { name: /Text Editor/ });
    menuOf('Text Editor');
    await user.click(screen.getByRole('menuitem', { name: 'Properties' }));
    expect(await screen.findByText("Couldn't open Properties: No program file was found for this program.")).toBeTruthy();
  });
});
