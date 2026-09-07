// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import NavRail from './NavRail.jsx';

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

const LABELS = ['Dashboard', 'Disk Map', 'Applications', 'Quarantine', 'Settings', 'Startup', 'Duplicates', 'Deep Clean'];

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
  it('names every destination', () => {
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);
    for (const label of LABELS) {
      expect(flyoutFor(label).flyout.textContent).toBe(label);
    }
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
