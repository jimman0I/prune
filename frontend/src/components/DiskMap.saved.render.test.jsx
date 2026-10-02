// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import ToastHost from './ToastHost.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** Saving a scan, listing and opening saved ones, deleting, and comparing two. */

vi.mock('recharts', async () => {
  const { cloneElement } = await import('react');
  return {
    ResponsiveContainer: ({ children }) => children,
    Treemap: ({ data, content }) => (
      <svg>{(data || []).map((node, i) =>
        cloneElement(content, { key: node.fullPath || node.name || i, ...node, x: 10, y: 10, width: 200, height: 120, depth: 1 })
      )}</svg>
    )
  };
});

const scanDriveFast = vi.fn();
const fetchSavedScans = vi.fn();
const saveDiskScan = vi.fn();
const loadSavedScan = vi.fn();
const deleteSavedScan = vi.fn();
const compareSavedScans = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(async () => null),
  fetchDrives: vi.fn(async () => ({ systemDrive: 'C', drives: [] })),
  scanDriveFast: (...a) => scanDriveFast(...a),
  fetchDiskScan: vi.fn(),
  stopDiskScan: vi.fn(),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(),
  revealInExplorer: vi.fn(async () => {}),
  fetchSavedScans: (...a) => fetchSavedScans(...a),
  saveDiskScan: (...a) => saveDiskScan(...a),
  loadSavedScan: (...a) => loadSavedScan(...a),
  deleteSavedScan: (...a) => deleteSavedScan(...a),
  compareSavedScans: (...a) => compareSavedScans(...a)
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);

const LIVE = {
  name: 'C:', type: 'directory', size: 1500, allocated: 1600,
  children: [
    { name: 'Games', type: 'directory', size: 900, children: [{ name: 'a.pak', type: 'file', size: 900, fullPath: 'C:\\Games\\a.pak' }] },
    { name: 'note.txt', type: 'file', size: 600 }
  ]
};
const entry = (id, label, extra = {}) => ({ id, label, savedAt: Date.UTC(2026, 6, 1), root: 'C:', source: 'fast', truncated: false, totalBytes: 1000, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  scanDriveFast.mockResolvedValue({ drives: [{ driveLetter: 'C', tree: LIVE, stats: {} }] });
  fetchSavedScans.mockResolvedValue([]);
});

async function mount({ scanned = true } = {}) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider><LanguageProvider><ToastProvider><MotionConfig reducedMotion="always">
        <DiskMap />
        <ToastHost />
      </MotionConfig></ToastProvider></LanguageProvider></ThemeProvider>
    </QueryClientProvider>
  );
  if (scanned) {
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await screen.findByRole('table');
  }
  return user;
}
const openPanel = async (user) => {
  await user.click(screen.getAllByRole('button', { name: 'Saved scans' })[0]);
  return screen.findByRole('dialog', { name: 'Saved scans' });
};

describe('saving a scan', () => {
  it('saves the compact form of the live drive tree under the name given', async () => {
    saveDiskScan.mockResolvedValue(entry('abc123', 'Before cleanup'));
    const user = await mount();
    const dialog = await openPanel(user);
    const name = within(dialog).getByLabelText('Name for this scan');
    await user.clear(name);
    await user.type(name, 'Before cleanup');
    await user.click(within(dialog).getByRole('button', { name: 'Save current scan' }));

    await waitFor(() => expect(saveDiskScan).toHaveBeenCalled());
    const sent = saveDiskScan.mock.calls[0][0];
    expect(sent.label).toBe('Before cleanup');
    expect(sent.source).toBe('fast');
    expect(sent.archive.v).toBe(1);
    expect(sent.archive.root.n).toBe('C:');
    expect(sent.archive.root.c.map((c) => c.n)).toEqual(['Games']); // folders only
    expect(await screen.findByText('Saved scan "Before cleanup".')).toBeTruthy();
  });

  it('offers nothing to save before a drive has been scanned', async () => {
    const user = await mount({ scanned: false });
    const dialog = await openPanel(user);
    expect(within(dialog).getByText('Scan a drive first, then you can save it here.')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Save current scan' })).toBeNull();
  });

  it('shows the server\'s reason when saving fails', async () => {
    saveDiskScan.mockRejectedValue(new Error('Prune keeps 50 saved scans. Delete one to save another.'));
    const user = await mount();
    const dialog = await openPanel(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save current scan' }));
    expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'Saved scans: Prune keeps 50 saved scans. Delete one to save another.');
  });
});

describe('the list', () => {
  beforeEach(() => {
    fetchSavedScans.mockResolvedValue([
      entry('new1', 'After', { savedAt: Date.UTC(2026, 8, 1), totalBytes: 2 * 1024 ** 3 }),
      entry('old1', 'Before', { truncated: true, source: 'crawl' })
    ]);
  });

  it('lists each scan with its date, how it was made, its size, and whether it was partial', async () => {
    const user = await mount();
    const dialog = await openPanel(user);
    const rows = await within(dialog).findAllByRole('listitem');
    expect(rows[0].textContent).toContain('After');
    expect(rows[0].textContent).toContain('Fast scan');
    expect(rows[0].textContent).toContain('2 GB');
    expect(rows[1].textContent).toContain('Walk folders');
    expect(rows[1].textContent).toContain('Partial');
  });

  it('says so when there are none', async () => {
    fetchSavedScans.mockResolvedValue([]);
    const user = await mount();
    expect(await within(await openPanel(user)).findByText('No saved scans yet.')).toBeTruthy();
  });

  it('deletes only after asking', async () => {
    deleteSavedScan.mockResolvedValue();
    const user = await mount();
    const dialog = await openPanel(user);
    const row = (await within(dialog).findAllByRole('listitem'))[1];
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(deleteSavedScan).not.toHaveBeenCalled();
    expect(within(row).getByText('Delete "Before" for good?')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteSavedScan).toHaveBeenCalledWith('old1'));
  });

  it('backs out of a delete', async () => {
    const user = await mount();
    const dialog = await openPanel(user);
    const row = (await within(dialog).findAllByRole('listitem'))[0];
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(within(row).getByRole('button', { name: 'Cancel' }));
    expect(deleteSavedScan).not.toHaveBeenCalled();
    expect(within(row).getByRole('button', { name: 'Open' })).toBeTruthy();
  });
});

