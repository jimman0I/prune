// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** The Disk Map remembering the last scan of each drive: it opens on it at once,
 * says when it was made, offers to scan again (never does it by itself), saves a
 * finished scan on its own, and says what grew between the last two. */

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

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const fetchSettings = vi.fn();
const fetchDrives = vi.fn();
const scanDriveFast = vi.fn();
const fetchDiskScan = vi.fn();
const fetchAutoScans = vi.fn();
const saveAutoDiskScan = vi.fn();
const loadSavedScan = vi.fn();
const compareSavedScans = vi.fn();
const quarantineDiskPath = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(async () => null),
  fetchDrives: (...a) => fetchDrives(...a),
  scanDriveFast: (...a) => scanDriveFast(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  stopDiskScan: vi.fn(),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: (...a) => quarantineDiskPath(...a),
  revealInExplorer: vi.fn(async () => {}),
  fetchAutoScans: (...a) => fetchAutoScans(...a),
  saveAutoDiskScan: (...a) => saveAutoDiskScan(...a),
  loadSavedScan: (...a) => loadSavedScan(...a),
  compareSavedScans: (...a) => compareSavedScans(...a),
  saveDiskScan: vi.fn(),
  fetchSavedScans: vi.fn(async () => []),
  deleteSavedScan: vi.fn()
}));

const DiskMap = (await import('./DiskMap.jsx')).default;
afterEach(cleanup);

const HOUR = 60 * 60 * 1000;
const meta = (id, extra = {}) => ({
  id, label: 'Automatic scan of C:', savedAt: Date.now() - 3 * HOUR, root: 'C:', source: 'fast', truncated: false,
  totalBytes: 5000, auto: true, drive: 'C', capacityBytes: 100 * GB, ...extra
});
const archiveOf = (folderName = 'OldGames') => ({
  v: 1,
  root: { n: 'C:', s: 5000, f: 12, d: 2, fc: 2, fb: 1000, c: [{ n: folderName, s: 4000, f: 10, d: 1, fc: 10, fb: 4000 }] },
  top: [{ p: `C:\\${folderName}\\huge.pak`, s: 3000 }]
});
const LIVE = {
  name: 'C:', type: 'directory', size: 1500,
  children: [
    { name: 'FreshGames', type: 'directory', size: 900, children: [{ name: 'a.pak', type: 'file', size: 900 }] },
    { name: 'note.txt', type: 'file', size: 600 }
  ]
};
const drive = (letter, extra = {}) => ({
  letter, label: `Disk ${letter}`, fileSystem: 'NTFS', totalBytes: 100 * GB, freeBytes: 40 * GB,
  removable: false, system: letter === 'C', ntfs: true, ...extra
});
const comparison = (extra = {}) => ({
  older: meta('old1', { savedAt: Date.now() - 48 * HOUR }),
  newer: meta('new1'),
  totalBefore: 1000 * MB, totalAfter: 1000 * MB + 3 * GB, delta: 3 * GB,
  grew: [
    { path: 'C:\\Users\\me\\AppData', before: 0, after: 2 * GB, delta: 2 * GB },
    { path: 'C:\\OldGames', before: 0, after: 512 * MB, delta: 512 * MB }
  ],
  shrank: [], added: [{ path: 'C:\\Fresh', size: 700 * MB }], removed: [],
  ...extra
});

let autoList;
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  autoList = [];
  fetchSettings.mockResolvedValue({});
  fetchDrives.mockResolvedValue({ systemDrive: 'C', drives: [drive('C'), drive('D')] });
  fetchAutoScans.mockImplementation(async (letter) => ({ scans: autoList.filter((s) => s.drive === letter), count: autoList.length, bytes: 1 }));
  loadSavedScan.mockImplementation(async (id) => ({ scan: autoList.find((s) => s.id === id), archive: archiveOf() }));
  scanDriveFast.mockResolvedValue({ drives: [{ driveLetter: 'C', tree: JSON.parse(JSON.stringify(LIVE)), stats: {} }] });
  saveAutoDiskScan.mockResolvedValue({ id: 'saved1' });
  compareSavedScans.mockResolvedValue(comparison());
});

