// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Applications list after the Apple design pass. jsdom lays nothing out,
 * so sizes and breakpoints are asserted as the classes that produce them;
 * behaviour (roles, sort state, the context menu) is asserted for real. The
 * api module is mocked and nothing is uninstalled: what a test checks is which
 * handler a menu item hands the program to. */

const revealInExplorer = vi.fn(async () => {});
const openInstalledAppsSettings = vi.fn(async () => {});
vi.mock('../lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: (...a) => revealInExplorer(...a),
  openInstalledAppsSettings: (...a) => openInstalledAppsSettings(...a),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;
const ToastHost = (await import('./ToastHost.jsx')).default;
const { SIZE_TONE_TEXT, rowMenuItems, WIDE_BREAKPOINT_PX } = await import('./ProgramList.jsx');

const program = (over = {}) => ({
  id: over.name || 'p', name: 'Thing', publisher: 'Acme', sizeBytes: 1024 * 1024,
  source: 'registry', uninstallString: 'C:\\Program Files\\Thing\\uninstall.exe',
  installLocation: 'C:\\Program Files\\Thing', ...over
});
const STEAM = program({ id: 'steam', name: 'Steam', sizeBytes: 20e9 });
const TINY = program({ id: 'tiny', name: 'Tiny', sizeBytes: 5e6, health: { orphaned: true }, unused: true });
const STORE = program({ id: 'store', name: 'Calculator', source: 'store', packageFullName: 'Calc_1', installLocation: null, uninstallString: undefined });
const PROTECTED = program({ id: 'sec', name: 'Windows Security', source: 'store', nonRemovable: true, installLocation: null, uninstallString: undefined });
const EXT = program({ id: 'ext', name: 'uBlock', source: 'extension', installLocation: null, uninstallString: undefined, enabled: false, browser: 'Firefox' });

const render = (props = {}, withToasts = false) => renderScreen(
  <>
    <ProgramList programs={[STEAM, TINY, STORE, PROTECTED]} extensions={[EXT]} running={{ steam: true }} icons={{}}
      onUninstall={vi.fn()} onBatchUninstall={vi.fn()} onRemoveStoreApp={vi.fn()} {...props} />
    {withToasts && <ToastHost />}
  </>
);

beforeEach(() => { vi.clearAllMocks(); });

describe('text no smaller than 10 px', () => {
  it('has no 9 px text anywhere in the component source, and its badges are 10 px', async () => {
    expect(readFileSync('src/components/ProgramList.jsx', 'utf8')).not.toContain('text-[9px]');
    const { container } = render();
    await screen.findByText('Steam');
    const badge = within(screen.getByText('Steam').closest('[role="row"]')).getByText('Running');
    expect(badge.className).toContain('text-[10px]');
    expect(container.innerHTML).not.toContain('text-[9px]');
  });
});

describe('the row checkbox', () => {
  it('is a 24 px target around the same 15 px box, and still toggles', async () => {
    const user = userEvent.setup();
    render();
    const box = await screen.findByRole('checkbox', { name: 'Select Steam' });
    expect(box.className).toContain('w-6');
    expect(box.className).toContain('h-6');
    expect(box.firstElementChild.className).toContain('w-[15px]');
    await user.click(box);
    expect(box.getAttribute('aria-checked')).toBe('true');
  });
});

describe('table semantics', () => {
  it('is a table with columnheaders, rows and cells', async () => {
    render();
    const table = await screen.findByRole('table', { name: 'Applications' });
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(5);
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + 4); // header + the four programs
    expect(within(rows[1]).getAllByRole('cell').length).toBeGreaterThan(5);
  });

  it('marks the sorted column with aria-sort and moves it when another is chosen', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole('table');
    const header = (name) => screen.getByRole('columnheader', { name });
    expect(header(/Size/).getAttribute('aria-sort')).toBe('descending');
    expect(header(/Application/).getAttribute('aria-sort')).toBe('none');

    await user.click(within(header(/Application/)).getByRole('button'));
    expect(header(/Application/).getAttribute('aria-sort')).toBe('ascending');
    expect(header(/Size/).getAttribute('aria-sort')).toBe('none');
    await user.click(within(header(/Application/)).getByRole('button'));
    expect(header(/Application/).getAttribute('aria-sort')).toBe('descending');
  });

  it('sortable headers are 32 px tall', async () => {
    render();
    await screen.findByRole('table');
    const button = within(screen.getByRole('columnheader', { name: /Size/ })).getByRole('button');
    expect(button.className).toContain('min-h-8');
  });

  it('filter chips report which one is on', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByRole('table');
    const chip = (text) => screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith(text) && b.hasAttribute('aria-pressed'));
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Unused').getAttribute('aria-pressed')).toBe('false');
    await user.click(chip('Unused'));
    expect(chip('Unused').getAttribute('aria-pressed')).toBe('true');
    expect(chip('All').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('narrow windows', () => {
  it('hides Version and Website below 1380 px, in the header and every row', async () => {
    render();
    const table = await screen.findByRole('table');
    const hiddenUnder = (el) => el.className.includes('hidden') && /min-\[1380px\]:(block|flex)/.test(el.className);
    expect(hiddenUnder(screen.getByRole('columnheader', { name: /Version/ }))).toBe(true);
    expect(hiddenUnder(screen.getByRole('columnheader', { name: /Website/ }))).toBe(true);
    const cells = within(within(table).getAllByRole('row')[1]).getAllByRole('cell');
    // Version and Website are the 4th and 9th cells of a row.
    expect(hiddenUnder(cells[3])).toBe(true);
    expect(hiddenUnder(cells[8])).toBe(true);
    // ...and nothing else is hidden.
    expect(cells.filter(hiddenUnder)).toHaveLength(2);
  });

  it('uses a narrower grid template and floor below 1380 px, and the wide one from 1380 up', async () => {
    const { container } = render();
    await screen.findByRole('table');
    const scroller = container.querySelector('[data-table-scroll]');
    const vars = scroller.style;
    const wide = vars.getPropertyValue('--cols-wide');
    const narrow = vars.getPropertyValue('--cols-narrow');
    expect(wide.split(' ').length).toBeGreaterThan(narrow.split(' ').length);
    expect(parseInt(vars.getPropertyValue('--min-narrow'))).toBeLessThan(parseInt(vars.getPropertyValue('--min-wide')));
    const header = container.querySelector('[data-table-header]');
    expect(header.className).toContain('[grid-template-columns:var(--cols-narrow)]');
    expect(header.className).toContain('min-[1380px]:[grid-template-columns:var(--cols-wide)]');
  });

  it('only brings the wide columns back once the pane can hold them (rail 200 + gutters 96 + the table floor)', async () => {
    const { container } = render();
    await screen.findByRole('table');
    const wideFloor = parseInt(container.querySelector('[data-table-scroll]').style.getPropertyValue('--min-wide'));
    const narrowFloor = parseInt(container.querySelector('[data-table-scroll]').style.getPropertyValue('--min-narrow'));
    expect(wideFloor + 200 + 96).toBeLessThanOrEqual(WIDE_BREAKPOINT_PX);
    // ...and the narrow table fits right up to that width (72px rail). Below
    // about 1010px it scrolls sideways, which is what the sticky action cell is for.
    expect(narrowFloor + 72 + 96).toBeLessThanOrEqual(WIDE_BREAKPOINT_PX - 1);
  });

  it('keeps the action column stuck to the right edge, on the panel colour, and header sticky to the top', async () => {
    const { container } = render();
    await screen.findByRole('table');
    const actionCell = (row) => within(row).getAllByRole('cell').at(-1);
    const row = screen.getByText('Steam').closest('[role="row"]');
    expect(actionCell(row).className).toContain('sticky');
    expect(actionCell(row).className).toContain('right-0');
    expect(actionCell(row).className).toContain('bg-[color:var(--bg-panel)]');
    const header = container.querySelector('[data-table-header]');
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
    expect(header.lastElementChild.className).toContain('right-0');
  });

  it('shows the actions for keyboard focus anywhere in the row, not only hover', async () => {
    render();
    await screen.findByRole('table');
    const uninstall = within(screen.getByText('Steam').closest('[role="row"]')).getByRole('button', { name: 'Uninstall' });
    expect(uninstall.className).toContain('group-focus-within:opacity-100');
  });
});

describe('size colours', () => {
  it('ramp from neutral to amber and never use the danger colour', () => {
    for (const cls of Object.values(SIZE_TONE_TEXT)) expect(cls).not.toContain('danger');
    expect(SIZE_TONE_TEXT.high).toContain('--warning');
    expect(SIZE_TONE_TEXT.peak).toContain('--warning');
    expect(SIZE_TONE_TEXT.low).not.toContain('--warning');
  });

  it('the biggest program is amber, not red', async () => {
    render();
    await screen.findByText('Steam');
    const row = screen.getByText('Steam').closest('[role="row"]');
    const size = within(row).getByText('18.6 GB');
    expect(size.className).toContain('--warning');
    expect(size.className).not.toContain('danger');
  });
});

describe('the row context menu', () => {
  const openMenu = async (name) => {
    const row = (await screen.findByText(name)).closest('[role="row"]');
    fireEvent.contextMenu(row, { clientX: 300, clientY: 200 });
    return screen.findByRole('menu');
  };
  const item = (label) => screen.getByRole('menuitem', { name: label });

  it('offers Uninstall, Open folder and Copy uninstall command for an ordinary program', async () => {
    render();
    const menu = await openMenu('Steam');
    expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Uninstall', 'Open folder', 'Copy uninstall command']);
  });

  it('Uninstall hands the program to the same handler as the button, and only opens the dialog (removes nothing itself)', async () => {
    const onUninstall = vi.fn();
    const onRemoveStoreApp = vi.fn();
    render({ onUninstall, onRemoveStoreApp });
    await openMenu('Steam');
    fireEvent.click(item('Uninstall'));
    expect(onUninstall).toHaveBeenCalledTimes(1);
    expect(onUninstall).toHaveBeenCalledWith(expect.objectContaining({ id: 'steam' }));
    expect(onRemoveStoreApp).not.toHaveBeenCalled();
  });

  it('says Force remove for a broken entry', async () => {
    render();
    await openMenu('Tiny');
    expect(item('Force remove')).toBeTruthy();
  });

  it('a Store app goes to the Store dialog, never the registry uninstaller, and has no command to copy', async () => {
    const onUninstall = vi.fn();
    const onRemoveStoreApp = vi.fn();
    render({ onUninstall, onRemoveStoreApp });
    const menu = await openMenu('Calculator');
    expect(within(menu).queryByRole('menuitem', { name: 'Copy uninstall command' })).toBeNull();
    fireEvent.click(item('Uninstall'));
    expect(onRemoveStoreApp).toHaveBeenCalledWith(expect.objectContaining({ id: 'store' }));
    expect(onUninstall).not.toHaveBeenCalled();
  });

  it('a protected Store app offers Windows settings, not removal', async () => {
    const onUninstall = vi.fn();
    const onRemoveStoreApp = vi.fn();
    render({ onUninstall, onRemoveStoreApp });
    const menu = await openMenu('Windows Security');
    expect(within(menu).queryByRole('menuitem', { name: 'Uninstall' })).toBeNull();
    fireEvent.click(item('In Windows'));
    expect(openInstalledAppsSettings).toHaveBeenCalledTimes(1);
    expect(onUninstall).not.toHaveBeenCalled();
    expect(onRemoveStoreApp).not.toHaveBeenCalled();
  });

  it('a browser extension has no Uninstall in the menu, as it has no button', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Steam');
    await user.click(screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith('Extensions')));
    const row = (await screen.findByText('uBlock')).closest('[role="row"]');
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    // Nothing to offer at all: no folder, no command.
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('Open folder reveals the install location', async () => {
    render();
    await openMenu('Steam');
    fireEvent.click(item('Open folder'));
    expect(revealInExplorer).toHaveBeenCalledWith('C:\\Program Files\\Thing');
  });

  it('Copy uninstall command writes it to the clipboard and says so', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render({}, true);
    await openMenu('Steam');
    fireEvent.click(item('Copy uninstall command'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('C:\\Program Files\\Thing\\uninstall.exe'));
    expect(await screen.findByText('Uninstall command copied.')).toBeTruthy();
  });

  it('rowMenuItems leaves out what there is nothing to act on', () => {
    const t = (key) => key;
    const items = rowMenuItems(program({ installLocation: null, uninstallString: undefined }), { t, toasts: {}, onUninstall: vi.fn(), onRemoveStoreApp: vi.fn() });
    expect(items.map((i) => i.label)).toEqual(['applications.uninstall']);
  });
});

describe('Clear in the batch bar', () => {
  it('has room to hit', async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole('checkbox', { name: 'Select Steam' }));
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(clear.className).toContain('min-h-6');
    expect(clear.className).toContain('px-2');
  });
});
