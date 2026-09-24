// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
  it('names every destination and the key that goes to it', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    LABELS.forEach((label, index) => {
      // "Dashboard" + "Ctrl+1": the icon-only rail's tooltip is the one
      // place its key is shown.
      expect(flyoutFor(label).flyout.textContent).toBe(`${label}Ctrl+${index + 1}`);
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

describe('the two rail widths', () => {
  // jsdom evaluates no CSS, so what is checkable is which classes carry each
  // state. The behaviour itself -- the switch at 1100px of window width --
  // is a media query Tailwind emits from `min-[1100px]:`, verified live.
  it('is icons only by default and widens from 1100px', () => {
    const { container } = renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const nav = container.querySelector('nav');
    expect(classesOf(nav)).toContain('w-[72px]');
    expect(classesOf(nav)).toContain('min-[1100px]:w-[200px]');
  });

  it('prints the label in the row only when wide, and keeps it out of the accessible name', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const button = screen.getByRole('button', { name: 'Applications' });
    const rowLabel = [...button.querySelectorAll('span')].find((el) => el.textContent === 'Applications');
    expect(classesOf(rowLabel)).toContain('hidden');
    expect(classesOf(rowLabel)).toContain('min-[1100px]:block');
    // The button's name is its aria-label; the printed copy is decoration.
    expect(rowLabel.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps only the key in the flyout when wide, since the name is already in the row', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    LABELS.forEach((label, index) => {
      const { flyout } = flyoutFor(label);
      const [name, key] = flyout.children;
      expect(name.textContent).toBe(label);
      expect(classesOf(name)).toContain('min-[1100px]:hidden');
      expect(key.textContent).toBe(`Ctrl+${index + 1}`);
      expect(classesOf(key)).not.toContain('min-[1100px]:hidden');
      // Still the hover / keyboard-focus tooltip, not a permanent chip.
      expect(classesOf(flyout)).toContain('opacity-0');
      expect(classesOf(flyout)).not.toContain('min-[1100px]:hidden');
    });
  });

  it('gives the in-row label the room it needs: nothing else sits in the row after it', () => {
    // Regression: a reserved (opacity-0) key hint in the row took ~38px and
    // truncated "Applications" at the 200px rail width.
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    const button = screen.getByRole('button', { name: 'Applications' });
    const rowSpans = [...button.children].filter((el) => el.tagName === 'SPAN' && !el.querySelector('svg'));
    expect(rowSpans.map((el) => el.textContent)).toEqual(['Applications']);
  });
});

describe('the active mark', () => {
  it('is a 3px pill on the active item only, alongside the sliding tint', () => {
    const { container } = renderScreen(<NavRail screen="quarantine" onNavigate={() => {}} />);
    const pills = container.querySelectorAll('span[class*="w-[3px]"]');
    expect(pills).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Quarantine' }).contains(pills[0])).toBe(true);
    expect(pills[0].getAttribute('aria-hidden')).toBe('true');
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