function mount() {
  return render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider><LanguageProvider><ToastProvider><MotionConfig reducedMotion="always">
        <DiskMap />
      </MotionConfig></ToastProvider></LanguageProvider></ThemeProvider>
    </QueryClientProvider>
  );
}
const CHOOSER = /every file on C: in a few seconds/;

describe('opening on the last scan', () => {
  beforeEach(() => { autoList = [meta('new1')]; });

  it('shows the drive at once, with when it was scanned, and starts no scan', async () => {
    mount();
    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain('Last scan of C:');
    expect(banner.textContent).toContain('Scanned 3 hours ago');
    expect(banner.textContent).toContain('not now');
    expect(within(await screen.findByRole('table')).getByText('OldGames')).toBeTruthy();
    expect(screen.queryByText(CHOOSER)).toBeNull();
    expect(loadSavedScan).toHaveBeenCalledWith('new1');
    expect(scanDriveFast).not.toHaveBeenCalled();
    expect(fetchDiskScan).not.toHaveBeenCalled();
  });

  it('offers both ways to scan again, once, and keeps the drive chooser', async () => {
    mount();
    const banner = await screen.findByRole('status');
    expect(within(banner).getByRole('button', { name: 'Fast scan (admin)' })).toBeTruthy();
    expect(within(banner).getByRole('button', { name: 'Walk folders instead' })).toBeTruthy();
    // The header's own rescan button steps aside rather than saying the same thing twice.
    expect(screen.getAllByRole('button', { name: 'Fast scan (admin)' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /D:.*Disk D/ })).toBeTruthy();
  });

  it('leads with the way the person scanned last time', async () => {
    window.localStorage.setItem('prune.diskScanMode', 'crawl');
    mount();
    const banner = await screen.findByRole('status');
    expect(within(banner).getByRole('button', { name: 'Walk folders instead' }).className).toContain('btn-primary');
    expect(within(banner).getByRole('button', { name: 'Fast scan (admin)' }).className).toContain('btn-ghost');
  });

  it('cannot move anything to Quarantine from it, as with a scan reopened by hand', async () => {
    mount();
    const table = await screen.findByRole('table');
    fireEvent.contextMenu(within(table).getAllByRole('row').find((r) => r.textContent.startsWith('OldGames')));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Properties' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: 'Move to quarantine…' })).toBeNull();
    expect(quarantineDiskPath).not.toHaveBeenCalled();
  });

  it('a fast scan replaces it with the live drive and saves the new scan', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await within(await screen.findByRole('status')).findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(scanDriveFast).toHaveBeenCalledWith(['C']));
    expect(await within(await screen.findByRole('table')).findByText('FreshGames')).toBeTruthy();
    expect(screen.queryByText('Last scan of C:')).toBeNull();
    expect(screen.queryByText('OldGames')).toBeNull();

    await waitFor(() => expect(saveAutoDiskScan).toHaveBeenCalledTimes(1));
    const sent = saveAutoDiskScan.mock.calls[0][0];
    expect(sent).toMatchObject({ drive: 'C', source: 'fast', truncated: false, label: 'Automatic scan of C:', capacityBytes: 100 * GB });
    expect(sent.archive.v).toBe(1);
    expect(sent.archive.root.n).toBe('C:');
    expect(sent.archive.root.c.map((c) => c.n)).toEqual(['FreshGames']);
  });

  it('keeps the last scan in view when the fast scan is declined', async () => {
    scanDriveFast.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    mount();
    await user.click(await within(await screen.findByRole('status')).findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(scanDriveFast).toHaveBeenCalled());
    expect(await screen.findByText('Last scan of C:')).toBeTruthy();
    expect(saveAutoDiskScan).not.toHaveBeenCalled();
  });

  it('walking the folders starts that walk, and its finished tree is saved too', async () => {
    fetchDiskScan.mockResolvedValue({
      name: 'C:\\', type: 'directory', size: 700,
      children: [{ name: 'Walked', type: 'directory', size: 700, children: [{ name: 'w.bin', type: 'file', size: 700 }] }]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await within(await screen.findByRole('status')).findByRole('button', { name: 'Walk folders instead' }));
    await waitFor(() => expect(fetchDiskScan).toHaveBeenCalled());
    expect(fetchDiskScan.mock.calls[0][0]).toBe('C:\\');
    expect(await within(await screen.findByRole('table')).findByText('Walked')).toBeTruthy();
    expect(screen.queryByText('Last scan of C:')).toBeNull();
    await waitFor(() => expect(saveAutoDiskScan).toHaveBeenCalledTimes(1));
    expect(saveAutoDiskScan.mock.calls[0][0]).toMatchObject({ drive: 'C', source: 'crawl', archive: { root: { n: 'C:' } } });
  });

  it('does not save a walk that was cut short', async () => {
    fetchDiskScan.mockResolvedValue({
      name: 'C:\\', type: 'directory', size: 700, truncated: true,
      children: [{ name: 'Walked', type: 'directory', size: 700, children: [] }]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await within(await screen.findByRole('status')).findByRole('button', { name: 'Walk folders instead' }));
    await within(await screen.findByRole('table')).findByText('Walked');
    await new Promise((r) => setTimeout(r, 30));
    expect(saveAutoDiskScan).not.toHaveBeenCalled();
  });

  it('picking another drive opens that drive\'s last scan', async () => {
    autoList = [meta('c1'), meta('d1', { drive: 'D', root: 'D:', label: 'Automatic scan of D:' })];
    loadSavedScan.mockImplementation(async (id) => ({
      scan: autoList.find((s) => s.id === id),
      archive: id === 'd1' ? { v: 1, root: { n: 'D:', s: 10, f: 1, d: 1, fc: 0, fb: 0, c: [{ n: 'Photos', s: 10, f: 1, d: 0, fc: 1, fb: 10 }] }, top: [] } : archiveOf()
    }));
    const user = userEvent.setup();
    mount();
    await screen.findByText('OldGames');
    await user.click(screen.getByRole('button', { name: /D:.*Disk D/ }));
    expect((await screen.findByRole('status')).textContent).toContain('Last scan of D:');
    expect(await within(await screen.findByRole('table')).findByText('Photos')).toBeTruthy();
    expect(scanDriveFast).not.toHaveBeenCalled();
  });
});

