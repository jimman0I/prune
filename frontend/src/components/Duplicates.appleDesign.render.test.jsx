// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The Duplicates screen after the Apple design pass: wording and layout.
 *
 * Duplicates is the one flow where a wrong choice removes a file, so half of
 * these tests are here to show that the decisions did NOT move: nothing is
 * ticked until asked, the auto-select buttons keep exactly one copy, a set
 * cannot be emptied, and removal still goes to Quarantine. */

const fetchDuplicates = vi.fn();
const quarantineDiskPath = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDuplicates: (...a) => fetchDuplicates(...a),
  quarantineDiskPath: (...a) => quarantineDiskPath(...a)
}));

const Duplicates = (await import('./Duplicates.jsx')).default;

const FOLDER = 'C:\\Users\\jim\\Pictures';
const OLD = Date.UTC(2026, 0, 1, 9, 5);
const NEW = Date.UTC(2026, 1, 1, 17, 45);

const RESULT = {
  groups: [{
    digest: 'd1', count: 2, size: 1024, wastedBytes: 1024,
    files: [
      { path: `${FOLDER}\\2019\\a.jpg`, mtimeMs: OLD },
      { path: `${FOLDER}\\Backup\\copy of a.jpg`, mtimeMs: NEW }
    ]
  }],
  wastedBytes: 1024, scannedFiles: 10, truncated: false
};

beforeEach(() => {
  vi.clearAllMocks();
  quarantineDiskPath.mockResolvedValue({ ok: true });
});
afterEach(() => { vi.useRealTimers(); });

async function search(user) {
  await user.type(screen.getByLabelText('Folder to search for duplicates'), FOLDER);
  await user.click(screen.getByRole('button', { name: 'Find duplicates' }));
}

async function showResults() {
  fetchDuplicates.mockResolvedValue(RESULT);
  const user = userEvent.setup();
  renderScreen(<Duplicates />);
  await search(user);
  await screen.findByText('a.jpg');
  return user;
}

const tagsOf = () => screen.getAllByText(/^(Keep|To quarantine)$/).map((el) => el.textContent);

describe('a file row', () => {
  it('has the file name on its own line and the folder beneath it, cut in the middle', async () => {
    await showResults();

    const name = screen.getByText('a.jpg');
    expect(name.className).toContain('truncate');
    const label = name.closest('label');
    // The folder is two pieces: a head that may shrink and a last folder that may not.
    const head = within(label).getByText('C:\\Users\\jim\\Pictures');
    const tail = within(label).getByText('\\2019');
    expect(head.className).toContain('truncate');
    expect(tail.className).toContain('shrink-0');
    expect(tail.className).not.toContain('truncate');
    // Still selectable, so the full path can be copied.
    expect(isCopyable(name)).toBe(true);
    expect(isCopyable(head)).toBe(true);
  });

  it('shows the time as well as the date', async () => {
    await showResults();

    const expected = new Date(OLD).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    expect(screen.getByText(expected)).toBeTruthy();
    // A date alone would print the same for two copies written the same day.
    expect(expected).not.toBe(new Date(OLD).toLocaleDateString());
  });

  it('is named by the checkbox alone: the tag does not leak into its accessible name', async () => {
    await showResults();
    expect(screen.getAllByRole('checkbox', { name: /^a\.jpg/ })).toHaveLength(1);
    expect(screen.queryByRole('checkbox', { name: /Keep|To quarantine/ })).toBeNull();
  });
});

