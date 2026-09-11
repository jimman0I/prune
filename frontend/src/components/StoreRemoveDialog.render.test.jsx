// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The single-app Store removal dialog.
 *
 * It shipped in 2.3.0 with no tests of its own -- ProgramList's tests
 * covered the handoff to it, nothing covered the dialog. Found while
 * adding Store apps to the batch, along with a real gap: every other
 * removal in the app is logged to the dashboard's history, and this one
 * was not. A batch that logged Store removals while this dialog did not
 * would make the same action leave a record or not depending on how many
 * apps were ticked.
 */

const removeStoreApp = vi.fn();
const appendHistoryEntry = vi.fn(async () => {});
vi.mock('../lib/api.js', () => ({
  removeStoreApp: (...a) => removeStoreApp(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a)
}));

const StoreRemoveDialog = (await import('./StoreRemoveDialog.jsx')).default;

const app = {
  id: 'store:Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe',
  name: 'Calculator', publisher: 'Microsoft Corporation', sizeBytes: 4096,
  packageFullName: 'Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe'
};

beforeEach(() => { vi.clearAllMocks(); });

const open = (props = {}) => {
  const onClose = props.onClose || vi.fn();
  const onRemoved = props.onRemoved || vi.fn();
  renderScreen(<StoreRemoveDialog app={app} onClose={onClose} onRemoved={onRemoved} />);
  return { onClose, onRemoved };
};

describe('what can be copied', () => {
  it("Windows' reason for refusing, and the package name it refused", async () => {
    // The package name is what Remove-AppxPackage takes, so it is the
    // thing to paste into PowerShell when Prune cannot do it.
    removeStoreApp.mockRejectedValue(new Error('The package is currently in use.'));
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole('button', { name: 'Remove app' }));

    expect(isCopyable(await screen.findByText('The package is currently in use.'))).toBe(true);
    expect(isCopyable(screen.getByText(app.packageFullName))).toBe(true);
  });
});

describe('removing one Store app', () => {
  it('says it cannot be undone before asking', () => {
    open();
    expect(screen.getByText(/cannot be restored from here/i)).toBeTruthy();
    expect(removeStoreApp).not.toHaveBeenCalled();
  });

  it('removes it by its package name, and only on the confirm', async () => {
    removeStoreApp.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { onRemoved } = open();

    await user.click(screen.getByRole('button', { name: 'Remove app' }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(removeStoreApp).toHaveBeenCalledWith(app.packageFullName);
  });

  it('logs the removal to history, the way every other removal is', async () => {
    removeStoreApp.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    open();

    await user.click(screen.getByRole('button', { name: 'Remove app' }));

    await waitFor(() => expect(appendHistoryEntry).toHaveBeenCalledTimes(1));
    expect(appendHistoryEntry).toHaveBeenCalledWith({
      programName: 'Calculator', publisher: 'Microsoft Corporation', sizeBytes: 4096
    });
  });

  it('shows Windows\' own reason when it refuses, and logs nothing', async () => {
    removeStoreApp.mockRejectedValue(new Error('The package is currently in use.'));
    const user = userEvent.setup();
    const { onRemoved } = open();

    await user.click(screen.getByRole('button', { name: 'Remove app' }));

    expect(await screen.findByText('The package is currently in use.')).toBeTruthy();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(appendHistoryEntry).not.toHaveBeenCalled();
  });

  it('does not let a history failure turn a removal into an error', async () => {
    /* The app is gone either way. The same rule the uninstall dialogs
     * already follow: logging must never fail a removal that worked. */
    removeStoreApp.mockResolvedValue({ ok: true });
    appendHistoryEntry.mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    const { onRemoved } = open();

    await user.click(screen.getByRole('button', { name: 'Remove app' }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/disk full/)).toBeNull();
  });
});
