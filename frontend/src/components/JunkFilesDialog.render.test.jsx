// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** Deep Clean's Junk files dialog: where to look, results streaming in grouped
 * by pattern, only the safe groups pre-ticked, and removal as one confirmed
 * batch with Undo. The backend is stood in for at the api.js boundary. */

const fetchJunkPatterns = vi.fn();
const streamJunkScan = vi.fn();
const removeJunkFiles = vi.fn();
const revealInExplorer = vi.fn();
const restoreQuarantineBatch = vi.fn();
const fetchDrives = vi.fn();
let settingsRecord;

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchJunkPatterns: (...a) => fetchJunkPatterns(...a),
  streamJunkScan: (...a) => streamJunkScan(...a),
  removeJunkFiles: (...a) => removeJunkFiles(...a),
  revealInExplorer: (...a) => revealInExplorer(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  fetchDrives: (...a) => fetchDrives(...a),
  pickPath: vi.fn(async () => ({ path: 'E:\\Picked' })),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (p) => ({ ...settingsRecord, ...p })),
  fetchQuarantineBatches: vi.fn(async () => ({ batches: [] })),
  fetchStats: vi.fn(async () => ({}))
}));

const JunkFilesDialog = (await import('./JunkFilesDialog.jsx')).default;

const GB = 1024 ** 3;
const PATTERNS = [
  { pattern: '*.tmp', enabled: true, preselected: true },
  { pattern: '*.old', enabled: true, preselected: false },
  { pattern: '*.bak', enabled: false, preselected: false }
];
const OLD = Date.UTC(2026, 0, 5, 10, 30);
const FILES = [
  { path: 'D:\\Work\\build\\a.tmp', sizeBytes: 2048, mtimeMs: OLD, pattern: '*.tmp' },
  { path: 'D:\\Work\\b.tmp', sizeBytes: 1024, mtimeMs: OLD, pattern: '*.tmp' },
  { path: 'D:\\Work\\hosts.old', sizeBytes: 512, mtimeMs: OLD, pattern: '*.old' }
];
const SUMMARY = {
  offered: 3, offeredBytes: 3584, dirs: 10, entries: 400, truncated: null, unreadable: [],
  skipped: { protectedFolders: 2, excludedFolders: 0, protected: 1, excluded: 0, recent: 4, executable: 0 }
};

/** A scan that reports a start, two batches and a summary, then finishes. */
function scanThat({ files = FILES, summary = SUMMARY } = {}) {
  return async (roots, onEvent) => {
    onEvent('start', { roots, refused: [], patterns: PATTERNS.filter((p) => p.enabled) });
    onEvent('progress', { dirs: 5, entries: 200, matches: 1 });
    onEvent('files', { files: files.slice(0, 1) });
    onEvent('files', { files: files.slice(1) });
    onEvent('done', summary);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = { skipRecentHours: 24, deepCleanRemoval: 'quarantine', autoQuarantine: true };
  fetchJunkPatterns.mockResolvedValue({ patterns: PATTERNS, defaults: PATTERNS });
  fetchDrives.mockResolvedValue({
    drives: [
      { letter: 'C', label: 'Windows', totalBytes: 500 * GB, freeBytes: 100 * GB, system: true, removable: false },
      { letter: 'D', label: 'Data', totalBytes: 1000 * GB, freeBytes: 900 * GB, system: false, removable: false }
    ],
    systemDrive: 'C'
  });
  streamJunkScan.mockImplementation(scanThat());
  revealInExplorer.mockResolvedValue({ ok: true });
  restoreQuarantineBatch.mockResolvedValue({});
});

const mount = (props = {}) => renderScreen(<><JunkFilesDialog onClose={() => {}} {...props} /><ToastHost /></>);

async function scanDriveD(user) {
  await user.click(await screen.findByRole('button', { name: /D:.*Data/ }));
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await screen.findByText('hosts.old');
}

