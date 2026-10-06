// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import NavRail from './NavRail.jsx';
import { SCREEN_ORDER } from '../lib/screenOrder.js';

/** The nav rail's flyout labels, and the pair of classes that show them.
 *
 * What this file can and cannot prove is worth stating plainly, because
 * the bug it guards against is a CSS one and jsdom does not evaluate CSS.
 * It never loads Tailwind's output, so it cannot tell you what opacity a
 * label computes to under `:hover` or `:focus-visible`. That half was
 * verified live in a real browser instead, by clicking a nav button,
 * moving the pointer off the rail, and reading the computed opacity: 0
 * after the fix, 1 before it.
 *
 * What jsdom CAN hold onto is the structural coupling those styles depend
 * on, and that coupling fails silently. `peer-focus-visible:` only
 * resolves against a PREVIOUS SIBLING carrying `peer`; drop `peer` from
 * the button and the selector still compiles, still applies to nothing,
 * and the only symptom is that a keyboard user tabbing the rail sees no
 * label at all -- which nobody driving a mouse will ever notice. The
 * assertions below are deliberately about class names, because the
 * failure mode is a class name going missing.
 */

// Rail order, top to bottom: the seven places you go to work, then Settings
// in the footer. The same order Ctrl+1 to Ctrl+8 follow.
const LABELS = ['Dashboard', 'Disk Map', 'Applications', 'Quarantine', 'Startup', 'Duplicates', 'Deep Clean', 'Settings'];
const IDS_BY_LABEL = {
  'Dashboard': 'dashboard', 'Disk Map': 'diskmap', 'Applications': 'applications', 'Quarantine': 'quarantine',
  'Startup': 'startup', 'Duplicates': 'duplicates', 'Deep Clean': 'deepclean', 'Settings': 'settings'
};
const classesOf = (el) => el.className.split(' ');

/** The flyout for one item: the span that is a SIBLING of that item's
 * button, not a descendant of it.
 *
 * The first version of this asked for `button.parentElement
 * .querySelector('span')`, which happened to be the flyout only while the
 * button had no spans of its own. The moment the active-tab indicator and
 * an icon wrapper moved inside it, the helper started returning the icon
 * and three tests failed for a reason that had nothing to do with what
 * they were testing. Selecting a direct child of the wrapper says what is
 * actually meant. */
function flyoutFor(label) {
  const button = screen.getByRole('button', { name: label });
  const flyout = [...button.parentElement.children].find((el) => el.tagName === 'SPAN');
  return { button, flyout };
}

