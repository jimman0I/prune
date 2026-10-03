// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen, makeTestClient } from '../testSupport/renderScreen.jsx';
import { ToastProvider, useToasts } from './useToasts.jsx';
import ToastHost from '../components/ToastHost.jsx';
import { useQuarantineUndo } from './useQuarantineUndo.js';
import { keys } from '../lib/queryClient.js';

/** Undo on the toast that reports a move into Quarantine: it restores through
 * the same API the Quarantine screen uses, says what happened, and says so
 * plainly when the batch is gone. */

const restoreQuarantineBatch = vi.fn();
vi.mock('../lib/api.js', () => ({
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

function Trigger({ batches, options, message = 'Moved 8 MB to Quarantine.' }) {
  const offerUndo = useQuarantineUndo();
  return <button type="button" onClick={() => offerUndo(message, batches, options)}>move</button>;
}

/** How many Undo buttons are in the queue. Counted on the provider's list rather
 * than the DOM: AnimatePresence keeps a leaving card mounted until its exit
 * animation ends, which jsdom does not run to completion. */
function Pending() {
  const { toasts } = useToasts();
  return <span data-testid="pending-undos">{toasts.filter((t) => t.action).length}</span>;
}

const mount = (props, client = makeTestClient()) => renderScreen(
  <ToastProvider>
    <Trigger {...props} />
    <Pending />
    <ToastHost />
  </ToastProvider>,
  { client }
);

const toastWith = (text) => screen.getAllByRole('status').find((el) => within(el).queryByText(text, { exact: false }));

beforeEach(() => {
  vi.clearAllMocks();
  restoreQuarantineBatch.mockResolvedValue({});
});

describe('the toast after a move', () => {
  it('carries an Undo button', async () => {
    const user = userEvent.setup();
    mount({ batches: ['C:\\q\\1-a'] });
    await user.click(screen.getByText('move'));
    expect(within(toastWith('Moved 8 MB')).getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('is a plain toast when nothing went to Quarantine', async () => {
    const user = userEvent.setup();
    mount({ batches: [] });
    await user.click(screen.getByText('move'));
    expect(within(toastWith('Moved 8 MB')).queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('keeps the detail the caller gave it', async () => {
    const user = userEvent.setup();
    mount({ batches: ['C:\\q\\1-a'], options: { detail: 'You can restore it from Quarantine.' } });
    await user.click(screen.getByText('move'));
    expect(screen.getByText('You can restore it from Quarantine.')).toBeTruthy();
  });
});

describe('pressing Undo', () => {
  it('restores every batch through the Quarantine API, in order', async () => {
    const user = userEvent.setup();
    mount({ batches: ['C:\\q\\1-a', 'C:\\q\\2-b'] });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledTimes(2));
    expect(restoreQuarantineBatch.mock.calls.map((c) => c[0])).toEqual(['C:\\q\\1-a', 'C:\\q\\2-b']);
  });

  it('says it was put back', async () => {
    const user = userEvent.setup();
    mount({ batches: ['C:\\q\\1-a'] });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Restored from Quarantine.')).toBeTruthy();
  });

  it('uses the caller\'s own wording for the result when it has one', async () => {
    const user = userEvent.setup();
    mount({ batches: ['C:\\q\\1-a'], options: { doneMessage: 'Restored Photos.' } });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Restored Photos.')).toBeTruthy();
  });

  it('removes the Undo toast, so it cannot be pressed twice', async () => {
    const user = userEvent.setup();
    mount({ batches: ['C:\\q\\1-a'] });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText('Restored from Quarantine.');
    expect(screen.getByTestId('pending-undos').textContent).toBe('0');
    expect(restoreQuarantineBatch).toHaveBeenCalledTimes(1);
  });

  it('tells the Quarantine screen and the callers\' own views to read again', async () => {
    const user = userEvent.setup();
    const client = makeTestClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const onRestored = vi.fn();
    mount({ batches: ['C:\\q\\1-a'], options: { onRestored } }, client);
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith(['C:\\q\\1-a']));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.quarantine });
  });

  it('says plainly when the batch is no longer in Quarantine', async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    restoreQuarantineBatch.mockRejectedValue(new Error("ENOENT: no such file or directory, open 'manifest.json'"));
    mount({ batches: ['C:\\q\\1-a'], options: { onRestored } });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("This is no longer in Quarantine, so it can't be restored.")).toBeTruthy();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('says how many came back when only some could', async () => {
    const user = userEvent.setup();
    restoreQuarantineBatch
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));
    mount({ batches: ['C:\\q\\1-a', 'C:\\q\\2-b'] });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Put back 1 of 2. The rest are no longer in Quarantine.')).toBeTruthy();
  });

  it('reports a failure with its reason, and does not call it gone', async () => {
    const user = userEvent.setup();
    restoreQuarantineBatch.mockRejectedValue(new Error('EPERM: operation not permitted'));
    mount({ batches: ['C:\\q\\1-a'] });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("Couldn't restore: EPERM: operation not permitted")).toBeTruthy();
    expect(screen.queryByText(/no longer in Quarantine/)).toBeNull();
  });

  it('keeps what could not be put back on screen until it is dismissed', async () => {
    const user = userEvent.setup();
    restoreQuarantineBatch.mockRejectedValue(new Error('ENOENT: no such file or directory'));
    mount({ batches: ['C:\\q\\1-a'] });
    await user.click(screen.getByText('move'));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    const notice = await screen.findByText("This is no longer in Quarantine, so it can't be restored.");
    expect(notice).toBeTruthy();
    // A warning: persistent by the queue's own rule.
    expect(notice.closest('[role="status"]')).toBeTruthy();
  });

  it('writes the button and the results in the chosen language', async () => {
    const user = userEvent.setup();
    const api = await import('../lib/api.js');
    api.fetchSettings.mockResolvedValue({ language: 'de' });
    mount({ batches: ['C:\\q\\1-a'] });
    await user.click(screen.getByText('move'));
    await user.click(await screen.findByRole('button', { name: 'Rückgängig' }));
    expect(await screen.findByText('Aus der Quarantäne wiederhergestellt.')).toBeTruthy();
  });
});
