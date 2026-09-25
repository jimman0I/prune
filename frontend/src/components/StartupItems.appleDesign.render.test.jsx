// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Startup screen after the Apple design pass.
 *
 * jsdom does no layout, so "the Status column is visible at 900 px" cannot be
 * measured here. What can be proved is the thing that decides it: the grid
 * template. At the 900 px window the pane is about 692 px wide and the old
 * template needed 806, so the panel's overflow-hidden sliced off Status. The
 * tests below assert the template itself -- what each column may shrink to,
 * what it cannot shrink below, and which column is hidden where -- against a
 * pane width taken from that measurement. */

const fetchStartupItems = vi.fn();
const setStartupItemEnabled = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStartupItems: (...args) => fetchStartupItems(...args),
  fetchStartupIcons: async () => ({}),
  setStartupItemEnabled: (...args) => setStartupItemEnabled(...args)
}));

const { default: StartupItems, COLUMNS, GRID_NARROW, GRID_WIDE, GRID_CLASS } = await import('./StartupItems.jsx');

const entry = (over = {}) => ({
  id: 'e1',
  name: 'Thing',
  command: 'C:\\Program Files\\Thing\\thing.exe',
  description: 'Thing Launcher',
  publisher: 'Acme',
  location: 'Run',
  rawScope: 'user',
  enabled: true,
  running: false,
  exists: true,
  toggleNote: null,
  ...over
});

const rowFor = (name) => screen.getByText(name).closest('div[class*="grid"]');

beforeEach(() => {
  vi.clearAllMocks();
  fetchStartupItems.mockResolvedValue([entry()]);
  setStartupItemEnabled.mockResolvedValue({ ok: true, enabled: false });
});

/** The template a class carries, as a list of column widths. */
const templateOf = (cls) => /grid-cols-\[([^\]]+)\]/.exec(cls)[1].split('_');

const PANE_AT_900 = 692;   // measured in the running app at the 900 px window
const GAP = 12;            // gap-3

describe('the column template', () => {
  const narrowCols = COLUMNS.filter((c) => !c.wideOnly).map((c) => c.width);
  const wideCols = COLUMNS.map((c) => c.width);

  it('is what COLUMNS says, so the classes cannot drift from the definition', () => {
    expect(templateOf(GRID_NARROW)).toEqual(narrowCols);
    expect(templateOf(GRID_WIDE)).toEqual(wideCols);
    expect(GRID_WIDE.startsWith('min-[1100px]:')).toBe(true);
    expect(GRID_NARROW.startsWith('min-[')).toBe(false);
  });

  it('lets every flexible column shrink to nothing: no pixel minimum anywhere', () => {
    for (const width of wideCols) {
      if (width.startsWith('minmax(')) expect(width).toMatch(/^minmax\(0,/);
      expect(width).not.toMatch(/minmax\(\d{2,}px/);
    }
  });

  it('keeps Status a fixed, last column, so it is what stays when space runs out', () => {
    expect(COLUMNS.at(-1).key).toBe('status');
    expect(COLUMNS.at(-1).width).toMatch(/^\d+px$/);
    expect(COLUMNS.at(-1).wideOnly).toBeFalsy();
  });

  it('needs less than the 900 px pane, where the old template needed 806 px', () => {
    const fixed = (cols) => cols.filter((w) => /^\d+px$/.test(w)).reduce((sum, w) => sum + parseInt(w, 10), 0);
    const need = (cols) => fixed(cols) + GAP * (cols.length - 1);

    expect(need(narrowCols)).toBeLessThan(PANE_AT_900 - 2 * 20 /* px-5 */);
    // Regression guard on the number that was wrong: the old template.
    const old = ['30px', '20px', 'minmax(150px,0.9fr)', 'minmax(180px,1.3fr)', 'minmax(130px,0.9fr)', 'minmax(120px,0.8fr)', '104px'];
    const oldNeed = old.reduce((sum, w) => sum + (parseInt(/(\d+)px/.exec(w)[1], 10)), 0) + GAP * (old.length - 1);
    expect(oldNeed).toBe(806);
    expect(oldNeed).toBeGreaterThan(PANE_AT_900);
  });

  it('hides only Description below 1100 px', () => {
    expect(COLUMNS.filter((c) => c.wideOnly).map((c) => c.key)).toEqual(['description']);
    expect(narrowCols).toHaveLength(wideCols.length - 1);
  });
});

describe('the rendered grid', () => {
  it('uses one template for the header and every row', async () => {
    fetchStartupItems.mockResolvedValue([entry({ id: 'a', name: 'Alpha' }), entry({ id: 'b', name: 'Bravo' })]);
    const { container } = renderScreen(<StartupItems />);
    await screen.findByText('Alpha');

    const grids = [...container.querySelectorAll('div')].filter((d) => d.className.includes('grid-cols-['));
    // one header + two rows
    expect(grids).toHaveLength(3);
    for (const g of grids) {
      expect(g.className).toContain(GRID_CLASS);
      expect(g.getAttribute('style') || '').not.toContain('grid-template-columns');
    }
  });

  it('hides Description by class in the header and in the rows, and keeps Status and Publisher', async () => {
    fetchStartupItems.mockResolvedValue([entry({ id: 'g', name: 'Ghost', exists: false, description: 'Ghost desc' })]);
    const { container } = renderScreen(<StartupItems />);
    await screen.findByText('Ghost');

    const hidesBelowWide = (el) => el.className.includes('hidden') && el.className.includes('min-[1100px]:block');
    expect(hidesBelowWide(screen.getByText('Description'))).toBe(true);
    expect(hidesBelowWide(screen.getByText('Ghost desc'))).toBe(true);
    // Everything else stays.
    for (const label of ['Startup name', 'Launch path', 'Publisher', 'Status']) {
      expect(screen.getByText(label).className).not.toContain('hidden');
    }
    expect(screen.getByText('Acme').className).not.toContain('hidden');
    const pill = within(rowFor('Ghost')).getByText('Invalid');
    expect(pill.closest('div[class*="grid-cols"]')).toBeTruthy();
    expect(container.querySelectorAll('.hidden')).toHaveLength(2);
  });
});

describe('a disabled entry', () => {
  it('is no longer dimmed to 55% opacity, which put every word below the contrast floor', async () => {
    fetchStartupItems.mockResolvedValue([entry({ id: 'off', name: 'Sleeper', enabled: false })]);
    renderScreen(<StartupItems />);
    await screen.findByText('Sleeper');

    const row = rowFor('Sleeper');
    expect(row.className).not.toMatch(/opacity-/);
    expect(screen.getByText('Sleeper').className).toContain('text-[color:var(--text-secondary)]');
  });

  it('says Off in the Status column, and an enabled one does not', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'off', name: 'Sleeper', enabled: false }),
      entry({ id: 'on', name: 'Waker', enabled: true })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('Sleeper');

    expect(within(rowFor('Sleeper')).getByText('Off')).toBeTruthy();
    expect(within(rowFor('Waker')).queryByText('Off')).toBeNull();
    expect(screen.getByText('Waker').className).toContain('text-[color:var(--text-primary)]');
  });

  it('still says Invalid for a leftover, even when it is also switched off', async () => {
    // A file that is gone is the reason to be here; "Off" must not hide it.
    fetchStartupItems.mockResolvedValue([entry({ id: 'g', name: 'Ghost', enabled: false, exists: false })]);
    renderScreen(<StartupItems />);
    await screen.findByText('Ghost');

    const row = rowFor('Ghost');
    expect(within(row).getByText('Invalid')).toBeTruthy();
    expect(within(row).queryByText('Off')).toBeNull();
  });
});

