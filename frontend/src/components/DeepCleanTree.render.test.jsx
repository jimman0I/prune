// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, within, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { renderScreen, makeTestClient } from '../testSupport/renderScreen.jsx';
import DeepCleanTree from './DeepCleanTree.jsx';

/** The Deep Clean tree, rendered.
 *
 * Controlled and purely presentational, but no longer provider-free: its
 * rows now read useLanguage() for "needs admin" / "not installed" /
 * "Loses data" / the heading checkbox's aria-label, and LanguageContext's
 * useSettings() call needs a QueryClient underneath it -- so this uses
 * renderScreen() like every other component test now, rather than the
 * bare `render()` this file used before those strings were translated.
 *
 * The decisions it makes are all translations: a set of ticked ids into
 * three checkbox states, a click on a heading into a request the parent
 * acts on, and four different "size" answers into four different words.
 * Each of those is a place a wrong translation renders perfectly and
 * means something else. categorySelectionState and nextCategoryChecked
 * are unit-tested beside their own source; what is tested here is that
 * this component actually asks them and shows what they said.
 */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

/* Explicit, because this project runs vitest without globals -- every
 * test imports describe/it/expect by name -- and React Testing Library
 * only auto-registers its own afterEach when they are on. Without it each
 * test's DOM is still mounted for the next, and getByText finds two of
 * everything. renderScreen carries the same hook for the screens that use
 * it; this file renders bare, so it carries its own. */
afterEach(cleanup);

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
    icons={props.icons}
    receiptMode={props.receiptMode}
  />
);

/** A category's own heading checkbox, by the label it carries. The rules
 * underneath are labelled with their names, so this cannot collide. */
const headingBox = (category) => screen.getByRole('checkbox', { name: `Select everything under ${category}` });

describe('the tree', () => {
  it('lists every category and every rule under it', () => {
    draw();

    expect(screen.getByText('Brave')).toBeTruthy();
    expect(screen.getByText('Windows')).toBeTruthy();
    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.getByText('Temp files')).toBeTruthy();
  });

  it('says what each rule does, on the same line as its name', () => {
    // The whole reason this is denser than BleachBit's tree and still
    // more informative: "Cookies" tells a non-expert nothing.
    draw();
    expect(screen.getByText('Cached page data')).toBeTruthy();
  });

  it('renders a heading even with no icon for it', () => {
    // Icons arrive from a second request and are allowed to be late,
    // empty, or missing for a category that is not a program at all.
    draw({ icons: {} });
    expect(screen.getByText('Brave')).toBeTruthy();
  });
});

describe('the heading checkbox', () => {
  it('reads empty when nothing under it is ticked', () => {
    draw();
    expect(headingBox('Brave').getAttribute('aria-checked')).toBe('false');
  });

  it('reads mixed when only some of it is ticked', () => {
    /* The state that matters most, and the one a two-state checkbox
     * cannot express. 'mixed' is what tells a screen reader the same
     * thing the dash tells everyone else: this category is partly
     * selected, so clicking will not do the obvious thing. */
    draw({ selected: new Set(['brave-cache']) });
    expect(headingBox('Brave').getAttribute('aria-checked')).toBe('mixed');
  });

  it('reads full only when every rule under it is ticked', () => {
    draw({ selected: new Set(['brave-cache', 'brave-cookies']) });
    expect(headingBox('Brave').getAttribute('aria-checked')).toBe('true');
  });

  it('reads empty above a category with nothing in it', () => {
    // "every child is ticked" is vacuously true of no children, and a
    // heading drawn full above nothing would be a lie. Reachable: hiding
    // software that is not installed can empty a category.
    draw({ categories: [{ category: 'Empty', items: [] }] });
    expect(headingBox('Empty').getAttribute('aria-checked')).toBe('false');
  });

  it('draws a dash for partial and a tick for full, which are different shapes', () => {
    /* Not the same mark in two colours: a partial category that drew a
     * tick would claim the rules it skipped are coming along.
     *
     * Both states in one render, which is what makes this an assertion
     * about the shapes rather than about one of them -- Brave is partly
     * ticked and Windows is fully ticked in the same tree. */
    draw({ selected: new Set(['brave-cache', 'win-temp']) });

    const partial = headingBox('Brave').querySelector('svg');
    expect(partial.querySelector('line')).toBeTruthy();
    expect(partial.querySelector('polyline')).toBeNull();

    const full = headingBox('Windows').querySelector('svg');
    expect(full.querySelector('polyline')).toBeTruthy();
    expect(full.querySelector('line')).toBeNull();
  });
});