describe('choosing where to look', () => {
  it('cannot scan until a drive or folder is picked, and says so', async () => {
    const user = userEvent.setup();
    mount();
    expect(await screen.findByRole('dialog', { name: 'Junk files' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scan' }).disabled).toBe(true);
    expect(screen.getByText('Pick a drive or add a folder.')).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: /C:.*Windows/ }));
    expect(screen.getByRole('button', { name: /C:.*Windows/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Scan' }).disabled).toBe(false);
  });

  it('shows the patterns it will look for, only the ones turned on', async () => {
    mount();
    expect(await screen.findByText('*.tmp')).toBeTruthy();
    expect(screen.getByText('*.old')).toBeTruthy();
    expect(screen.queryByText('*.bak')).toBeNull();
  });

  it('scans the picked drives as roots and the folders typed or chosen', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /D:.*Data/ }));
    await user.type(screen.getByLabelText('Folder to search'), 'C:\\Users\\jim\\Downloads{Enter}');
    await user.click(screen.getByRole('button', { name: 'Browse…' }));
    await screen.findByText('E:\\Picked');
    await user.click(screen.getByRole('button', { name: 'Scan' }));
    expect(streamJunkScan.mock.calls[0][0]).toEqual(['D:\\', 'C:\\Users\\jim\\Downloads', 'E:\\Picked']);
  });

  it('offers a way to the pattern list in Settings', async () => {
    const user = userEvent.setup();
    const onEditPatterns = vi.fn();
    mount({ onEditPatterns });
    await user.click(await screen.findByRole('button', { name: 'Edit patterns' }));
    expect(onEditPatterns).toHaveBeenCalled();
  });
});

describe('results', () => {
  it('lists what was found grouped by pattern, with size and modified date', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    const tmp = screen.getByRole('region', { name: '*.tmp' });
    expect(within(tmp).getByText('a.tmp')).toBeTruthy();
    expect(within(tmp).getByText('2 files · 3 KB')).toBeTruthy();
    expect(within(tmp).getByText('Temporary files')).toBeTruthy();
    expect(within(tmp).getByText('2 KB')).toBeTruthy();
    expect(within(tmp).getAllByText(new Date(OLD).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }))).toHaveLength(2);
    expect(screen.getByRole('region', { name: '*.old' })).toBeTruthy();
  });

  it('ticks only results of the safe-by-default patterns, and totals the selection', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    const boxes = (name) => within(screen.getByRole('region', { name })).getAllByRole('checkbox');
    // The group box, then one per file.
    expect(boxes('*.tmp').slice(1).every((b) => b.checked)).toBe(true);
    expect(boxes('*.old').slice(1).every((b) => !b.checked)).toBe(true);
    expect(screen.getByTestId('junk-selected').textContent).toBe('2 selected · 3 KB');
  });

  it('ticks and unticks a whole group from its heading', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    await user.click(screen.getByRole('checkbox', { name: 'Tick every *.old file' }));
    expect(screen.getByTestId('junk-selected').textContent).toBe('3 selected · 3.5 KB');
    await user.click(screen.getByRole('checkbox', { name: 'Tick every *.tmp file' }));
    expect(screen.getByTestId('junk-selected').textContent).toBe('1 selected · 512 B');
  });

  it('says what it left alone, and why', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    expect(screen.getByTestId('junk-skipped').textContent)
      .toBe('5 more matching files were left alone: 4 changed in the last 24 hours · 1 in protected places');
    expect(screen.getByText(/2 protected or excluded folders were not searched/)).toBeTruthy();
  });

  it('opens the folder holding a file in File Explorer', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    await user.click(screen.getByRole('button', { name: 'Open the folder holding hosts.old' }));
    expect(revealInExplorer).toHaveBeenCalledWith('D:\\Work\\hosts.old');
  });

  it('says when nothing was found', async () => {
    const user = userEvent.setup();
    streamJunkScan.mockImplementation(scanThat({ files: [], summary: { ...SUMMARY, offered: 0, skipped: {} } }));
    mount();
    await user.click(await screen.findByRole('button', { name: /D:.*Data/ }));
    await user.click(screen.getByRole('button', { name: 'Scan' }));
    expect(await screen.findByText('No junk files found there.')).toBeTruthy();
  });

  it('answers a refusal in words, naming each place it could not search', async () => {
    const user = userEvent.setup();
    streamJunkScan.mockImplementation(async () => {
      const err = new Error('None of those can be scanned.');
      err.reason = 'noUsableRoots';
      err.refused = [{ path: 'C:\\Windows', reason: 'protected' }];
      throw err;
    });
    mount();
    // The dialog's own first focus lands a frame after it opens; typing before
    // that would have the rest of the keystrokes land on the first drive.
    await screen.findByRole('button', { name: /D:.*Data/ });
    await user.type(screen.getByLabelText('Folder to search'), 'C:\\Windows{Enter}');
    await user.click(screen.getByRole('button', { name: 'Scan' }));
    expect(await screen.findByText('None of those places can be searched.')).toBeTruthy();
    expect(screen.getByText('C:\\Windows is a protected place and is never searched.')).toBeTruthy();
  });
});

