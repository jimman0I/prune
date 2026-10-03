// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** Duplicates moved to Quarantine: one Undo brings every moved copy back. */

const fetchDuplicates = vi.fn();
const quarantineDiskPath = vi.fn();
const restoreQuarantineBatch = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDuplicates: (...a) => fetchDuplicates(...a),
  quarantineDiskPath: (...a) => quarantineDiskPath(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a)
}));

const Duplicates = (await import('./Duplicates.jsx')).default;

const FOLDER = 'C:\\Users\\jim\\Pictures';
const RESULT = {
  groups: [
    { digest: 'd1', count: 2, size: 1024, wastedBytes: 1024, files: [
      { path: `${FOLDER}\\2019\\a.jpg`, mtimeMs: Date.UTC(2026, 0, 1) },
      { path: `${FOLDER}\\Backup\\copy of a.jpg`, mtimeMs: Date.UTC(2026, 1, 1) }
    ] },
    { digest: 'd2', count: 2, size: 2048, wastedBytes: 2048, files: [
      { path: `${FOLDER}\\2019\\b.jpg`, mtimeMs: Date.UTC(2026, 0, 1) },
      { path: `${FOLDER}\\Backup\\copy of b.jpg`, mtimeMs: Date.UTC(2026, 1, 1) }
    ] }
  ],
  wastedBytes: 3072, scannedFiles: 10, truncated: false
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchDuplicates.mockResolvedValue(RESULT);
  let n = 0;
  quarantineDiskPath.mockImplementation(async () => ({ ok: true, batch: { batchDir: `C:\\q\\${++n}-diskmap` } }));
  restoreQuarantineBatch.mockResolvedValue({});
});

async function moveTheNewerCopies() {
  const user = userEvent.setup();
  renderScreen(<><Duplicates /><ToastHost /></>);
  await user.type(screen.getByLabelText('Folder to search for duplicates'), FOLDER);
  await user.click(screen.getByRole('button', { name: 'Find duplicates' }));
  await screen.findByText('a.jpg');
  await user.click(screen.getByRole('button', { name: 'Keep oldest' }));
  await user.click(screen.getByRole('button', { name: 'Move selected to quarantine' }));
  const dialog = await screen.findByRole('dialog', { name: 'Move duplicates to quarantine' });
  await user.click(within(dialog).getByRole('button', { name: 'Move to quarantine' }));
  return user;
}

describe('Undo after moving duplicates to Quarantine', () => {
  it('is on the toast that counts them', async () => {
    await moveTheNewerCopies();
    expect(await screen.findByText('Moved 2 copies to quarantine.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('restores every moved copy, each its own batch', async () => {
    const user = await moveTheNewerCopies();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledTimes(2));
    expect(restoreQuarantineBatch.mock.calls.map((c) => c[0])).toEqual(['C:\\q\\1-diskmap', 'C:\\q\\2-diskmap']);
    expect(await screen.findByText('Restored from Quarantine.')).toBeTruthy();
  });

  it('says how many came back when one is gone', async () => {
    restoreQuarantineBatch.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));
    const user = await moveTheNewerCopies();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Put back 1 of 2. The rest are no longer in Quarantine.')).toBeTruthy();
  });
});