describe('when there is nothing to open', () => {
  it('shows the drive chooser as before when no scan was ever remembered', async () => {
    mount();
    expect(await screen.findByText(CHOOSER)).toBeTruthy();
    expect(screen.queryByText('Last scan of C:')).toBeNull();
  });

  it('shows the chooser when the remembered scan cannot be opened', async () => {
    autoList = [meta('new1')];
    loadSavedScan.mockRejectedValue(new Error('That saved scan is not there.'));
    mount();
    expect(await screen.findByText(CHOOSER)).toBeTruthy();
    expect(screen.queryByText('Last scan of C:')).toBeNull();
  });

  it('shows the chooser when the lookup itself fails', async () => {
    fetchAutoScans.mockRejectedValue(new Error('backend down'));
    mount();
    expect(await screen.findByText(CHOOSER)).toBeTruthy();
  });
});

describe('with remembering switched off', () => {
  beforeEach(() => {
    autoList = [meta('new1'), meta('old1', { savedAt: Date.now() - 48 * HOUR })];
    fetchSettings.mockResolvedValue({ rememberDiskMapScans: false });
  });

  it('opens on the chooser, looks up nothing and shows no summary', async () => {
    mount();
    expect(await screen.findByText(CHOOSER)).toBeTruthy();
    expect(fetchAutoScans).not.toHaveBeenCalled();
    expect(loadSavedScan).not.toHaveBeenCalled();
    expect(screen.queryByText('What grew since the last scan')).toBeNull();
  });

  it('does not save a scan it has just made', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await within(await screen.findByRole('table')).findByText('FreshGames');
    await new Promise((r) => setTimeout(r, 30));
    expect(saveAutoDiskScan).not.toHaveBeenCalled();
  });
});