describe('opening a saved scan', () => {
  const archive = {
    v: 1,
    root: { n: 'C:', s: 5000, f: 12, d: 2, fc: 2, fb: 1000, c: [{ n: 'OldGames', s: 4000, f: 10, d: 1, fc: 10, fb: 4000 }] },
    top: [{ p: 'C:\\OldGames\\huge.pak', s: 3000 }]
  };

  beforeEach(() => {
    fetchSavedScans.mockResolvedValue([entry('old1', 'Before')]);
    loadSavedScan.mockResolvedValue({ scan: entry('old1', 'Before'), archive });
  });

  it('shows the saved folders in the Tree view with a banner saying it is not the live drive', async () => {
    const user = await mount({ scanned: false });
    const dialog = await openPanel(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Open' }));

    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain('Viewing the saved scan "Before" from');
    expect(banner.textContent).toContain('This is not your drive as it is now.');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('OldGames')).toBeTruthy();
    // The saved counts, not the one big file that was kept.
    expect(within(table).getAllByRole('row').find((r) => r.textContent.startsWith('OldGames')).textContent).toContain('10');
  });

  it('does not offer to quarantine anything from a saved scan, which may be out of date', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const user = await mount({ scanned: false });
    await user.click(await within(await openPanel(user)).findByRole('button', { name: 'Open' }));
    const table = await screen.findByRole('table');
    fireEvent.contextMenu(within(table).getAllByRole('row').find((r) => r.textContent.startsWith('OldGames')));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Properties' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: 'Move to quarantine…' })).toBeNull();
  });

  it('goes back to the live scan', async () => {
    const user = await mount();
    await user.click(await within(await openPanel(user)).findByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Back to the live scan' }));
    expect(screen.queryByText(/Viewing the saved scan/)).toBeNull();
    expect((await screen.findAllByText('Games')).length).toBeGreaterThan(0);
  });

  it('says why when a scan cannot be opened', async () => {
    loadSavedScan.mockRejectedValue(new Error('That saved scan is not there.'));
    const user = await mount({ scanned: false });
    await user.click(await within(await openPanel(user)).findByRole('button', { name: 'Open' }));
    expect(await screen.findByText('Saved scans: That saved scan is not there.')).toBeTruthy();
  });
});

describe('comparing two scans', () => {
  beforeEach(() => {
    fetchSavedScans.mockResolvedValue([
      entry('new1', 'After', { savedAt: Date.UTC(2026, 8, 1) }),
      entry('old1', 'Before')
    ]);
    compareSavedScans.mockResolvedValue({
      older: entry('old1', 'Before'), newer: entry('new1', 'After', { savedAt: Date.UTC(2026, 8, 1) }),
      totalBefore: 1000, totalAfter: 3000, delta: 2000,
      grew: [{ path: 'C:\\Users\\me\\AppData', before: 100, after: 2100, delta: 2000 }],
      shrank: [],
      added: [{ path: 'C:\\Fresh', size: 500 }],
      removed: [{ path: 'C:\\Gone', size: 300 }]
    });
  });

  it('needs exactly two picked', async () => {
    const user = await mount({ scanned: false });
    const dialog = await openPanel(user);
    const compare = await within(dialog).findByRole('button', { name: 'Compare selected' });
    expect(compare.disabled).toBe(true);
    expect(within(dialog).getByText('Pick two scans to compare.')).toBeTruthy();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Select After to compare' }));
    expect(compare.disabled).toBe(true);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Select Before to compare' }));
    expect(compare.disabled).toBe(false);
  });

  it('shows the total change and the four groups, and goes back', async () => {
    const user = await mount({ scanned: false });
    const dialog = await openPanel(user);
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Select After to compare' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Select Before to compare' }));
    await user.click(within(dialog).getByRole('button', { name: 'Compare selected' }));

    expect(compareSavedScans).toHaveBeenCalledWith('new1', 'old1');
    expect(await within(dialog).findByText('From "Before" to "After"')).toBeTruthy();
    expect(within(dialog).getByText('Total change: +2 KB')).toBeTruthy();
    const grew = within(dialog).getByRole('region', { name: 'Grew the most' });
    expect(grew.textContent).toContain('C:\\Users\\me\\AppData');
    expect(grew.textContent).toContain('+2 KB');
    expect(within(dialog).getByRole('region', { name: 'Shrank the most' }).textContent).toContain('Nothing in this group.');
    expect(within(dialog).getByRole('region', { name: 'New folders' }).textContent).toContain('C:\\Fresh');
    expect(within(dialog).getByRole('region', { name: 'Removed folders' }).textContent).toContain('−300 B');

    await user.click(within(dialog).getByRole('button', { name: 'Back to the list' }));
    expect(await within(dialog).findByRole('button', { name: 'Compare selected' })).toBeTruthy();
  });
});
