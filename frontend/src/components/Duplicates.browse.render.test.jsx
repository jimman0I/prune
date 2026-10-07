// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The folder field asked for a full Windows path typed by hand, with no
 * autocomplete and no way to catch a typo before a multi-minute hash scan
 * ran against the wrong folder. Forced Uninstall already solved this with
 * the native chooser; Duplicates gets the same button. */

const pickPath = vi.fn();
const fetchDuplicates = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  pickPath: (...a) => pickPath(...a),
  fetchDuplicates: (...a) => fetchDuplicates(...a),
  quarantineDiskPath: vi.fn()
}));

const Duplicates = (await import('./Duplicates.jsx')).default;

beforeEach(() => { vi.clearAllMocks(); });

describe('browsing to the folder instead of typing it', () => {
  it('fills the field with the chosen path', async () => {
    pickPath.mockResolvedValue({ path: 'D:\\Photos' });
    const user = userEvent.setup();
    renderScreen(<Duplicates />);

    await user.click(screen.getByRole('button', { name: 'Browse…' }));

    expect(pickPath).toHaveBeenCalledWith('folder');
    expect(screen.getByLabelText('Folder to search for duplicates').value).toBe('D:\\Photos');
  });

  it('leaves the field alone when the dialog is cancelled', async () => {
    pickPath.mockResolvedValue({ path: null });
    const user = userEvent.setup();
    renderScreen(<Duplicates />);

    await user.type(screen.getByLabelText('Folder to search for duplicates'), 'C:\\Keep');
    await user.click(screen.getByRole('button', { name: 'Browse…' }));

    expect(screen.getByLabelText('Folder to search for duplicates').value).toBe('C:\\Keep');
  });

  it('shows what went wrong if the dialog itself fails, without blocking manual typing', async () => {
    pickPath.mockRejectedValue(new Error('no window'));
    const user = userEvent.setup();
    renderScreen(<Duplicates />);

    await user.click(screen.getByRole('button', { name: 'Browse…' }));

    expect(await screen.findByText(/Couldn't open the folder dialog: no window/)).toBeTruthy();
    await user.type(screen.getByLabelText('Folder to search for duplicates'), 'C:\\Still\\Works');
    expect(screen.getByLabelText('Folder to search for duplicates').value).toBe('C:\\Still\\Works');
  });
});