describe('nav rail flyout labels', () => {
  it('shows the key that goes to every destination', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    LABELS.forEach((label, index) => {
      // The chip beside the widened rail is the one place the key is
      // shown; the name is printed in the row itself.
      expect(flyoutFor(label).flyout.textContent).toBe(`Ctrl+${index + 1}`);
    });
  });

  it('reveals on keyboard focus, never on plain focus', () => {
    // The distinction is the whole fix. Clicking a button focuses it, and
    // that focus outlives the pointer leaving the rail, so anything keyed
    // to `:focus` or `:focus-within` leaves the label of the screen you
    // just opened parked over the content until you click elsewhere.
    // `:focus-visible` is the pseudo-class that already knows the
    // difference, and index.css commits to it everywhere else.
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const { flyout } = flyoutFor('Applications');

    expect(flyout.className).toContain('peer-focus-visible:opacity-100');
    expect(flyout.className).not.toContain('group-focus-within:opacity-100');
    expect(flyout.className).not.toContain('peer-focus:opacity-100');
  });

  it('keeps the button marked as the peer the label reads from', () => {
    // Without this class on the button, the rule above matches nothing and
    // the rail goes silently unlabelled for keyboard users.
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    for (const label of LABELS) {
      const { button, flyout } = flyoutFor(label);
      expect(button.className.split(/\s+/)).toContain('peer');
      // A general-sibling selector only looks forward: the peer has to
      // come first in the DOM, which is easy to undo by reordering JSX.
      expect(button.compareDocumentPosition(flyout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('still reveals on hover of the whole item, not just the button', () => {
    // Hover stays on the wrapper: the target area includes the padding
    // around the glyph, and the label itself must not be part of it --
    // pointer-events-none keeps it from ever sitting between the cursor
    // and the button underneath.
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const { button, flyout } = flyoutFor('Deep Clean');

    expect(button.parentElement.className.split(/\s+/)).toContain('group');
    expect(flyout.className).toContain('group-hover:opacity-100');
    expect(flyout.className).toContain('pointer-events-none');
  });
});

describe('the rail order', () => {
  it('is exactly the order Ctrl+1 to Ctrl+8 jump in', () => {
    // Settings is in the footer, but it is still the eighth stop. If the JSX
    // is reordered without lib/screenOrder.js, the number printed in a
    // tooltip would send you to a different screen than the one it labels.
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(LABELS);
    expect(LABELS.map((label) => IDS_BY_LABEL[label])).toEqual(SCREEN_ORDER);
  });

  it('declares each key on the button for assistive tech', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    LABELS.forEach((label, index) => {
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-keyshortcuts')).toBe(`Control+${index + 1}`);
    });
  });

  it('navigates by the item id when a button is pressed', () => {
    const seen = [];
    renderScreen(<NavRail screen="dashboard" onNavigate={(id) => seen.push(id)} />);
    for (const label of LABELS) screen.getByRole('button', { name: label }).click();
    expect(seen).toEqual(SCREEN_ORDER);
  });

  it('gives the Dashboard a gauge, not the tiled grid the Disk Map uses', () => {
    renderScreen(<NavRail screen="settings" onNavigate={() => {}} />);
    const dash = screen.getByRole('button', { name: 'Dashboard' }).querySelector('svg');
    const disk = screen.getByRole('button', { name: 'Disk Map' }).querySelector('svg');
    expect(dash.innerHTML).not.toBe(disk.innerHTML);
    expect(dash.querySelectorAll('rect')).toHaveLength(0);
    expect(disk.querySelectorAll('rect').length).toBeGreaterThan(0);
  });
});

describe('the hover rail', () => {
  // jsdom evaluates no CSS, so what is checkable is which classes carry each
  // state. The behaviour itself -- collapsed at rest, widening over the page
  // on hover or keyboard focus -- is verified live.
  const panelOf = (container) => container.querySelector('nav > div');

  it('reserves a 72px column and widens an overlay panel, never the column itself', () => {
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const nav = container.querySelector('nav');
    expect(classesOf(nav)).toContain('w-[72px]');
    expect(classesOf(nav).join(' ')).not.toMatch(/hover:w-/);
    const panel = panelOf(container);
    expect(classesOf(panel)).toContain('absolute');
    expect(classesOf(panel)).toContain('w-[72px]');
    expect(classesOf(panel)).toContain('hover:w-[200px]');
    expect(classesOf(panel)).toContain('transition-[width]');
  });

  it('also widens for keyboard focus, but not for a click that merely left focus behind', () => {
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const panel = classesOf(panelOf(container));
    expect(panel).toContain('has-[:focus-visible]:w-[200px]');
    expect(panel.join(' ')).not.toMatch(/focus-within:w-/);
  });

  it('never keys layout to the window width any more: one rail, one behaviour', () => {
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    expect(container.innerHTML).not.toContain('min-[1100px]');
  });

  it('always has the label in the row, hidden until the rail opens, and out of the accessible name', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const button = screen.getByRole('button', { name: 'Applications' });
    const rowLabel = [...button.querySelectorAll('span')].find((el) => el.textContent === 'Applications');
    expect(classesOf(rowLabel)).toContain('opacity-0');
    expect(classesOf(rowLabel)).toContain('group-hover/rail:opacity-100');
    expect(classesOf(rowLabel)).toContain('group-has-[:focus-visible]/rail:opacity-100');
    // At rest it overflows the 72px column invisibly; it must not catch clicks meant for the page.
    expect(classesOf(rowLabel)).toContain('pointer-events-none');
    expect(rowLabel.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives the in-row label the room it needs: nothing else sits in the row after it', () => {
    // Regression: a reserved (opacity-0) key hint in the row took ~38px and
    // truncated "Applications" at the 200px rail width.
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const button = screen.getByRole('button', { name: 'Applications' });
    const rowSpans = [...button.children].filter(
      (el) => el.tagName === 'SPAN' && !el.querySelector('svg') && el.textContent !== ''
    );
    expect(rowSpans.map((el) => el.textContent)).toEqual(['Applications']);
  });
});

describe('the active mark', () => {
  // ONE mark that slides to the active row, placed by arithmetic from the row
  // sizes rather than measured. A shared framer-motion layoutId measured each
  // element with getBoundingClientRect and baked the result into a transform,
  // which drifted from the icon beside it at fractional display scaling (150%).
  // Here the mark's `top` is a plain CSS length in the same layout units as the
  // rows, so the two cannot disagree.
  const markOf = (container) => container.querySelector('nav [data-nav-mark]');
  // The offset travels as a custom property (verbatim), so the calc()/cqh form for
  // Settings is checkable in jsdom, which drops units it does not know from a real style.
  const px = (el) => el.style.getPropertyValue('--mark-y');

  it('is a single element, not one per item, and hidden from assistive tech', () => {
    const { container } = renderScreen(<NavRail screen="quarantine" onNavigate={() => {}} />);
    expect(container.querySelectorAll('nav [data-nav-mark]')).toHaveLength(1);
    expect(markOf(container).getAttribute('aria-hidden')).toBe('true');
    // The tint and the 3px edge pill travel together inside it.
    expect(markOf(container).querySelector('span[class*="w-[3px]"]')).toBeTruthy();
    expect(markOf(container).querySelector('span[class*="accent-primary-soft"]')).toBeTruthy();
  });

  it('sits at row N: top padding + N rows of height + gap', () => {
    const rows = ['dashboard', 'diskmap', 'applications', 'quarantine', 'startup', 'duplicates', 'deepclean'];
    rows.forEach((id, index) => {
      const { container, unmount } = renderScreen(<NavRail screen={id} onNavigate={() => {}} />);
      expect(px(markOf(container)), id).toBe(`${24 + index * 52}px`);
      unmount();
    });
  });

  it('sits on Settings by measuring up from the bottom of the rail, where Settings is anchored', () => {
    const { container } = renderScreen(<NavRail screen="settings" onNavigate={() => {}} />);
    expect(px(markOf(container))).toBe('calc(100cqh - 20px)');
  });

  it('slides on the compositor: a transform transition, not a layout one, so a busy main thread cannot freeze it', () => {
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const mark = markOf(container);
    expect(mark.className).toContain('transition-transform');
    expect(mark.className).not.toContain('transition-[top]');
    expect(mark.className).toContain('[transform:translateY(var(--mark-y))]');
    // And the rail is the size container its offset for Settings is measured against.
    expect(container.querySelector('nav > div').className).toContain('[container-type:size]');
  });

  it('moves to the new row when the screen changes, rather than remounting', () => {
    function Harness() {
      const [screenId, setScreenId] = useState('dashboard');
      return (
        <>
          <button type="button" onClick={() => setScreenId('applications')}>go</button>
          <NavRail screen={screenId} onNavigate={() => {}} />
        </>
      );
    }
    const { container } = renderScreen(<Harness />);
    const before = markOf(container);
    expect(px(before)).toBe('24px');
    fireEvent.click(screen.getByText('go'));
    expect(markOf(container)).toBe(before); // same element: that is what lets the CSS transition run
    expect(px(before)).toBe(`${24 + 2 * 52}px`);
  });

  it('is placed from the same numbers the rows are laid out with', () => {
    // The arithmetic above is only right while these classes are. Read from the
    // source so changing a row's size without the mark's constants fails here.
    const src = readFileSync(resolve(process.cwd(), 'src/components/NavRail.jsx'), 'utf8');
    expect(src).toMatch(/flex flex-col items-stretch gap-2 py-6/);      // 8px gap, 24px top and bottom
    expect(src).toMatch(/className=\{`peer relative w-full h-11 /);     // 44px rows
    expect(src).toMatch(/const RAIL_PAD = 24, ROW_HEIGHT = 44, ROW_GAP = 8;/);
  });

  it('marks the active button for assistive tech with aria-current, and only that one', () => {
    renderScreen(<NavRail screen="quarantine" onNavigate={() => {}} />);
    const current = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current.map((b) => b.getAttribute('aria-label'))).toEqual(['Quarantine']);
  });
});

describe('nav buttons under motion', () => {
  it('still expose aria-current on the active item only', () => {
    renderScreen(<NavRail screen="settings" onNavigate={() => {}} />);
    for (const label of LABELS) {
      const button = screen.getByRole('button', { name: label });
      expect(button.getAttribute('aria-current')).toBe(label === 'Settings' ? 'page' : null);
    }
  });
});

describe('the footer slot', () => {
  // Where the update button goes. A slot rather than the button itself,
  // so the rail stays a list of destinations that makes no requests of
  // its own, and App decides what sits at the bottom.
  it('puts what it is given after every destination, pushed to the bottom', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} footer={<button type="button">Update</button>} />);
    const footer = screen.getByRole('button', { name: 'Update' });
    const last = screen.getByRole('button', { name: 'Deep Clean' });

    expect(last.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer.closest('.mt-auto')).toBeTruthy();
  });

  it('puts Settings in the footer, below the update button', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} footer={<button type="button">Update</button>} />);
    const update = screen.getByRole('button', { name: 'Update' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    const last = screen.getByRole('button', { name: 'Deep Clean' });

    expect(settings.closest('.mt-auto')).toBe(update.closest('.mt-auto'));
    expect(last.closest('.mt-auto')).toBeNull();
    expect(update.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('still shows Settings, and nothing else, when there is no update to offer', () => {
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const footerZone = container.querySelector('.mt-auto');
    expect(footerZone.querySelectorAll('button')).toHaveLength(1);
    expect(footerZone.querySelector('button').getAttribute('aria-label')).toBe('Settings');
  });
});

describe('the Report a bug item', () => {
  it('sits in the footer beside Settings and calls its handler', () => {
    const onReportBug = vi.fn();
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} onReportBug={onReportBug} />);
    const report = screen.getByRole('button', { name: 'Report a bug' });
    const settings = screen.getByRole('button', { name: 'Settings' });

    expect(report.closest('.mt-auto')).toBe(settings.closest('.mt-auto'));
    expect(container.querySelector('.mt-auto').querySelectorAll('button')).toHaveLength(2);
    fireEvent.click(report);
    expect(onReportBug).toHaveBeenCalledTimes(1);
  });

  it('is not a screen: no Ctrl+N key and no current state', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} onReportBug={() => {}} />);
    const report = screen.getByRole('button', { name: 'Report a bug' });
    expect(report.getAttribute('aria-keyshortcuts')).toBeNull();
    expect(report.getAttribute('aria-current')).toBeNull();
    expect(report.parentElement.textContent).not.toMatch(/Ctrl\+/);
  });

  it('is absent when nothing handles it', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Report a bug' })).toBeNull();
  });
});
