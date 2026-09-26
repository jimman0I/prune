// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Keyboard reach, the filtered header count and the Unused definition.
 *
 * The row actions are invisible at rest and shown on hover, so the way a
 * keyboard user finds them is the row itself taking focus: one row is in
 * the Tab order, the arrow keys move between rows, and a focused row shows
 * its actions. jsdom does no layout or :hover, so "visible" is asserted as
 * the classes that produce it and reach is asserted for real. */

vi.mock('../lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(async () => {}),
  openInstalledAppsSettings: vi.fn(async () => {}),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;
const { ACTION_BACKING } = await import('./ProgramList.jsx');

const program = (over = {}) => ({
  id: over.name, name: 'Thing', publisher: 'Acme', sizeBytes: 1024 * 1024 * 1024,
  source: 'registry', uninstallString: 'C:\\x\\uninstall.exe', installLocation: 'C:\\x', ...over
});
const A = program({ name: 'Alpha', sizeBytes: 3 * 1024 ** 3 });
const B = program({ name: 'Bravo', sizeBytes: 2 * 1024 ** 3, unused: true });
const C = program({ name: 'Charlie', sizeBytes: 1 * 1024 ** 3 });

const render = (props = {}) => renderScreen(
  <ProgramList programs={[A, B, C]} extensions={[]} running={{}} icons={{}}
    onUninstall={vi.fn()} onBatchUninstall={vi.fn()} onRemoveStoreApp={vi.fn()} {...props} />
);
const dataRows = () => screen.getAllByRole('row').filter((row) => !row.hasAttribute('data-table-header'));

beforeEach(() => { vi.clearAllMocks(); });

describe('reaching a row with the keyboard', () => {
  it('puts exactly one row in the Tab order, and the rest one arrow key away', async () => {
    render();
    await screen.findByText('Alpha');
    expect(dataRows().map((row) => row.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('moves between rows with the arrow keys, Home and End, and the Tab stop follows', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Alpha');
    const rows = dataRows();

    rows[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[1]);
    expect(rows.map((row) => row.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(rows[2]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[2]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(rows[0]);
  });

  it('leaves the arrow keys alone while a control inside the row has focus', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Alpha');
    const rows = dataRows();

    within(rows[0]).getByRole('button', { name: /Open the folder for Alpha/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(rows[1]);
  });

  it('reaches the row actions by Tab from the row', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Alpha');
    const row = dataRows()[0];

    row.focus();
    await user.tab();
    expect(document.activeElement).toBe(within(row).getByRole('checkbox'));
    await user.tab();
    expect(document.activeElement).toBe(within(row).getByRole('button', { name: /Open the folder for Alpha/ }));
    await user.tab();
    expect(document.activeElement).toBe(within(row).getByRole('button', { name: 'Uninstall' }));
  });

  it('shows the actions for a focused row as well as a hovered one, and draws the focus', async () => {
    render();
    await screen.findByText('Alpha');
    expect(ACTION_BACKING).toContain('group-hover:opacity-100');
    expect(ACTION_BACKING).toContain('group-focus-within:opacity-100');
    const row = dataRows()[0];
    expect(row.className).toContain('group');
    expect(row.className).toContain('focus-visible:');
  });

  it('keeps the row and cell structure a screen reader reads', async () => {
    render();
    await screen.findByText('Alpha');
    const row = dataRows()[0];
    expect(within(row).getAllByRole('cell').length).toBeGreaterThan(5);
    expect(screen.getByRole('table').getAttribute('aria-rowcount')).toBe('4');
  });
});

describe('what the header count is told', () => {
  it('reports the whole list when nothing narrows it', async () => {
    const onViewChange = vi.fn();
    render({ onViewChange });
    await screen.findByText('Alpha');
    expect(onViewChange).toHaveBeenLastCalledWith({ filtered: false, shown: 3, total: 3, bytes: 6 * 1024 ** 3 });
  });

  it('follows a search: how many are shown, of how many, and the size of just those', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render({ onViewChange });
    await screen.findByText('Alpha');

    await user.type(screen.getByRole('textbox', { name: 'Search applications' }), 'brav');
    expect(onViewChange).toHaveBeenLastCalledWith({ filtered: true, shown: 1, total: 3, bytes: 2 * 1024 ** 3 });

    await user.clear(screen.getByRole('textbox', { name: 'Search applications' }));
    expect(onViewChange).toHaveBeenLastCalledWith({ filtered: false, shown: 3, total: 3, bytes: 6 * 1024 ** 3 });
  });

  it('follows a filter chip too', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render({ onViewChange });
    await screen.findByText('Alpha');

    await user.click(screen.getByRole('button', { name: 'Unused' }));
    expect(onViewChange).toHaveBeenLastCalledWith({ filtered: true, shown: 1, total: 3, bytes: 2 * 1024 ** 3 });
  });
});

describe('the Unused filter', () => {
  it('says what unused means while it is selected, and not before', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Alpha');
    expect(screen.queryByText(/launch history/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Unused' }));
    expect(screen.getByText(/Flagged as not used recently/)).toBeTruthy();
  });

  it('is not offered when nothing is flagged, since it could only ever be empty', async () => {
    render({ programs: [A, C] });
    await screen.findByText('Alpha');
    expect(screen.queryByRole('button', { name: 'Unused' })).toBeNull();
  });
});
