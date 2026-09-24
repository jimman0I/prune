// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import DeepCleanTree from './DeepCleanTree.jsx';
import { DEEP_CLEAN_COLLAPSED_KEY } from '../lib/deepCleanExpansion.js';

/** The Deep Clean tree's interaction layer: the whole row as a click
 * target, the filter, the header count and the remembered expansion.
 *
 * Split from DeepCleanTree.render.test.jsx, which pins what the tree
 * DRAWS for a given selection; this pins what it DOES with a click or a
 * keystroke, and above all what it must never do -- a filter is a view and
 * must not touch the selection. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const rule = (over = {}) => ({
  id: 'r1',
  name: 'Cache',
  description: 'Cached page data',
  sizeBytes: 1024,
  present: true,
  accessible: true,
  risky: false,
  ...over
});

const CATEGORIES = [
  {
    category: 'Brave',
    items: [
      rule({ id: 'brave-cache', name: 'Cache' }),
      rule({ id: 'brave-cookies', name: 'Cookies', risky: true, description: 'Signs you out of every site' })
    ]
  },
  {
    category: 'Windows',
    items: [rule({ id: 'win-temp', name: 'Temp files', description: 'Files left in the temp folder' })]
  }
];

const draw = (props = {}) => renderScreen(
  <DeepCleanTree
    categories={props.categories || CATEGORIES}
    selected={props.selected || new Set()}
    onToggle={props.onToggle || (() => {})}
    onToggleCategory={props.onToggleCategory || (() => {})}
    receiptMode={props.receiptMode}
  />
);

const headingBox = (category) => screen.getByRole('checkbox', { name: `Select everything under ${category}` });

describe('the whole row is the click target', () => {
  it('toggles the rule when anything on the row is clicked, not only the 14px box', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    draw({ onToggle });

    await user.click(screen.getByText('Cached page data'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('brave-cache');

    await user.click(screen.getByText('Cookies'));
    expect(onToggle).toHaveBeenLastCalledWith('brave-cookies');
  });

  it('toggles exactly once when the box itself is clicked (no double toggle)', async () => {
    // The box sits inside the clickable row, so without stopPropagation one
    // click would toggle twice and land back where it started.
    const onToggle = vi.fn();
    const user = userEvent.setup();
    draw({ onToggle });

    await user.click(screen.getByRole('checkbox', { name: 'Cookies' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('still toggles from the keyboard on the checkbox itself', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    draw({ onToggle });

    screen.getByRole('checkbox', { name: 'Cookies' }).focus();
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenLastCalledWith('brave-cookies');
  });

  it("puts focus on the row's checkbox when the row is clicked, so a dialog it opens can give focus back", async () => {
    // A click on a plain div focuses nothing, and ModalOverlay returns
    // focus to whatever was focused when it opened. Without this, a click
    // on a risky row's text would open the warning and, on close, drop
    // focus to <body>.
    const user = userEvent.setup();
    draw();

    await user.click(screen.getByText('Signs you out of every site'));

    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Cookies' }));
  });

  it('leaves the category heading alone: it is not a click target for the rules under it', async () => {
    const onToggle = vi.fn();
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggle, onToggleCategory });

    await user.click(screen.getByText('Windows'));

    expect(onToggle).not.toHaveBeenCalled();
    expect(onToggleCategory).not.toHaveBeenCalled();
  });
});

describe('the heading checkbox hit area', () => {
  it('is 28x28 around a 16x16 visual box, so the target is bigger than what is drawn', () => {
    draw();
    const box = headingBox('Brave');

    expect(box.style.width).toBe('28px');
    expect(box.style.height).toBe('28px');
    const visual = box.querySelector('[data-checkbox-visual]');
    expect(visual.style.width).toBe('16px');
    expect(visual.style.height).toBe('16px');
  });
});

describe('state colours', () => {
  const sized = (over) => draw({ categories: [{ category: 'C', items: [rule({ id: 's', name: 'Rule', ...over })] }] });

  it('does not use the warning colour for needs admin, which would read as "loses data"', () => {
    sized({ sizeBytes: 0, accessible: false });
    const label = screen.getByText('needs admin');
    expect(label.className).not.toMatch(/--warning/);
    expect(label.className).toMatch(/text-secondary/);
  });

  it('draws a lock beside needs admin', () => {
    sized({ sizeBytes: 0, accessible: false });
    const label = screen.getByText('needs admin');
    expect(label.querySelector('svg[data-lock]')).toBeTruthy();
  });

  it('marks the loses-data badge at 10px, not 8.5px', () => {
    draw();
    expect(screen.getByText('Loses data').className).toMatch(/text-\[10px\]/);
    expect(screen.getByText('Loses data').className).not.toMatch(/8\.5/);
  });

  it('does not fade a not-installed row (its checkbox is live and faded text fails contrast)', () => {
    sized({ sizeBytes: 0, present: false });
    const row = screen.getByText('Rule').closest('div');
    expect(row.className).not.toMatch(/opacity/);
  });

  it('gives a not-installed rule its muted name instead', () => {
    sized({ sizeBytes: 0, present: false });
    expect(screen.getByText('Rule').className).toMatch(/text-muted/);
    // An ordinary rule keeps the primary text colour.
    cleanup();
    sized({ sizeBytes: 5, present: true });
    expect(screen.getByText('Rule').className).toMatch(/text-primary/);
  });
});

describe('the header: selected of total, and what it measures', () => {
  it('says how many of the listed rules are ticked', () => {
    draw({ selected: new Set(['brave-cache', 'win-temp']) });
    expect(screen.getByText(/2 of 3 selected/)).toBeTruthy();
  });

  it('adds the measured size of what is ticked', () => {
    // Three rules of 1 KB each, two ticked.
    draw({ selected: new Set(['brave-cache', 'win-temp']) });
    expect(screen.getByText(/2 of 3 selected/).textContent).toMatch(/2 KB/);
  });

  it('does not print a size when nothing ticked has been measured', () => {
    const unmeasured = [{ category: 'C', items: [rule({ id: 'u', name: 'U', sizeBytes: null })] }];
    draw({ categories: unmeasured, selected: new Set(['u']) });
    const text = screen.getByText(/1 of 1 selected/).textContent;
    expect(text).not.toMatch(/\d\s?(B|KB|MB|GB)/);
  });

  it('is not shown in the cleaning receipt', () => {
    draw({ receiptMode: true, selected: new Set(['brave-cache']) });
    expect(screen.queryByText(/selected/)).toBeNull();
  });
});

describe('the filter', () => {
  const filterBox = () => screen.getByRole('textbox', { name: 'Filter cleaners…' });

  it('narrows the list to rules whose name matches', async () => {
    const user = userEvent.setup();
    draw();

    await user.type(filterBox(), 'cook');

    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.queryByText('Temp files')).toBeNull();
    expect(screen.queryByText('Cache')).toBeNull();
  });

  it('matches the description as well, case-insensitively', async () => {
    const user = userEvent.setup();
    draw();

    await user.type(filterBox(), 'TEMP FOLDER');

    expect(screen.getByText('Temp files')).toBeTruthy();
    expect(screen.queryByText('Cookies')).toBeNull();
  });

  it('shows a whole category when its own name matches', async () => {
    const user = userEvent.setup();
    draw();

    await user.type(filterBox(), 'brave');

    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.queryByText('Temp files')).toBeNull();
    expect(screen.queryByText('Windows')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    draw();

    await user.type(filterBox(), 'zzzz');

    expect(screen.getByText('No cleaners match that filter.')).toBeTruthy();
  });

  it('never changes what is ticked, and never calls the parent', async () => {
    // A filter is a view. The tick states rendered for the rows that
    // remain are exactly the ones the parent handed in, and typing asks
    // for no selection change at all.
    const onToggle = vi.fn();
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ selected: new Set(['brave-cookies', 'win-temp']), onToggle, onToggleCategory });

    await user.type(filterBox(), 'cook');

    expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onToggleCategory).not.toHaveBeenCalled();
  });

  it('keeps counting the whole selection in the header, hidden rows included', async () => {
    // The ticked rule 'win-temp' is filtered out of view but is still
    // going to be cleaned, so the header must not pretend it is not.
    const user = userEvent.setup();
    draw({ selected: new Set(['brave-cookies', 'win-temp']) });

    await user.type(filterBox(), 'cook');

    expect(screen.queryByText('Temp files')).toBeNull();
    expect(screen.getByText(/2 of 3 selected/)).toBeTruthy();
  });

  it('opens a collapsed category that has a match, without forgetting the collapse', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));
    expect(screen.queryByText('Cookies')).toBeNull();

    await user.type(filterBox(), 'cook');
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(DEEP_CLEAN_COLLAPSED_KEY))).toEqual(['Brave']);

    await user.clear(filterBox());
    expect(screen.queryByText('Cookies')).toBeNull();
  });

  it('is not offered in the cleaning receipt', () => {
    draw({ receiptMode: true, selected: new Set(['brave-cache']) });
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('remembering which categories are collapsed', () => {
  it('starts every category open', () => {
    draw();
    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.getByText('Temp files')).toBeTruthy();
  });

  it('restores a collapsed category on the next mount', async () => {
    const user = userEvent.setup();
    const first = draw();
    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));
    first.unmount();

    draw();

    expect(screen.queryByText('Cache')).toBeNull();
    expect(screen.getByText('Temp files')).toBeTruthy();
    expect(screen.getByRole('button', { expanded: false, name: /Brave/ })).toBeTruthy();
  });

  it('forgets the collapse when it is opened again', async () => {
    const user = userEvent.setup();
    draw();
    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));
    await user.click(screen.getByRole('button', { expanded: false, name: /Brave/ }));

    expect(JSON.parse(window.localStorage.getItem(DEEP_CLEAN_COLLAPSED_KEY))).toEqual([]);
  });

  it('ignores a stored value that is junk', () => {
    window.localStorage.setItem(DEEP_CLEAN_COLLAPSED_KEY, '{"nope":true}');
    draw();
    expect(screen.getByText('Cache')).toBeTruthy();
  });
});