describe('clicking the heading checkbox', () => {
  it('asks the parent to fill an empty category', async () => {
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggleCategory });

    await user.click(headingBox('Brave'));

    expect(onToggleCategory).toHaveBeenCalledWith('Brave', true);
  });

  it('asks the parent to CLEAR a partly-ticked one, not fill it', async () => {
    /* The ambiguous click, resolved the reversible way.
     *
     * Filling a partial category would silently tick rules the user
     * deliberately left alone -- including risky ones they may have
     * already been warned about and declined. Clearing takes nothing away
     * that cannot be re-ticked in one click.
     */
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggleCategory, selected: new Set(['brave-cache']) });

    await user.click(headingBox('Brave'));

    expect(onToggleCategory).toHaveBeenCalledWith('Brave', false);
  });

  it('asks the parent to clear a full one', async () => {
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggleCategory, selected: new Set(['brave-cache', 'brave-cookies']) });

    await user.click(headingBox('Brave'));

    expect(onToggleCategory).toHaveBeenCalledWith('Brave', false);
  });

  it('names the category it was clicked on, not another', async () => {
    // Two categories on screen and one handler between them: passing the
    // wrong name would clear a category the user never touched.
    const onToggleCategory = vi.fn();
    const user = userEvent.setup();
    draw({ onToggleCategory });

    await user.click(headingBox('Windows'));

    expect(onToggleCategory).toHaveBeenCalledTimes(1);
    expect(onToggleCategory.mock.calls[0][0]).toBe('Windows');
  });
});

