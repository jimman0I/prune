// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** What on the Duplicates screen can be selected and copied.
 *
 * Text selection is off across the app. A duplicate's path stays on: the
 * next thing anyone does with "these two are identical" is go and look at
 * them, and that starts with the path. So does the reason a search
 * failed. Nothing here removes anything -- the api module is mocked. */

const fetchDuplicates = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDuplicates: (...a) => fetchDuplicates(...a),
  quarantineDiskPath: vi.fn()
}));

const Duplicates = (await import('./Duplicates.jsx')).default;

const FOLDER = 'C:\\Users\\jim\\Pictures';

/** Types a folder and starts the search, the way a person would. */
async function search() {
  const user = userEvent.setup();
  renderScreen(<Duplicates />);
  await user.type(screen.getByLabelText('Folder to search for duplicates'), FOLDER);
  await user.click(screen.getByRole('button', { name: 'Find duplicates' }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('what can be copied on the Duplicates screen', () => {
  it('each duplicate path', async () => {
    fetchDuplicates.mockResolvedValue({
      groups: [{
        digest: 'd1', count: 2, size: 1024, wastedBytes: 1024,
        files: [
          { path: `${FOLDER}\\a.jpg`, mtimeMs: Date.UTC(2026, 0, 1) },
          { path: `${FOLDER}\\copy of a.jpg`, mtimeMs: Date.UTC(2026, 1, 1) }
        ]
      }],
      wastedBytes: 1024, scannedFiles: 10, truncated: false
    });
    await search();

    expect(isCopyable(await screen.findByText(`${FOLDER}\\a.jpg`))).toBe(true);
    expect(isCopyable(screen.getByText(`${FOLDER}\\copy of a.jpg`))).toBe(true);
    expect(isCopyable(screen.getByText(/2 identical copies/))).toBe(false);
  });

  it('the reason a search failed', async () => {
    fetchDuplicates.mockRejectedValue(new Error(`That folder does not exist: ${FOLDER}`));
    await search();

    expect(isCopyable(await screen.findByText(/That folder does not exist/))).toBe(true);
  });
});