describe('the Keep / To quarantine tags follow the real selection', () => {
  it('nothing is ticked until the user asks: every copy says Keep', async () => {
    await showResults();

    expect(screen.getAllByRole('checkbox').every((c) => !c.checked)).toBe(true);
    expect(tagsOf()).toEqual(['Keep', 'Keep']);
  });

  it('Keep oldest ticks exactly the newer copy, and only that copy says To quarantine', async () => {
    const user = await showResults();

    await user.click(screen.getByRole('button', { name: 'Keep oldest' }));

    const [oldBox, newBox] = screen.getAllByRole('checkbox');
    expect(oldBox.checked).toBe(false);
    expect(newBox.checked).toBe(true);
    expect(tagsOf()).toEqual(['Keep', 'To quarantine']);
  });

  it('Keep newest flips it, still keeping exactly one', async () => {
    const user = await showResults();

    await user.click(screen.getByRole('button', { name: 'Keep newest' }));

    expect(tagsOf()).toEqual(['To quarantine', 'Keep']);
  });

  it('a hand-ticked box changes its own tag and no other, and unticking puts it back', async () => {
    const user = await showResults();
    const [first] = screen.getAllByRole('checkbox');

    await user.click(first);
    expect(tagsOf()).toEqual(['To quarantine', 'Keep']);
    await user.click(first);
    expect(tagsOf()).toEqual(['Keep', 'Keep']);
  });

  it('Clear puts every tag back to Keep', async () => {
    const user = await showResults();
    await user.click(screen.getByRole('button', { name: 'Keep oldest' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(tagsOf()).toEqual(['Keep', 'Keep']);
  });

  it('the keep-at-least-one guard is exactly as it was: emptying a set disables the move', async () => {
    const user = await showResults();

    for (const box of screen.getAllByRole('checkbox')) await user.click(box);

    expect(tagsOf()).toEqual(['To quarantine', 'To quarantine']);
    expect(screen.getByText('Every copy in this set is ticked — untick one to keep it.')).toBeTruthy();
    const move = screen.getByRole('button', { name: /would lose every copy/ });
    expect(move.disabled).toBe(true);
  });
});

describe('the confirm dialog and where the copies go', () => {
  async function openConfirm(user) {
    await user.click(screen.getByRole('button', { name: 'Keep oldest' }));
    await user.click(screen.getByRole('button', { name: 'Move selected to quarantine' }));
    return screen.findByRole('dialog', { name: 'Move duplicates to quarantine' });
  }

  it('says space is freed when Quarantine is emptied, never "recovered"', async () => {
    const user = await showResults();
    const dialog = await openConfirm(user);

    expect(dialog.textContent).toContain('Moving them frees 1 KB once you empty Quarantine.');
    expect(dialog.textContent).not.toMatch(/recovered/);
  });

  it('uses the singular for one copy', async () => {
    const user = await showResults();
    const dialog = await openConfirm(user);

    expect(within(dialog).getByRole('heading', { name: 'Move 1 copy to quarantine?' })).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/1 copies/);
  });

  it('still moves each ticked path to Quarantine, and only the ticked ones', async () => {
    const user = await showResults();
    const dialog = await openConfirm(user);

    await user.click(within(dialog).getByRole('button', { name: 'Move to quarantine' }));

    await vi.waitFor(() => expect(quarantineDiskPath).toHaveBeenCalledTimes(1));
    expect(quarantineDiskPath).toHaveBeenCalledWith(`${FOLDER}\\Backup\\copy of a.jpg`, null);
  });
});

describe('the search field and the running search', () => {
  it('shows an example, not a value that looks already chosen', () => {
    fetchDuplicates.mockResolvedValue(RESULT);
    renderScreen(<Duplicates />);

    const input = screen.getByLabelText('Folder to search for duplicates');
    expect(input.getAttribute('placeholder')).toBe('Folder path, for example C:\\Users\\you\\Downloads');
    expect(input.getAttribute('placeholder')).not.toBe('C:\\Users');
    expect(input.value).toBe('');
  });

  it('counts elapsed time while it reads, and starts from zero each search', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    fetchDuplicates.mockImplementation(() => new Promise(() => {}));
    renderScreen(<Duplicates />);
    fireEvent.change(screen.getByLabelText('Folder to search for duplicates'), { target: { value: FOLDER } });
    fireEvent.click(screen.getByRole('button', { name: 'Find duplicates' }));

    expect((await screen.findByTestId('duplicates-elapsed')).textContent).toBe('Elapsed 00:00');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('duplicates-elapsed').textContent).toBe('Elapsed 00:03');
    await act(async () => { vi.advanceTimersByTime(65_000); });
    expect(screen.getByTestId('duplicates-elapsed').textContent).toBe('Elapsed 01:08');
  });

  it('Stop says nothing was compared, instead of leaving an empty screen', async () => {
    fetchDuplicates.mockImplementation((_folder, signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const user = userEvent.setup();
    renderScreen(<Duplicates />);
    await search(user);

    await user.click(await screen.findByRole('button', { name: 'Stop' }));

    expect((await screen.findByRole('status')).textContent).toBe('Stopped — nothing was compared.');
    expect(screen.queryByTestId('duplicates-elapsed')).toBeNull();
  });

  it('the stopped note goes away when a new search starts', async () => {
    fetchDuplicates.mockImplementationOnce((_folder, signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    fetchDuplicates.mockResolvedValue(RESULT);
    const user = userEvent.setup();
    renderScreen(<Duplicates />);
    await search(user);
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    await screen.findByText('Stopped — nothing was compared.');

    await user.click(screen.getByRole('button', { name: 'Find duplicates' }));

    await screen.findByText('a.jpg');
    expect(screen.queryByText('Stopped — nothing was compared.')).toBeNull();
  });

  it('a search that was never stopped shows no stopped note', async () => {
    await showResults();
    expect(screen.queryByText('Stopped — nothing was compared.')).toBeNull();
  });
});

describe('sizes use text colour, not the accent that marks buttons and ticked boxes', () => {
  it('the recoverable figures carry no accent colour', async () => {
    await showResults();

    for (const el of screen.getAllByText(/1 KB recoverable/)) {
      expect(el.className).not.toContain('accent-primary');
    }
  });
});
