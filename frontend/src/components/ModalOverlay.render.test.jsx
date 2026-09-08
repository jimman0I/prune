// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalOverlay from './ModalOverlay.jsx';

/** The shell every dialog in this app sits in.
 *
 * The behaviour here is invisible when it works and dangerous when it
 * does not. Before this component existed, Tab from an open uninstall
 * dialog moved focus into the program list BEHIND it -- so the user was
 * driving the table they were about to delete from, with no focus ring to
 * tell them, while the dialog was still up.
 *
 * lib/focusTrap.js is unit-tested (which elements count, where the index
 * wraps). What is tested here is that the dialog actually consults it,
 * and the three decisions that live in this file rather than that one:
 * Escape is conditional, the backdrop is inert, and focus goes back where
 * it came from.
 */

afterEach(cleanup);

/* jsdom performs no layout, so `offsetParent` is null on every element --
 * and visibleFocusable reads null as "not visible". Left alone, the trap
 * finds nothing to cycle through and takes its empty-set branch instead,
 * which parks focus on the dialog container.
 *
 * That is not merely inconvenient: it would make "never reaches the page
 * behind" pass VACUOUSLY, since the empty-set branch also keeps focus
 * inside. The wrap would be untested and the file would look green.
 *
 * Stubbed to the nearest thing jsdom can answer honestly -- attached to
 * the document and not hidden -- which is what the real property means
 * for the ordinary controls a dialog contains. */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.hidden || !this.isConnected ? null : document.body;
    }
  });
});

afterAll(() => {
  delete HTMLElement.prototype.offsetParent;
});

/** Waits for the dialog's own opening focus to land.
 *
 * The component moves focus in a frame after mount, so anything that
 * positions focus by hand has to happen AFTER that or it is silently
 * undone. This was a real flake rather than a theoretical one: the
 * backwards-wrap test passed on its own and failed in the full suite,
 * because the frame landed after the Tab instead of before it.
 *
 * An earlier version of this waited on `document.activeElement` being
 * truthy, which <body> satisfies -- so it waited for nothing at all. */
const waitForInitialFocus = () => waitFor(() => {
  expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
});

/** A dialog with three focusable controls and a button outside it, which
 * is what a trap has to fail to reach. */
function Fixture({ onClose = () => {}, dismissible = true } = {}) {
  return (
    <>
      <button type="button">outside</button>
      <ModalOverlay label="Remove Steam" onClose={onClose} dismissible={dismissible}>
        <div>
          <button type="button">first</button>
          <button type="button">second</button>
          <button type="button">last</button>
        </div>
      </ModalOverlay>
    </>
  );
}

describe('the dialog itself', () => {
  it('announces itself as a modal dialog with a name', () => {
    // Without the role there is nothing telling a screen reader that the
    // rest of the app is unavailable, and the label is the only thing
    // saying WHICH dialog opened.
    render(<Fixture />);
    const dialog = screen.getByRole('dialog');

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Remove Steam');
  });

  it('renders into the body rather than where it was written', () => {
    /* A portal, because `backdrop-filter` on .glass-panel makes that panel
     * the containing block for any fixed-position descendant -- so a
     * dialog rendered inside one is positioned against the PANEL, not the
     * viewport. This codebase has hit that twice already, in the treemap
     * tooltip and the nav rail's labels. */
    const { container } = render(<Fixture />);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('is a real box, not display:contents', () => {
    // The tidy way to let the child own its width would be
    // `display: contents` on this element -- but an element with
    // display:contents can be dropped from the accessibility tree, and
    // dropping the one carrying role="dialog" defeats the point.
    render(<Fixture />);
    expect(screen.getByRole('dialog').className).not.toMatch(/contents/);
  });
});

describe('where focus goes', () => {
  it('moves into the dialog when it opens', async () => {
    // Queued a frame out in the component, because on the first paint the
    // panel is often still empty.
    render(<Fixture />);

    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });
  });

  it('gives focus back to whatever had it when the dialog closes', async () => {
    /* Without this, closing a dialog drops focus to <body> and the next
     * Tab starts from the top of the app rather than from the row the
     * user was on. */
    render(<button type="button">opener</button>);
    const opener = screen.getByText('opener');
    opener.focus();

    const { unmount } = render(
      <ModalOverlay label="Remove Steam" onClose={() => {}}>
        <button type="button">first</button>
      </ModalOverlay>
    );
    await waitFor(() => expect(document.activeElement).not.toBe(opener));

    unmount();
    expect(document.activeElement).toBe(opener);
  });
});

describe('Tab', () => {
  it('wraps from the last control back to the first', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await waitForInitialFocus();

    screen.getByText('last').focus();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('wraps backwards from the first control to the last', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await waitForInitialFocus();

    screen.getByText('first').focus();
    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('never reaches the page behind the dialog', async () => {
    /* The property this component was written for. Four tabs from the
     * last control is more than a full cycle of the three inside, so if
     * anything leaks out it will have left by now. */
    const user = userEvent.setup();
    render(<Fixture />);
    await waitForInitialFocus();
    const outside = screen.getByText('outside');

    screen.getByText('last').focus();
    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      expect(document.activeElement).not.toBe(outside);
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    }
  });
});

describe('the ways out', () => {
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Fixture onClose={onClose} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while the dialog says it is not dismissible', async () => {
    /* False while a removal is actually running. Escape closing a dialog
     * mid-uninstall would hide a process that is still going -- the user
     * would be left with no way to see whether their files came back, and
     * no indication anything was still happening. */
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Fixture onClose={onClose} dismissible={false} />);

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT close when the backdrop is clicked', async () => {
    /* Deliberate, and the opposite of what most dialogs do. Every dialog
     * this wraps is destructive or reports the result of something
     * destructive, and a stray click landing outside a 680px panel should
     * not throw away a leftover review the user has been reading. */
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Fixture onClose={onClose} />);

    // The scrim: the portal's outermost element, which is what a click
    // outside the panel lands on.
    await user.click(document.body.querySelector('.fixed.inset-0'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
