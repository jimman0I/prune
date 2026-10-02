// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** "Shred files..." -- choose, confirm, shred, report.
 *
 * Nothing here touches a file: the API is mocked. What is pinned is the
 * order of events (nothing is shredded before the confirmation step has
 * said what will be destroyed and that it cannot be undone), that a
 * protected path is reported rather than hidden, and that Stop is real. */

const previewShred = vi.fn();
const streamShred = vi.fn();
const fetchSettings = vi.fn(async () => ({ overwritePasses: 1 }));

vi.mock('../lib/api.js', () => ({
  previewShred: (...a) => previewShred(...a),
  streamShred: (...a) => streamShred(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p)
}));

const ShredDialog = (await import('./ShredDialog.jsx')).default;

const onClose = vi.fn();
const open = () => renderScreen(<ShredDialog onClose={onClose} />);
const textbox = () => screen.getByRole('textbox', { name: 'Paths, one per line' });

/** ModalOverlay moves focus into the dialog one animation frame after it opens;
 * typing during that frame would lose the rest of the text to the focus move. */
const settle = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

async function addTyped(user, text) {
  await settle();
  await user.type(textbox(), text);
  await user.click(screen.getByRole('button', { name: 'Add to list' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  previewShred.mockResolvedValue({ files: 2, bytes: 6, refused: [], refusedCount: 0, truncated: false });
  streamShred.mockImplementation(async (paths, passes, onEvent) => {
    onEvent('start', { passes });
    onEvent('done', { passes, shreddedFiles: 2, bytes: 6, aborted: false, failed: [], failedCount: 0, held: [], heldCount: 0 });
  });
});
afterEach(() => { delete window.pruneWindow; });

describe('choosing', () => {
  it('opens as a dialog that says shredded items cannot be recovered, and why overwriting can fail', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Shred files and folders' });
    expect(within(dialog).getByText(/cannot be recovered/)).toBeTruthy();
    expect(within(dialog).getByText(/not reliable on SSDs/)).toBeTruthy();
    expect(within(dialog).getByText('Nothing chosen yet.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Continue' }).disabled).toBe(true);
  });

  it('adds typed paths, one per line, and lets each be removed', async () => {
    const user = userEvent.setup();
    open();
    await addTyped(user, 'C:\\a.txt{Enter}D:\\b.txt');
    expect(screen.getByText('C:\\a.txt')).toBeTruthy();
    expect(screen.getByText('D:\\b.txt')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove C:\\a.txt from the list' }));
    expect(screen.queryByText('C:\\a.txt')).toBeNull();
    expect(screen.getByText('D:\\b.txt')).toBeTruthy();
  });

  it('does not add the same path twice, nor a blank line', async () => {
    const user = userEvent.setup();
    open();
    await addTyped(user, 'C:\\a.txt{Enter}{Enter}c:\\A.TXT');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('offers the native chooser buttons only where the bridge exists', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Choose files…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose folders…' })).toBeNull();
  });

  it('asks the main process for files, and for folders', async () => {
    const pickPaths = vi.fn(async (kind) => (kind === 'files' ? ['C:\\f1.txt'] : ['C:\\Folder']));
    window.pruneWindow = { pickPaths };
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Choose files…' }));
    await user.click(screen.getByRole('button', { name: 'Choose folders…' }));
    expect(pickPaths.mock.calls.map((c) => c[0])).toEqual(['files', 'folders']);
    expect(await screen.findByText('C:\\f1.txt')).toBeTruthy();
    expect(await screen.findByText('C:\\Folder')).toBeTruthy();
  });

  it('takes dropped files and folders, resolving their real paths through the bridge', async () => {
    window.pruneWindow = { pathForFile: (file) => `C:\\dropped\\${file.name}` };
    open();
    const zone = screen.getByTestId('shred-dropzone');
    const file = new File(['x'], 'photo.jpg');
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(await screen.findByText('C:\\dropped\\photo.jpg')).toBeTruthy();
  });
});

describe('confirming', () => {
  async function chooseAndContinue(user) {
    await addTyped(user, 'C:\\a.txt{Enter}D:\\b.txt');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
  }

  it('shows what will be destroyed before anything is shredded', async () => {
    const user = userEvent.setup();
    open();
    await chooseAndContinue(user);
    expect(previewShred).toHaveBeenCalledWith(['C:\\a.txt', 'D:\\b.txt']);
    expect(await screen.findByText('Shred these permanently?')).toBeTruthy();
    expect(screen.getByText(/Files to shred: 2 \(6 B\)/)).toBeTruthy();
    expect(screen.getByText(/cannot be recovered/)).toBeTruthy();
    expect(streamShred).not.toHaveBeenCalled();
  });

  it('lists the protected paths it will leave alone, with the reason', async () => {
    previewShred.mockResolvedValue({
      files: 1, bytes: 3, truncated: false, refusedCount: 1,
      refused: [{ path: 'C:\\Windows', reason: 'That is Windows itself.' }]
    });
    const user = userEvent.setup();
    open();
    await chooseAndContinue(user);
    expect(await screen.findByText('Left alone because they are protected: 1')).toBeTruthy();
    expect(screen.getByText('C:\\Windows')).toBeTruthy();
    expect(screen.getByText('That is Windows itself.')).toBeTruthy();
  });

  it('says when the count stopped early', async () => {
    previewShred.mockResolvedValue({ files: 250000, bytes: 1e9, refused: [], refusedCount: 0, truncated: true });
    const user = userEvent.setup();
    open();
    await chooseAndContinue(user);
    expect(await screen.findByText(/count stopped early/)).toBeTruthy();
  });

  it('Cancel goes back to the list without shredding', async () => {
    const user = userEvent.setup();
    open();
    await chooseAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(streamShred).not.toHaveBeenCalled();
    expect(screen.getByText('C:\\a.txt')).toBeTruthy();
  });

  it('cannot continue when there is nothing left to shred', async () => {
    previewShred.mockResolvedValue({
      files: 0, bytes: 0, truncated: false, refusedCount: 1,
      refused: [{ path: 'C:\\Windows', reason: 'That is Windows itself.' }]
    });
    const user = userEvent.setup();
    open();
    await addTyped(user, 'C:\\Windows');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('button', { name: 'Shred permanently' });
    expect(confirm.disabled).toBe(true);
  });

  it('reports a failed preview instead of hanging', async () => {
    previewShred.mockRejectedValue(new Error('Give at most 2000 paths at once.'));
    const user = userEvent.setup();
    open();
    await chooseAndContinue(user);
    expect(await screen.findByText('Shredding failed: Give at most 2000 paths at once.')).toBeTruthy();
  });
});

describe('shredding', () => {
  async function toConfirm(user) {
    await addTyped(user, 'C:\\a.txt{Enter}D:\\b.txt');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    return screen.findByRole('button', { name: 'Shred permanently' });
  }

  it('sends the paths and the passes, then reports what happened', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await toConfirm(user));
    await waitFor(() => expect(streamShred).toHaveBeenCalled());
    expect(streamShred.mock.calls[0][0]).toEqual(['C:\\a.txt', 'D:\\b.txt']);
    expect(streamShred.mock.calls[0][1]).toBe(1);
    expect(await screen.findByText('Done. Files shredded: 2 (6 B).')).toBeTruthy();
  });

  it('uses 3 passes when that is chosen', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: /3 passes/ }));
    await user.click(await toConfirm(user));
    await waitFor(() => expect(streamShred).toHaveBeenCalled());
    expect(streamShred.mock.calls[0][1]).toBe(3);
  });

  it('starts on the passes the setting names', async () => {
    fetchSettings.mockResolvedValueOnce({ overwritePasses: 3 });
    open();
    await waitFor(() => expect(screen.getByRole('radio', { name: /3 passes/ }).checked).toBe(true));
  });

  it('lists files that could not be shredded, with the reason', async () => {
    streamShred.mockImplementation(async (paths, passes, onEvent) => {
      onEvent('done', {
        passes, shreddedFiles: 1, bytes: 3, aborted: false, failedCount: 1, heldCount: 0, held: [],
        failed: [{ path: 'D:\\b.txt', reason: 'EBUSY: resource busy or locked' }]
      });
    });
    const user = userEvent.setup();
    open();
    await user.click(await toConfirm(user));
    expect(await screen.findByText('Could not be shredded: 1')).toBeTruthy();
    expect(screen.getByText('D:\\b.txt')).toBeTruthy();
    expect(screen.getByText('EBUSY: resource busy or locked')).toBeTruthy();
  });

  it('shows progress while it runs, and Stop aborts the request', async () => {
    let signal;
    let emit;
    streamShred.mockImplementation((paths, passes, onEvent, sig) => {
      signal = sig;
      emit = onEvent;
      return new Promise((resolve, reject) => {
        sig.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })));
      });
    });
    const user = userEvent.setup();
    open();
    await user.click(await toConfirm(user));
    await waitFor(() => expect(emit).toBeTruthy());

    act(() => { emit('progress', { filesDone: 1, bytesDone: 2048, currentPath: 'C:\\a.txt' }); });
    expect(await screen.findByText('Files shredded: 1 (2 KB)')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(signal.aborted).toBe(true);
    expect(await screen.findByText('Stopped. Files shredded: 1 (2 KB).')).toBeTruthy();
  });

  it('reports an error from the stream', async () => {
    streamShred.mockImplementation(async (paths, passes, onEvent) => { onEvent('error', { message: 'disk exploded' }); });
    const user = userEvent.setup();
    open();
    await user.click(await toConfirm(user));
    expect(await screen.findByText('Shredding failed: disk exploded')).toBeTruthy();
  });

  it('Done closes the dialog', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await toConfirm(user));
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
