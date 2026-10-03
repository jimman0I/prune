// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** "Shred with Prune" from File Explorer's right-click menu fills the Shred
 * dialog in. It NEVER shreds: the path joins the list, and the dialog's own
 * steps (read what will be destroyed, press the red button) stand exactly as
 * they do for a path chosen inside Prune. A request that arrives while the
 * dialog is already open must not change what an in-progress confirmation or an
 * in-progress shred is about. */

const previewShred = vi.fn();
const streamShred = vi.fn();
vi.mock('../lib/api.js', () => ({
  previewShred: (...a) => previewShred(...a),
  streamShred: (...a) => streamShred(...a),
  fetchSettings: vi.fn(async () => ({ overwritePasses: 1 })),
  updateSettings: vi.fn(async (p) => p)
}));

const ShredDialog = (await import('./ShredDialog.jsx')).default;

const NOTE = /Added from File Explorer\. Nothing is shredded until you confirm on the next step\./;
/** The way DeepClean mounts the dialog: the request arrives as a prop, and a
 * newer request is a new nonce with its own paths. */
let setRequest;
function Host({ initial }) {
  const [request, set] = useState(initial);
  setRequest = set;
  return <ShredDialog onClose={vi.fn()} requestedPaths={request?.paths} requestNonce={request?.nonce} />;
}
const mount = (initial) => renderScreen(<Host initial={initial} />);
const send = (paths, nonce) => act(() => setRequest({ paths, nonce }));
const settle = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};

beforeEach(() => {
  vi.clearAllMocks();
  previewShred.mockResolvedValue({ files: 1, bytes: 3, refused: [], refusedCount: 0, truncated: false });
  streamShred.mockImplementation(async (paths, passes, onEvent) => {
    onEvent('done', { passes, shreddedFiles: 1, bytes: 3, aborted: false, failed: [], failedCount: 0, held: [], heldCount: 0 });
  });
});

describe('a path from File Explorer', () => {
  it('is in the list when the dialog opens, with a note that nothing happens until the next step', async () => {
    mount({ paths: ['C:\\Users\\me\\old.docx'], nonce: 1 });
    const dialog = screen.getByRole('dialog', { name: 'Shred files and folders' });
    expect(await within(dialog).findByText('C:\\Users\\me\\old.docx')).toBeTruthy();
    expect(within(dialog).getByText(NOTE)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Continue' }).disabled).toBe(false);
  });

  it('shreds nothing, and does not even read the file, until the person goes on', async () => {
    mount({ paths: ['C:\\Users\\me\\old.docx'], nonce: 1 });
    await screen.findByText('C:\\Users\\me\\old.docx');
    await settle();
    expect(previewShred).not.toHaveBeenCalled();
    expect(streamShred).not.toHaveBeenCalled();
  });

  it('goes through the same confirmation: Continue shows what would be destroyed, and only the red button shreds', async () => {
    const user = userEvent.setup();
    mount({ paths: ['C:\\Users\\me\\old.docx'], nonce: 1 });
    await screen.findByText('C:\\Users\\me\\old.docx');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Shred these permanently?')).toBeTruthy();
    expect(previewShred).toHaveBeenCalledWith(['C:\\Users\\me\\old.docx']);
    expect(streamShred).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Shred permanently' }));
    expect(streamShred).toHaveBeenCalledTimes(1);
    expect(streamShred.mock.calls[0][0]).toEqual(['C:\\Users\\me\\old.docx']);
  });

  it('has no note, and an empty list, when the dialog is opened by hand', async () => {
    mount();
    await settle();
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(screen.getByText('Nothing chosen yet.')).toBeTruthy();
  });

  it('ignores a request with no usable path', async () => {
    mount({ paths: ['', '   '], nonce: 1 });
    await settle();
    expect(screen.getByText('Nothing chosen yet.')).toBeTruthy();
  });
});

describe('a second request while the dialog is open', () => {
  it('adds to the list, once, when the person is still choosing', async () => {
    mount({ paths: ['C:\\a.txt'], nonce: 1 });
    await screen.findByText('C:\\a.txt');
    send(['C:\\b.txt'], 2);
    expect(await screen.findByText('C:\\b.txt')).toBeTruthy();
    expect(screen.getByText('C:\\a.txt')).toBeTruthy();
    send(['c:\\B.TXT'], 3);
    await settle();
    expect(screen.getAllByText(/^C:\\b\.txt$/i)).toHaveLength(1);
  });

  it('while the person is reading the confirmation, takes them back to choose: the list no longer matches what was read', async () => {
    const user = userEvent.setup();
    mount({ paths: ['C:\\a.txt'], nonce: 1 });
    await screen.findByText('C:\\a.txt');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Shred these permanently?');

    send(['C:\\b.txt'], 2);
    expect(await screen.findByText('C:\\b.txt')).toBeTruthy();
    expect(screen.queryByText('Shred these permanently?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Shred permanently' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(streamShred).not.toHaveBeenCalled();
  });

  it('while a shred is running, waits: the running shred is about the list it started with', async () => {
    const run = deferred();
    streamShred.mockImplementation(async (paths, passes, onEvent) => {
      await run.promise;
      onEvent('done', { passes, shreddedFiles: 1, bytes: 3, aborted: false, failed: [], failedCount: 0, held: [], heldCount: 0 });
    });
    const user = userEvent.setup();
    mount({ paths: ['C:\\a.txt'], nonce: 1 });
    await screen.findByText('C:\\a.txt');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Shred permanently' }));
    await screen.findByText('Shredding…');

    send(['C:\\b.txt'], 2);
    await settle();
    expect(screen.getByText('Shredding…')).toBeTruthy();
    expect(screen.queryByText('C:\\b.txt')).toBeNull();
    expect(streamShred.mock.calls[0][0]).toEqual(['C:\\a.txt']);

    await act(async () => { run.resolve(); await run.promise; });
    // Finished: the waiting request starts a fresh list of its own.
    expect(await screen.findByText('C:\\b.txt')).toBeTruthy();
    expect(screen.queryByText('C:\\a.txt')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(streamShred).toHaveBeenCalledTimes(1);
  });

  it('after a finished shred, starts a fresh list with the new path only', async () => {
    const user = userEvent.setup();
    mount({ paths: ['C:\\a.txt'], nonce: 1 });
    await screen.findByText('C:\\a.txt');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Shred permanently' }));
    await screen.findByText(/Done\. Files shredded: 1/);

    send(['C:\\b.txt'], 2);
    expect(await screen.findByText('C:\\b.txt')).toBeTruthy();
    expect(screen.queryByText('C:\\a.txt')).toBeNull();
    expect(screen.queryByText(/Done\. Files shredded/)).toBeNull();
  });
});