describe('saving the scan just made', () => {
  it('saves a fast scan on a fresh start too, without anything to open first', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(saveAutoDiskScan).toHaveBeenCalledTimes(1));
  });

  it('does not save an incomplete index', async () => {
    scanDriveFast.mockResolvedValue({ drives: [{ driveLetter: 'C', tree: JSON.parse(JSON.stringify(LIVE)), stats: { mftComplete: false } }] });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await within(await screen.findByRole('table')).findByText('FreshGames');
    await new Promise((r) => setTimeout(r, 30));
    expect(saveAutoDiskScan).not.toHaveBeenCalled();
  });

  it('keeps the scan on screen and says nothing when the save fails', async () => {
    saveAutoDiskScan.mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(saveAutoDiskScan).toHaveBeenCalled());
    expect(await within(await screen.findByRole('table')).findByText('FreshGames')).toBeTruthy();
    expect(screen.queryByText(/disk full/)).toBeNull();
  });

  it('saves each drive of a multi-drive scan under its own letter', async () => {
    const dTree = { name: 'D:', type: 'directory', size: 50, children: [{ name: 'Photos', type: 'directory', size: 50, children: [] }] };
    scanDriveFast.mockResolvedValue({ drives: [
      { driveLetter: 'C', tree: JSON.parse(JSON.stringify(LIVE)), stats: {} },
      { driveLetter: 'D', tree: dTree, stats: {} }
    ] });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(saveAutoDiskScan).toHaveBeenCalledTimes(2));
    expect(saveAutoDiskScan.mock.calls.map((c) => [c[0].drive, c[0].archive.root.n]).sort()).toEqual([['C', 'C:'], ['D', 'D:']]);
  });
});

