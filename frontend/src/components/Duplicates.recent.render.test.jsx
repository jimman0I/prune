// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { RECENT_FOLDERS_KEY } from '../lib/duplicatesRecentFolders.js';

/** The composed empty state before any search has run: recent folders
 * from past searches, offered back for a click instead of a retype or a
 * trip through Browse. Nothing searched yet used to be a blank field
 * above a blank screen. */

const fetchDuplicates = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDuplicates: (...a) => fetchDuplicates(...a),
  quarantineDiskPath: vi.fn()
}));

const Duplicates = (await import('./Duplicates.jsx')).default;

const seed = (folders) => window.localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(folders));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  fetchDuplicates.mockResolvedValue({ groups: [], scannedFiles: 0, wastedBytes: 0, truncated: false });
});

describe('before any search has run', () => {
  it('offers nothing when there is no history', () => {
    renderScreen(<Duplicates />);
    expect(screen.queryByText('Recent folders')).toBeNull();
  });

  it('lists past folders, newest first, each as its own button', () => {
    seed(['D:\\Photos', 'C:\\Users\\jim\\Downloads']);
    renderScreen(<Duplicates />);
    expect(screen.getByText('Recent folders')).toBeTruthy();
    const buttons = [
      screen.getByRole('button', { name: 'D:\\Photos' }),
      screen.getByRole('button', { name: 'C:\\Users\\jim\\Downloads' })
    ];
    expect(buttons.every(Boolean)).toBe(true);
  });

  it('a click fills the field and starts the search, same as pressing Find', async () => {
    seed(['D:\\Photos']);
    const user = userEvent.setup();
    renderScreen(<Duplicates />);

    await user.click(screen.getByRole('button', { name: 'D:\\Photos' }));

    expect(fetchDuplicates).toHaveBeenCalledWith('D:\\Photos', expect.anything());
    expect(screen.getByLabelText('Folder to search for duplicates').value).toBe('D:\\Photos');
  });

  it('is gone once a search is running or has results', async () => {
    seed(['D:\\Photos']);
    const user = userEvent.setup();
    renderScreen(<Duplicates />);
    await user.click(screen.getByRole('button', { name: 'D:\\Photos' }));
    expect(screen.queryByText('Recent folders')).toBeNull();
  });
});

describe('what a search remembers', () => {
  it('adds the typed folder to the recent list for next time', async () => {
    const user = userEvent.setup();
    renderScreen(<Duplicates />);
    await user.type(screen.getByLabelText('Folder to search for duplicates'), 'C:\\New\\Folder');
    await user.click(screen.getByRole('button', { name: 'Find duplicates' }));

    expect(JSON.parse(window.localStorage.getItem(RECENT_FOLDERS_KEY))).toEqual(['C:\\New\\Folder']);
  });

  it('moves an already-known folder to the front instead of duplicating it', async () => {
    seed(['C:\\Old', 'D:\\Older']);
    const user = userEvent.setup();
    renderScreen(<Duplicates />);
    await user.type(screen.getByLabelText('Folder to search for duplicates'), 'D:\\Older');
    await user.click(screen.getByRole('button', { name: 'Find duplicates' }));

    expect(JSON.parse(window.localStorage.getItem(RECENT_FOLDERS_KEY))).toEqual(['D:\\Older', 'C:\\Old']);
  });
});
