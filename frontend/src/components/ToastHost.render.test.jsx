// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToasts } from '../hooks/useToasts.jsx';
import ToastHost from './ToastHost.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** Where toasts are drawn, and the provider that feeds it.
 *
 * lib/toastQueue.js is unit-tested -- what counts as a duplicate, what is
 * allowed to expire. Neither the provider nor this component had a test,
 * and between them sit the decisions that matter to somebody who is not
 * looking at the screen: which toasts interrupt a screen reader, whether
 * a repeated failure stacks or counts, and whether a toast in the corner
 * blocks the button underneath it.
 */

afterEach(cleanup);

/** A control that pushes one toast, so the provider is exercised through
 * its real API rather than by handing ToastHost a fixture array. */
function Push({ tone = 'info', message = 'Done', extra }) {
  const toasts = useToasts();
  const send = {
    info: toasts.info, success: toasts.success, warning: toasts.warn, danger: toasts.error
  }[tone];
  return <button type="button" onClick={() => send(message, extra)}>push</button>;
}

const mount = (ui) => render(
  <ToastProvider>
    {ui}
    <ToastHost />
  </ToastProvider>
);

const push = async (times = 1) => {
  const user = userEvent.setup();
  for (let i = 0; i < times; i += 1) await user.click(screen.getByText('push'));
};

describe('showing a toast', () => {
  it('draws what was pushed', async () => {
    mount(<Push message="Cleanup complete. Freed 2.4 GB." />);
    await push();

    expect(screen.getByText('Cleanup complete. Freed 2.4 GB.')).toBeTruthy();
  });

  it('renders into the body rather than where it was written', async () => {
    // Same containing-block trap as the modal and the treemap tooltip:
    // backdrop-filter on .glass-panel captures fixed-position children.
    const { container } = mount(<Push />);
    await push();

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(document.body.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows the detail line and the paths behind a count', async () => {
    // "Skipped 3 locked files" invites "which ones", and this is the
    // answer without a second click.
    mount(<Push tone="danger" message="Skipped 3 locked files" extra={{
      detail: 'They were in use.',
      paths: ['C:\\a.log', 'C:\\b.log']
    }} />);
    await push();

    expect(screen.getByText('They were in use.')).toBeTruthy();
    expect(screen.getByText('C:\\a.log')).toBeTruthy();
    expect(screen.getByText('C:\\b.log')).toBeTruthy();
  });
});

describe('what can be copied', () => {
  // Text selection is off across the app. A toast's text stays on: an
  // error toast's message is often the error itself, and its paths are
  // exactly what somebody goes looking for next.
  it('everything the toast says, but not its dismiss button', async () => {
    mount(<Push tone="danger" message="Skipped 2 locked files" extra={{
      detail: 'They were in use.',
      paths: ['C:\\a.log', 'C:\\b.log']
    }} />);
    await push();

    expect(isCopyable(screen.getByText('Skipped 2 locked files'))).toBe(true);
    expect(isCopyable(screen.getByText('They were in use.'))).toBe(true);
    expect(isCopyable(screen.getByText('C:\\a.log'))).toBe(true);
    expect(isCopyable(screen.getByRole('button', { name: 'Dismiss notification' }))).toBe(false);
  });
});

describe('what interrupts and what does not', () => {
  it('announces a failure assertively', async () => {
    // Someone who looked away must still find out that three files were
    // not cleaned.
    mount(<Push tone="danger" message="Could not remove 3 files" />);
    await push();

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('assertive');
  });

  it('mentions a success politely, without cutting in', async () => {
    // A screen reader interrupting to say "freed 2.4 GB" is worse than
    // silence. The distinction is the whole reason the attribute is
    // computed rather than fixed.
    mount(<Push tone="success" message="Freed 2.4 GB" />);
    await push();

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});

describe('the same thing happening twice', () => {
  it('counts it rather than stacking identical cards', async () => {
    // Four identical cards in the corner is not four pieces of
    // information.
    mount(<Push message="Could not remove file" />);
    await push(3);

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('×3')).toBeTruthy();
  });

  it('does not show a count for something that happened once', async () => {
    // "×1" is noise on every toast in the app.
    mount(<Push message="Could not remove file" />);
    await push();

    expect(screen.queryByText(/^×/)).toBeNull();
  });
});

describe('dismissing', () => {
  it('takes the toast out of the queue', async () => {
    /* Asserted on the provider's own list rather than on the DOM.
     * AnimatePresence keeps the exiting card mounted until its exit
     * animation finishes, and framer-motion does not run that to
     * completion under jsdom -- so a DOM assertion here would fail
     * against correct code. The list is what every other consumer reads,
     * and it is what the dismiss button is actually for. */
    function Count() {
      const { toasts } = useToasts();
      return <span data-testid="count">{toasts.length}</span>;
    }

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Push message="Freed 2.4 GB" />
        <Count />
        <ToastHost />
      </ToastProvider>
    );
    await user.click(screen.getByText('push'));
    expect(screen.getByTestId('count').textContent).toBe('1');

    await user.click(screen.getByLabelText('Dismiss notification'));

    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});

describe('what the corner does to the app underneath', () => {
  it('lets clicks through the empty space around the cards', async () => {
    /* The container fills the bottom-right corner whether or not there is
     * a toast in it. Catching pointer events there would leave an
     * invisible rectangle over whatever button sits in that corner --
     * only the cards themselves are allowed to be clickable. */
    mount(<Push />);
    await push();

    const container = document.body.querySelector('[role="status"]').parentElement;
    expect(container.className).toMatch(/pointer-events-none/);
    expect(screen.getByRole('status').className).toMatch(/pointer-events-auto/);
  });
});

describe('outside a provider', () => {
  it('does not crash the screen it was rendered on', () => {
    /* useToasts returns a no-op set rather than throwing. A missing
     * provider should not be able to take down a screen over a piece of
     * feedback -- and several components are rendered in tests without
     * one. */
    expect(() => render(<ToastHost />)).not.toThrow();
    expect(document.body.querySelector('[role="status"]')).toBeNull();
  });
});

describe('expiry', () => {
  /* Two halves of one rule. A confirmation the user did not need to read
   * should not need dismissing; a failure they may have missed must
   * still be there when they look back.
   *
   * Counted through the provider for the same reason dismissal is: the
   * expired card stays mounted while an exit animation that never
   * finishes under jsdom plays out. */
  function Count() {
    const { toasts } = useToasts();
    return <span data-testid="count">{toasts.length}</span>;
  }

  const afterThirtySeconds = async (tone) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Push tone={tone} message="Something happened" />
        <Count />
        <ToastHost />
      </ToastProvider>
    );
    await user.click(screen.getByText('push'));
    expect(screen.getByTestId('count').textContent).toBe('1');

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    return screen.getByTestId('count').textContent;
  };

  it('takes an ordinary toast away on its own', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      expect(await afterThirtySeconds('success')).toBe('0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never takes a failure away', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      expect(await afterThirtySeconds('danger')).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });
});