describe('Stop', () => {
  it('ends the scan and keeps what was already found', async () => {
    const user = userEvent.setup();
    streamJunkScan.mockImplementation((roots, onEvent, signal) => new Promise((resolve, reject) => {
      onEvent('start', { roots, refused: [], patterns: PATTERNS });
      onEvent('files', { files: FILES.slice(0, 1) });
      signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    mount();
    await user.click(await screen.findByRole('button', { name: /D:.*Data/ }));
    await user.click(screen.getByRole('button', { name: 'Scan' }));
    await screen.findByText('a.tmp');
    expect(screen.getByTestId('junk-progress')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText(/Stopped: these were found before that/)).toBeTruthy();
    expect(screen.getByText('a.tmp')).toBeTruthy();
    expect(streamJunkScan.mock.calls[0][2].aborted).toBe(true);
  });
});

describe('removing', () => {
  it('asks first, then moves the ticked files to Quarantine as one batch, with Undo', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    removeJunkFiles.mockResolvedValue({
      freedBytes: 0, movedBytes: 3072, removedCount: 2, mode: 'quarantine', keptPaths: [],
      results: [{ id: 'junk_files', freedBytes: 3072, quarantineBatch: 'C:\\q\\1-junk', skipped: [], skippedCount: 0 }]
    });
    mount();
    await scanDriveD(user);
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    expect(removeJunkFiles).not.toHaveBeenCalled();
    expect(screen.getByText('Move 2 files (3 KB) to Quarantine? You can put them back from Quarantine.')).toBeTruthy();

    await user.click(screen.getByTestId('junk-confirm'));
    expect(removeJunkFiles).toHaveBeenCalledWith(['D:\\Work\\build\\a.tmp', 'D:\\Work\\b.tmp']);
    expect(await screen.findByText(/Removed 2 junk files\. Moved 3 KB to Quarantine/)).toBeTruthy();
    // Gone from the list; the unticked one stays.
    expect(screen.queryByText('a.tmp')).toBeNull();
    expect(screen.getByText('hosts.old')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledWith('C:\\q\\1-junk'));
    // Back on disk, back in the list -- unticked.
    expect(await screen.findByText('a.tmp')).toBeTruthy();
    expect(screen.getByTestId('junk-selected').textContent).toBe('0 selected · 0 B');
  });

  it('keeps in the list the files the backend left where they were, and says how many', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    removeJunkFiles.mockResolvedValue({
      freedBytes: 0, movedBytes: 2048, removedCount: 1, mode: 'quarantine', keptPaths: ['D:\\Work\\b.tmp'],
      results: [{ id: 'junk_files', freedBytes: 2048, quarantineBatch: 'C:\\q\\2-junk', skipped: [{ path: 'D:\\Work\\b.tmp', reason: 'locked or inaccessible' }], skippedCount: 1 }]
    });
    mount();
    await scanDriveD(user);
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    await user.click(screen.getByTestId('junk-confirm'));
    expect(await screen.findByText('1 file was left where it is.')).toBeTruthy();
    expect(screen.queryByText('a.tmp')).toBeNull();
    expect(screen.getByText('b.tmp')).toBeTruthy();
  });

  it('says plainly when Settings makes it a permanent delete', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...settingsRecord, deepCleanRemoval: 'delete' };
    mount();
    await scanDriveD(user);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete 2 files (3 KB) for good? This cannot be undone.')).toBeTruthy();
  });

  it('moves keyboard focus to Cancel when it asks, and back to the button when Cancel is pressed', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move to Quarantine' }));
    expect(removeJunkFiles).not.toHaveBeenCalled();
  });

  it('cannot remove anything while nothing is ticked', async () => {
    const user = userEvent.setup();
    mount();
    await scanDriveD(user);
    await user.click(screen.getByRole('checkbox', { name: 'Tick every *.tmp file' }));
    expect(screen.getByRole('button', { name: 'Move to Quarantine' }).disabled).toBe(true);
  });
});
