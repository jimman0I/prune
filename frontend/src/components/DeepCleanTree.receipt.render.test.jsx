// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import DeepCleanTree from './DeepCleanTree.jsx';
import { DEEP_CLEAN_COLLAPSED_KEY } from '../lib/deepCleanExpansion.js';

/** The tree while a clean runs (receiptMode), and while a filter is active:
 * the two modes where the list is not the live, browsable one. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const rule = (over = {}) => ({
  id: 'r1', name: 'Cache', description: 'Cached page data', sizeBytes: 1024,
  present: true, accessible: true, risky: false, ...over
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
    categories={CATEGORIES}
    selected={props.selected || new Set()}
    onToggle={props.onToggle || (() => {})}
    onToggleCategory={props.onToggleCategory || (() => {})}
    receiptMode={props.receiptMode}
  />
);

const headingBox = (category) => screen.getByRole('checkbox', { name: `Select everything under ${category}` });
const filterBox = () => screen.getByRole('textbox', { name: 'Filter cleaners…' });

describe('the cleaning receipt is read-only', () => {
  // receiptMode draws from the snapshot taken when Clean started, while the
  // parent's onToggle reads the LIVE selection: a click there could toggle
  // the wrong thing, or open a risky-rule dialog in the middle of a clean.
  it('never calls onToggle when a receipt row is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    draw({ receiptMode: true, onToggle, selected: new Set(['brave-cache', 'brave-cookies']) });

    await user.click(screen.getByText('Cache'));
    await user.click(screen.getByText('Cookies'));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('disables the receipt checkboxes and never calls the parent from them', async () => {
    const onToggle = vi.fn();
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ receiptMode: true, onToggle, onToggleCategory, selected: new Set(['brave-cache']) });

    expect(screen.getByRole('checkbox', { name: 'Cache' }).disabled).toBe(true);
    expect(headingBox('Brave').disabled).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'Cache' }));
    await user.click(headingBox('Brave'));
    expect(onToggle).not.toHaveBeenCalled();
    expect(onToggleCategory).not.toHaveBeenCalled();
  });

  it('does not style a receipt row as clickable', () => {
    draw({ receiptMode: true, selected: new Set(['brave-cache']) });
    const row = screen.getByText('Cache').closest('div');
    expect(row.className).not.toMatch(/cursor-pointer/);
    expect(row.className).not.toMatch(/hover:/);
  });

  it('does not touch the remembered collapse from a receipt heading', async () => {
    const user = userEvent.setup();
    draw({ receiptMode: true, selected: new Set(['brave-cache']) });

    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));

    expect(window.localStorage.getItem(DEEP_CLEAN_COLLAPSED_KEY)).toBeNull();
    expect(screen.getByText('Cache')).toBeTruthy();
  });
});

describe('collapsing while a filter is active', () => {
  it('does nothing and writes nothing, since the list is forced open', async () => {
    const user = userEvent.setup();
    draw();
    await user.type(filterBox(), 'cook');

    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));

    expect(window.localStorage.getItem(DEEP_CLEAN_COLLAPSED_KEY)).toBeNull();
    expect(screen.getByText('Cookies')).toBeTruthy();
    // And clearing the filter finds the category still open.
    await user.clear(filterBox());
    expect(screen.getByText('Cache')).toBeTruthy();
  });
});

describe('the heading while a filter is active acts on what is visible', () => {
  it('passes only the visible ids, and reads its state from them', async () => {
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggleCategory, selected: new Set(['brave-cookies']) });
    await user.type(filterBox(), 'cook');

    // Only Cookies is visible and it is ticked: the box reads full, not
    // 'mixed' as it would over the whole category.
    expect(headingBox('Brave').getAttribute('aria-checked')).toBe('true');

    await user.click(headingBox('Brave'));
    expect(onToggleCategory).toHaveBeenCalledWith('Brave', false, ['brave-cookies']);
  });

  it('passes no ids when there is no filter', async () => {
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggleCategory });
    await user.click(headingBox('Brave'));
    expect(onToggleCategory.mock.calls[0]).toHaveLength(2);
  });
});

describe('focus and the count', () => {
  it('focuses the row checkbox without scrolling it under the sticky heading', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'focus');
    const user = userEvent.setup();
    draw();

    await user.click(screen.getByText('Cached page data'));

    expect(spy.mock.calls.some(([opts]) => opts?.preventScroll === true)).toBe(true);
    spy.mockRestore();
  });

  it('pads the scroller so keyboard focus clears the sticky heading', () => {
    draw();
    expect(document.querySelector('.overflow-y-auto').className).toContain('scroll-pt-[30px]');
  });

  it('counts the selection the footer counts and Clean acts on, hidden ids included', () => {
    draw({ selected: new Set(['brave-cache', 'ghost-rule-hidden-elsewhere']) });
    expect(screen.getByText(/2 of 3 selected/)).toBeTruthy();
  });
});