describe('what grew since the last scan', () => {
  beforeEach(() => {
    autoList = [meta('new1'), meta('old1', { savedAt: Date.now() - 48 * HOUR })];
  });

  it('beside the last scan: the total change and the folders that grew most', async () => {
    mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    expect(compareSavedScans).toHaveBeenCalledWith('old1', 'new1', 5);
    expect(await within(panel).findByText('Total change: +3 GB')).toBeTruthy();
    const rows = within(panel).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows[0]).toContain('+2 GB');
    expect(rows[0]).toContain('C:\\Users\\me\\AppData');
    expect(rows[1]).toContain('+700 MB');
    expect(rows[1]).toContain('C:\\Fresh');
    expect(rows[1]).toContain('New');
    expect(rows[2]).toContain('+512 MB');
    expect(panel.textContent).toContain('Compared with the scan from 2 days ago');
  });

  it('opens a folder in the map when its row is chosen', async () => {
    mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    fireEvent.click(await within(panel).findByRole('button', { name: /OldGames/ }));
    const crumbs = await screen.findByRole('button', { name: 'OldGames' });
    expect(crumbs.getAttribute('aria-current')).toBe('page');
  });

  it('after a rescan, compares the new scan with the one before it', async () => {
    const user = userEvent.setup();
    autoList = [meta('old1', { savedAt: Date.now() - 48 * HOUR })];
    saveAutoDiskScan.mockImplementation(async () => {
      autoList = [meta('saved1'), ...autoList];
      return { id: 'saved1' };
    });
    compareSavedScans.mockResolvedValue(comparison({ newer: meta('saved1') }));
    mount();
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'What grew since the last scan' })).toBeNull();

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Fast scan (admin)' }));
    await within(await screen.findByRole('table')).findByText('FreshGames');
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    expect(compareSavedScans).toHaveBeenCalledWith('old1', 'saved1', 5);
    expect(await within(panel).findByText('Total change: +3 GB')).toBeTruthy();
  });

  it('is absent when there is only one scan to speak of', async () => {
    autoList = [meta('new1')];
    mount();
    await screen.findByRole('status');
    expect(screen.queryByRole('region', { name: 'What grew since the last scan' })).toBeNull();
    expect(compareSavedScans).not.toHaveBeenCalled();
  });

  it('is absent after a first scan when nothing came before it', async () => {
    saveAutoDiskScan.mockImplementation(async () => {
      autoList = [meta('saved1')];
      return { id: 'saved1' };
    });
    autoList = [];
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(saveAutoDiskScan).toHaveBeenCalled());
    await within(await screen.findByRole('table')).findByText('FreshGames');
    expect(screen.queryByRole('region', { name: 'What grew since the last scan' })).toBeNull();
  });

  it('is not shown beside a live scan that was not saved, which would compare stale scans', async () => {
    saveAutoDiskScan.mockResolvedValue(null); // the setting says no
    const user = userEvent.setup();
    mount();
    await user.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Fast scan (admin)' }));
    await within(await screen.findByRole('table')).findByText('FreshGames');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('region', { name: 'What grew since the last scan' })).toBeNull();
  });

  it('says so when no folder grew enough to list', async () => {
    compareSavedScans.mockResolvedValue(comparison({ delta: 40 * 1024, grew: [{ path: 'C:\\Tiny', before: 0, after: 40960, delta: 40960 }], added: [] }));
    mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    expect(await within(panel).findByText('No folder grew by 1 MB or more.')).toBeTruthy();
    expect(within(panel).queryAllByRole('listitem')).toHaveLength(0);
    expect(panel.textContent).toContain('Total change: +40 KB');
  });

  it('shows a shrink honestly as a negative total', async () => {
    compareSavedScans.mockResolvedValue(comparison({ delta: -2 * GB, grew: [], added: [] }));
    mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    expect(await within(panel).findByText('Total change: −2 GB')).toBeTruthy();
  });

  it('warns when either scan was partial, the drive changed size, or the scans were made differently', async () => {
    compareSavedScans.mockResolvedValue(comparison({
      older: meta('old1', { truncated: true, source: 'crawl', capacityBytes: 50 * GB }),
      newer: meta('new1')
    }));
    mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    expect(await within(panel).findByText(/One of the two scans was partial/)).toBeTruthy();
    expect(within(panel).getByText(/The drive changed size between the two scans/)).toBeTruthy();
    expect(within(panel).getByText(/One scan was a fast scan and the other walked the folders/)).toBeTruthy();
  });

  it('always says that smaller items are compared by their folder\'s total only', async () => {
    mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    expect(await within(panel).findByText(/Compares folder totals/)).toBeTruthy();
  });

  it('can be folded away, and stays folded the next time', async () => {
    const user = userEvent.setup();
    const first = mount();
    const panel = await screen.findByRole('region', { name: 'What grew since the last scan' });
    const toggle = await within(panel).findByRole('button', { name: 'What grew since the last scan' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(panel).queryAllByRole('listitem')).toHaveLength(0);
    // The total stays in the header: folding hides the detail, not the answer.
    expect(within(panel).getByText('Total change: +3 GB')).toBeTruthy();

    first.unmount();
    mount();
    const again = await screen.findByRole('button', { name: 'What grew since the last scan' });
    expect(again.getAttribute('aria-expanded')).toBe('false');
  });

  it('says nothing when the comparison cannot be made', async () => {
    compareSavedScans.mockRejectedValue(new Error('One of those saved scans is no longer there.'));
    mount();
    await screen.findByRole('status');
    await waitFor(() => expect(compareSavedScans).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'What grew since the last scan' })).toBeNull();
    expect(screen.queryByText(/no longer there/)).toBeNull();
  });
});