describe('small text', () => {
  it('the status pills are 10.5 px, and the fallback tile letter is 11 px', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'g', name: 'Ghost', exists: false }),
      entry({ id: 'r', name: 'Runner', running: true })
    ]);
    const { container } = renderScreen(<StartupItems />);
    await screen.findByText('Ghost');

    for (const label of ['Invalid', 'Running']) {
      const pill = screen.getByText(label);
      expect(pill.className).toContain('text-[10.5px]');
    }
    expect(container.innerHTML).not.toContain('text-[9px]');
    const tile = container.querySelector('div.font-bold');
    expect(tile.className).toContain('text-[11px]');
  });
});

describe('the switch', () => {
  it('is a checkbox with one fixed name, and only aria-checked changes when it is toggled', async () => {
    setStartupItemEnabled.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    const box = screen.getByRole('checkbox', { name: 'Run Thing at sign-in' });
    expect(box.getAttribute('aria-checked')).toBe('true');
    await user.click(box);

    await waitFor(() => expect(box.getAttribute('aria-checked')).toBe('false'));
    // Same name after the click: nothing to flip between "Disable" and "Enable".
    expect(screen.getByRole('checkbox', { name: 'Run Thing at sign-in' })).toBe(box);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('is still single-flight: a second click while the first is in flight asks nothing more', async () => {
    setStartupItemEnabled.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    const box = screen.getByRole('checkbox');
    await user.click(box);
    await user.click(box);
    await user.click(box);

    expect(setStartupItemEnabled).toHaveBeenCalledTimes(1);
    expect(box.getAttribute('aria-busy')).toBe('true');
    // Not disabled: focus stays where the user put it while a UAC prompt is up.
    expect(box.disabled).toBe(false);
  });

  it('asks the machine for the opposite state, by id', async () => {
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    await user.click(screen.getByRole('checkbox'));

    expect(setStartupItemEnabled).toHaveBeenCalledWith('e1', false);
  });

  it('a read-only entry still offers no checkbox at all', async () => {
    fetchStartupItems.mockResolvedValue([entry({ id: 't', name: 'Task', source: 'task', toggleNote: 'Change it in Task Scheduler.' })]);
    renderScreen(<StartupItems />);
    await screen.findByText('Task');

    expect(within(rowFor('Task')).queryByRole('checkbox')).toBeNull();
  });
});

describe('table semantics', () => {
  it('is a table with column headers, row groups and cells', async () => {
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    const table = screen.getByRole('table', { name: 'Startup' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['', '', 'Startup name', 'Launch path', 'Description', 'Publisher', 'Status']);
    expect(within(table).getAllByRole('rowgroup')).toHaveLength(1);
    const row = within(table).getAllByRole('row').find((r) => r.textContent.includes('Thing Launcher'));
    expect(within(row).getAllByRole('cell')).toHaveLength(7);
  });
});