describe('clicking one rule', () => {
  it('hands the parent that rule\'s id', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    draw({ onToggle });

    await user.click(screen.getByRole('checkbox', { name: 'Cookies' }));

    expect(onToggle).toHaveBeenCalledWith('brave-cookies');
  });

  it('reflects whether that rule is ticked', () => {
    draw({ selected: new Set(['brave-cookies']) });

    expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Cache' }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('the rules that lose something', () => {
  it('are marked, and the ordinary ones are not', () => {
    // Everything Clean removes goes to Quarantine first, so nothing here
    // is unrecoverable -- but being signed out of every site is not a
    // surprise a cleaning tool should spring on anyone.
    draw();

    const cookiesRow = screen.getByText('Cookies').closest('div');
    expect(within(cookiesRow).getByText('Loses data')).toBeTruthy();

    const cacheRow = screen.getByText('Cache').closest('div');
    expect(within(cacheRow).queryByText('Loses data')).toBeNull();
  });
});

describe('the description line', () => {
  // BleachBit's own list is bare -- a name and a checkbox, nothing else --
  // until Preview has actually run. Prune keeps the description (it says
  // what a bare "Cookies" cannot), but holds it back until THIS rule is
  // measured, per-row, rather than showing a wall of explanatory text for
  // 74 rules the machine may not even have.
  it('is hidden before the rule has been measured', () => {
    draw({ categories: [{ category: 'C', items: [rule({ id: 's', name: 'Rule', sizeBytes: null })] }] });
    expect(screen.queryByText('Cached page data')).toBeNull();
  });

  it('appears once that specific rule is measured', () => {
    draw({ categories: [{ category: 'C', items: [rule({ id: 's', name: 'Rule', sizeBytes: 2048 })] }] });
    expect(screen.getByText('Cached page data')).toBeTruthy();
  });

  it('never hides the "Loses data" badge, which is a safety warning, not description text', () => {
    draw({
      categories: [{
        category: 'C',
        items: [rule({ id: 's', name: 'Rule', sizeBytes: null, risky: true, description: 'Signs you out' })]
      }]
    });
    expect(screen.getByText('Loses data')).toBeTruthy();
    expect(screen.queryByText('Signs you out')).toBeNull();
  });
});

describe('the size column', () => {
  /* Four different answers that a naive implementation renders as one.
   * Only ONE of them means "nothing to clean", and the other three are
   * each a reason the number on screen should not be trusted as zero. */
  const sized = (over) => draw({ categories: [{ category: 'C', items: [rule({ id: 's', name: 'Rule', ...over })] }] });

  it('shows a dash when nothing has been measured yet', () => {
    sized({ sizeBytes: null });
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('says needs admin rather than 0 B when the read was refused', () => {
    // Prefetch is the everyday case: hundreds of MB that read as empty
    // to an unelevated process.
    sized({ sizeBytes: 0, accessible: false });
    expect(screen.getByText('needs admin')).toBeTruthy();
    expect(screen.queryByText('0 B')).toBeNull();
  });

  it('says not installed rather than 0 B when the software is absent', () => {
    sized({ sizeBytes: 0, present: false });
    expect(screen.getByText('not installed')).toBeTruthy();
    expect(screen.queryByText('0 B')).toBeNull();
  });

  it('says 0 B only when the rule really did measure nothing', () => {
    // The one case where zero is the truth, and it has to stay
    // distinguishable from the three above.
    sized({ sizeBytes: 0, present: true, accessible: true });
    expect(screen.getByText('0 B')).toBeTruthy();
  });

  it('scales a real measurement', () => {
    sized({ sizeBytes: 5 * 1024 * 1024 });
    expect(screen.getByText('5 MB')).toBeTruthy();
  });
});

describe('the checkbox position in each row', () => {
  // Grounded against the real, installed BleachBit app: every row -- both
  // an application heading and each rule under it -- puts its checkbox in
  // a column at the row's far right edge, with the disclosure triangle and
  // the label at the left. Prune's rows used to do the opposite (checkbox
  // first). Both row types render their checkbox as a direct child of the
  // same flex container that holds everything else in the row, so "last
  // child of the checkbox's own parent" is "last thing in the row".
  it('puts the category heading checkbox last in its row, not first', () => {
    draw();

    const checkbox = headingBox('Brave');
    const row = checkbox.parentElement;
    const children = Array.from(row.children);

    expect(children[children.length - 1]).toBe(checkbox);
    expect(children[0]).not.toBe(checkbox);
  });

  it('puts an item row\'s checkbox last in its row, not first', () => {
    draw();

    const checkbox = screen.getByRole('checkbox', { name: 'Cookies' });
    const row = checkbox.parentElement;
    const children = Array.from(row.children);

    expect(children[children.length - 1]).toBe(checkbox);
    expect(children[0]).not.toBe(checkbox);
  });
});

describe('receiptMode', () => {
  // The narrow sidebar Clean shows while running: a live receipt of only
  // what was actually ticked, not the full 74-row browsing list. Nothing
  // here touches selection state itself -- only which rows this component
  // chooses to render.
  it('shows only selected items within a category, forced expanded', () => {
    const selected = new Set(['brave-cache']);
    draw({ receiptMode: true, selected });

    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.queryByText('Cookies')).toBeNull();
  });

  it('omits a category entirely when nothing in it is selected', () => {
    draw({ receiptMode: true, selected: new Set() });

    expect(screen.queryByText('Brave')).toBeNull();
    expect(screen.queryByText('Windows')).toBeNull();
  });

  it('shows a category forced-expanded in receiptMode even if the user had collapsed it', async () => {
    // Same rendering the rest of this file gets from renderScreen(), built
    // by hand here because the point of this test is a mid-test PROP
    // change (collapse, then flip receiptMode on) via the same render's
    // own rerender -- renderScreen() itself only exposes a one-shot render.
    const client = makeTestClient();
    const wrap = ({ selected, receiptMode }) => (
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <DeepCleanTree
                categories={CATEGORIES}
                selected={selected}
                onToggle={() => {}}
                onToggleCategory={() => {}}
                receiptMode={receiptMode}
              />
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    const user = userEvent.setup();
    const selected = new Set(['brave-cache']);
    const { rerender } = render(wrap({ selected, receiptMode: false }));

    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));
    expect(screen.queryByText('Cache')).toBeNull();

    rerender(wrap({ selected, receiptMode: true }));

    expect(screen.getByText('Cache')).toBeTruthy();
  });

  it('is a no-op when receiptMode is omitted -- unchanged current behavior', () => {
    draw({ selected: new Set(['brave-cache']) });

    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.getByText('Windows')).toBeTruthy();
  });

  it('is a no-op when receiptMode is false -- unchanged current behavior', () => {
    draw({ receiptMode: false, selected: new Set(['brave-cache']) });

    expect(screen.getByText('Cache')).toBeTruthy();
    expect(screen.getByText('Cookies')).toBeTruthy();
    expect(screen.getByText('Windows')).toBeTruthy();
  });
});

describe('collapsing a category', () => {
  it('hides its rules but keeps its checkbox reachable', async () => {
    // The heading is the one row that stays: a collapsed category still
    // has to be selectable, and its state still has to be visible.
    const user = userEvent.setup();
    draw({ selected: new Set(['brave-cache']) });
    expect(screen.getByText('Cache')).toBeTruthy();

    await user.click(screen.getByRole('button', { expanded: true, name: /Brave/ }));

    expect(screen.queryByText('Cache')).toBeNull();
    expect(headingBox('Brave').getAttribute('aria-checked')).toBe('mixed');
  });
});
