// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContextMenu from './ContextMenu.jsx';

/** The menu a right-click opens on a treemap block.
 *
 * Small, and every one of its behaviours has already gone wrong once. It
 * has to close on four separate signals, position itself so its items are
 * actually on screen, and disappear completely rather than leaving an
 * invisible rectangle behind -- which is exactly what it used to do.
 */

afterEach(cleanup);

const ITEMS = [
  { label: 'Open folder', hint: 'Enter', onSelect: vi.fn() },
  { label: 'Copy path', onSelect: vi.fn() },
  { label: 'Delete', danger: true, onSelect: vi.fn() },
  { label: 'Restore', disabled: true, onSelect: vi.fn() }
];

const open = (props = {}) => {
  const onClose = props.onClose || vi.fn();
  const result = render(
    <ContextMenu open={props.open ?? true} x={props.x ?? 100} y={props.y ?? 100}
      items={props.items || ITEMS} onClose={onClose} />
  );
  return { ...result, onClose };
};

describe('what it shows', () => {
  it('lists every item as a menu item', () => {
    open();
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
    expect(screen.getByText('Open folder')).toBeTruthy();
  });

  it('shows the keyboard hint beside the item that has one', () => {
    open();
    expect(screen.getByText('Enter')).toBeTruthy();
  });

  it('renders nothing at all while closed', () => {
    open({ open: false });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders into the body rather than where it was written', () => {
    // The treemap sits inside a .glass-panel, whose backdrop-filter makes
    // it the containing block for any fixed-position descendant -- so a
    // menu rendered in place would be positioned against the panel.
    const { container } = open();

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.body.querySelector('[role="menu"]')).toBeTruthy();
  });
});

describe('choosing an item', () => {
  it('closes the menu and then runs it', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { onClose } = open({ items: [{ label: 'Copy path', onSelect }] });

    await user.click(screen.getByText('Copy path'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an item that is disabled', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { onClose } = open({ items: [{ label: 'Restore', disabled: true, onSelect }] });

    await user.click(screen.getByText('Restore'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('the four ways it closes', () => {
  it('closes on Escape', () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a click anywhere else in the app', () => {
    // A menu that survives the next click is a menu people close by
    // clicking twice.
    const { onClose } = open();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT close on a click inside itself', () => {
    // Otherwise the menu closes before the item it was clicked on can
    // run, which is the same as having no menu.
    const { onClose } = open();
    fireEvent.pointerDown(screen.getByText('Copy path'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the page scrolls under it', () => {
    // It is anchored to a point in the viewport, and the content that
    // point referred to has just moved away.
    const { onClose } = open();
    fireEvent.scroll(window);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the window is resized', () => {
    const { onClose } = open();
    fireEvent.resize(window);
    expect(onClose).toHaveBeenCalled();
  });

  it('stops listening once it is closed', () => {
    // The listeners are hung on the document, so a menu that never
    // unsubscribes keeps closing itself forever -- and keeps calling
    // onClose on every scroll of every other screen.
    const { onClose } = open({ open: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.scroll(window);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('where it lands', () => {
  const positionOf = () => {
    const style = document.body.querySelector('[role="menu"]').style;
    return { left: parseInt(style.left, 10), top: parseInt(style.top, 10) };
  };

  it('opens at the cursor when there is room', () => {
    open({ x: 100, y: 100 });
    expect(positionOf()).toEqual({ left: 100, top: 100 });
  });

  it('pulls itself back inside the window near the right edge', () => {
    // 210px wide, so a menu opened 40px from the right edge would put
    // most of itself off screen.
    open({ x: window.innerWidth - 40, y: 100 });
    const { left } = positionOf();

    expect(left).toBeLessThanOrEqual(window.innerWidth - 210);
  });

  it('pulls itself up near the bottom edge', () => {
    /* Right-clicking near the bottom is the common case rather than the
     * exotic one -- the treemap fills the screen -- and a menu whose
     * items are below the fold is a menu with no items. */
    open({ x: 100, y: window.innerHeight - 10 });
    const { top } = positionOf();

    expect(top).toBeLessThan(window.innerHeight - 10);
    expect(top).toBeGreaterThanOrEqual(8);
  });

  it('never goes off the top or left, whatever it was given', () => {
    // The clamp above subtracts the menu's own size, which for a tall
    // menu in a short window produces a negative number.
    open({ x: -500, y: -500 });
    const { left, top } = positionOf();

    expect(left).toBeGreaterThanOrEqual(8);
    expect(top).toBeGreaterThanOrEqual(8);
  });
});

/* Not asserted here: that a dismissed menu leaves nothing behind.
 *
 * AnimatePresence tracks its children BY KEY, and without one it cannot
 * tell that this child has left. The symptom is not a missing animation:
 * the element stays in the DOM at opacity 0 with pointer-events auto, so
 * a dismissed menu leaves an invisible 210px rectangle swallowing clicks
 * over the treemap. It was caught live -- Escape cleared the state and
 * the node stayed -- and `key="context-menu"` is the fix.
 *
 * A test for it was written and then removed, because it did not work:
 * framer-motion 13 unmounts the child under jsdom whether or not the key
 * is there, so closing the menu and waiting for the node to go passed
 * identically against a version with the key deleted. Confirmed by
 * deleting it and watching all seventeen tests stay green.
 *
 * A green test that cannot fail is worse than no test, so there is none.
 * The behaviour is verified by right-clicking the treemap in the real
 * window and clicking where the menu was.
 */
