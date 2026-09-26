// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** The Disk Map's own copy follows the chosen language -- the property no
 * English-only test can show, since English is also the fallback those
 * tests render under. Windows' own strings (a folder's name, a path) stay
 * exactly as reported, same rule as every other screen.
 *
 * Two Greek strings turned out identical across unrelated catalog keys --
 * "Αρχεία" (view.files AND folderTable.columns.files both just mean
 * "Files") and "Φάκελος" (folderTable.columns.folder AND removeModal.
 * folder both just mean "Folder"). Both pairs render on screen at the
 * same time once a tree is loaded, so a bare screen.getByText/getByRole
 * throws "multiple elements" rather than testing anything -- every
 * assertion on either string below is scoped to the one container it
 * actually means, via `within()`.
 *
 * recharts' <ResponsiveContainer> reports zero size in jsdom (no real
 * layout engine measures it), so <Treemap> would never hand any width or
 * height to a cell and TreemapCell renders nothing at all -- the whole
 * hover/right-click/drill-down surface would be untestable. Mocked here,
 * local to this file only: <Treemap> hands its `content` element real
 * cell data plus a fixed, non-zero geometry instead of asking recharts to
 * lay it out for real. */
vi.mock('recharts', async () => {
  const { cloneElement } = await import('react');
  return {
    ResponsiveContainer: ({ children }) => children,
    Treemap: ({ data, content }) => (data || []).map((node, i) =>
      cloneElement(content, { key: node.fullPath || node.name || i, ...node, x: 10, y: 10, width: 200, height: 120, depth: 1 })
    )
  };
});

const fetchDiskSpace = vi.fn();
const fetchDiskScan = vi.fn();
const scanDriveFast = vi.fn();
const fetchFileTypeIcons = vi.fn(async () => ({}));
const quarantineDiskPath = vi.fn();
const revealInExplorer = vi.fn(async () => {});

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({ language: 'el' })),
  updateSettings: vi.fn(),
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: (...a) => scanDriveFast(...a),
  fetchFileTypeIcons: (...a) => fetchFileTypeIcons(...a),
  quarantineDiskPath: (...a) => quarantineDiskPath(...a),
  revealInExplorer: (...a) => revealInExplorer(...a)
}));

const DiskMap = (await import('./DiskMap.jsx')).default;
const { ScanFailure, LargestFilesView } = await import('./DiskMap.jsx');

afterEach(cleanup);

const GB = 1024 ** 3;

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue(null);
  fetchFileTypeIcons.mockResolvedValue({});
  // No manual navigator.clipboard stub here: userEvent.setup() installs
  // its own (a real, working fake Clipboard, via a getter with no
  // setter) the moment it is first called, unconditionally, and every
  // test here calls it -- a stub assigned before that is simply
  // overwritten. It's a good clipboard for the success path; the one
  // test that needs it to fail overwrites its `writeText` method
  // directly, AFTER setup(), once it exists.
});

function mount() {
  return render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <DiskMap />
            <ToastHost />
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Two directories: one the scan opened (with a file that has an
 * extension and one that doesn't), one it only reported a size for --
 * exactly the shape that gives the by-file-type panel a real "folders
 * the scan did not open" figure to report. Matches the raw shape the
 * backend returns: no `fullPath` (DiskMap.jsx attaches that itself). */
const TREE = {
  name: '', type: 'directory', size: 10_000_000,
  children: [
    {
      name: 'Games', type: 'directory', size: 6_000_000, scanned: true,
      children: [
        { name: 'game.pak', type: 'file', size: 5_000_000, scanned: true },
        { name: 'readme', type: 'file', size: 500_000, scanned: true }
      ]
    },
    { name: 'Docs', type: 'directory', size: 2_000_000, scanned: true }
  ]
};

const crawlButton = () => screen.findByRole('button', { name: "Διατρέξτε τους φακέλους αντ' αυτού" });

describe('the Disk Map in another language, before any scan has run', () => {
  it('translates the title, the subtitle, and the drive-root choice panel', async () => {
    mount();

    expect(await screen.findByRole('heading', { level: 1, name: 'Χάρτης δίσκου' })).toBeTruthy();
    expect(screen.getByText('Χρήση δίσκου: τι καταλαμβάνει χώρο σε αυτόν τον δίσκο και πού.')).toBeTruthy();
    expect(screen.getByText('Ανάγνωση ολόκληρου του δίσκου')).toBeTruthy();
    expect(screen.getByText(/κάθε αρχείο στο C: μέσα σε λίγα δευτερόλεπτα/)).toBeTruthy();
    expect(screen.getByText(/Δεν μπορεί να ολοκληρωθεί σε ολόκληρο δίσκο/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Γρήγορη σάρωση (διαχειριστής)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Διατρέξτε τους φακέλους αντ' αυτού" })).toBeTruthy();
  });

  it('shows the translated loading state after choosing to walk folders', async () => {
    fetchDiskScan.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());

    // The scan card labels itself "Σάρωση: <path>" in one element now
    // (it used to be a heading plus a separate path line).
    expect(await screen.findByText('Σάρωση: C:\\')).toBeTruthy();
    expect(screen.getByText(/Έναν κατάλογο τη φορά/)).toBeTruthy();
    expect(screen.getByRole('button', { name: "Ανάγνωση του ευρετηρίου δίσκου αντ' αυτού (διαχειριστής)" })).toBeTruthy();
  });

  it('says nothing to list, in Greek, for a folder with no children', async () => {
    fetchDiskScan.mockResolvedValue({ name: '', type: 'directory', size: 0, children: [] });
    const user = userEvent.setup();
    mount();
    await user.click(await crawlButton());

    expect(await screen.findByText('Τίποτα για εμφάνιση μέσα σε αυτόν τον φάκελο.')).toBeTruthy();
  });
});

describe('the Disk Map in another language, once a scan has produced a real tree', () => {
  async function mountScanned() {
    fetchDiskScan.mockResolvedValue(TREE);
    const user = userEvent.setup();
    mount();
    await user.click(await crawlButton());
    // The one column header this row has no twin string for elsewhere on
    // screen -- safe to wait on without an ambiguous-match risk.
    await screen.findByText('Μέγεθος');
    return user;
  }

  it('translates the folder-table column headers and the not-scanned badge', async () => {
    await mountScanned();

    const headerRow = screen.getByText('Μέγεθος').closest('[role="row"]');
    for (const label of ['Φάκελος', 'Στοιχεία', 'Αρχεία', 'Φάκελοι', 'Τροποποιήθηκε']) {
      expect(within(headerRow).getByText(label)).toBeTruthy();
    }
  });

  it('translates the by-file-type panel: header, type count, no-type label, footer, and the unopened-folders note', async () => {
    await mountScanned();

    expect(screen.getByText('Κατά τύπο αρχείου')).toBeTruthy();
    expect(screen.getByText('2 τύποι')).toBeTruthy();
    expect(screen.getByText('χωρίς τύπο')).toBeTruthy();
    expect(screen.getByText(/σε 2 αρχεία/)).toBeTruthy();
    expect(screen.getByText(/σε φακέλους που δεν άνοιξε η σάρωση/)).toBeTruthy();
  });

  it('translates the Tree/Files view toggle', async () => {
    await mountScanned();

    const toggleRow = screen.getByRole('button', { name: 'Δέντρο' }).closest('div');
    expect(within(toggleRow).getByRole('button', { name: 'Αρχεία' })).toBeTruthy();
  });

  it('gives a treemap cell a translated aria-label', async () => {
    await mountScanned();
    expect(screen.getByRole('button', { name: 'Άνοιγμα Games' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Άνοιγμα Docs' })).toBeTruthy();
  });

  it('opens a translated context menu on right-click, and its items act', async () => {
    const user = userEvent.setup();
    await mountScanned();

    const cell = screen.getByRole('button', { name: 'Άνοιγμα Games' });
    fireEvent.contextMenu(cell, { clientX: 40, clientY: 40 });

    expect(await screen.findByRole('menuitem', { name: 'Άνοιγμα στην Εξερεύνηση αρχείων' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Αντιγραφή διαδρομής' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Μετακίνηση σε καραντίνα…' })).toBeTruthy();

    await user.click(screen.getByRole('menuitem', { name: 'Αντιγραφή διαδρομής' }));
    expect(await screen.findByText('Η διαδρομή αντιγράφηκε.')).toBeTruthy();
  });

  it('says the path could not be copied, in Greek, when the clipboard refuses', async () => {
    const user = await mountScanned();
    // Only safe to install AFTER mountScanned's own userEvent.setup() has
    // already put its real stub in place -- see the note on beforeEach.
    navigator.clipboard.writeText = vi.fn(() => Promise.reject(new Error('denied')));

    const cell = screen.getByRole('button', { name: 'Άνοιγμα Games' });
    fireEvent.contextMenu(cell, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: 'Αντιγραφή διαδρομής' }));

    expect(await screen.findByText('Αδυναμία αντιγραφής αυτής της διαδρομής.')).toBeTruthy();
  });

  it('translates the quarantine confirmation modal, and the success toast that follows it', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    await mountScanned();

    const cell = screen.getByRole('button', { name: 'Άνοιγμα Games' });
    fireEvent.contextMenu(cell, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: 'Μετακίνηση σε καραντίνα…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Μετακίνηση σε καραντίνα' });
    expect(within(dialog).getByRole('heading', { name: 'Μετακίνηση αυτού σε καραντίνα;' })).toBeTruthy();
    expect(within(dialog).getByText('Μετακινείται, δεν διαγράφεται — επαναφέρετέ το οποιαδήποτε στιγμή από την οθόνη Καραντίνα.')).toBeTruthy();
    // Not an exact match: this line also carries the size (" · 5.7 MB")
    // in the same text node.
    expect(within(dialog).getByText(/Φάκελος/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Ακύρωση' })).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText(/Μετακινήθηκε σε καραντίνα: Games/)).toBeTruthy();
    expect(screen.getByText('Επαναφέρετέ το από την οθόνη Καραντίνα.')).toBeTruthy();
  });

  it('translates the generic move-failed toast when quarantine refuses without naming a reason', async () => {
    // Not `protected` (that path shows Windows' own reason verbatim,
    // untranslated by design) and not `ok` -- the one case Prune has its
    // own copy for.
    quarantineDiskPath.mockResolvedValue({ ok: false, protected: false });
    const user = userEvent.setup();
    await mountScanned();

    const cell = screen.getByRole('button', { name: 'Άνοιγμα Games' });
    fireEvent.contextMenu(cell, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: 'Μετακίνηση σε καραντίνα…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Μετακίνηση σε καραντίνα' });
    await user.click(within(dialog).getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText('Αυτό δεν μπόρεσε να μετακινηθεί.')).toBeTruthy();
  });

  it('says "file" rather than "folder" in the quarantine modal for a file target', async () => {
    fetchDiskScan.mockImplementation(async (path) => (
      path === 'C:\\Games'
        ? { name: 'Games', type: 'directory', size: 5_000_000, children: [
            { name: 'game.pak', type: 'file', size: 5_000_000, scanned: true }
          ] }
        : TREE
    ));
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());
    // Drilling into the directory re-triggers the scan at its own path.
    await user.click(await screen.findByRole('button', { name: 'Άνοιγμα Games' }));
    // "game.pak" renders twice at once here too (folder table row, plus
    // the treemap's own label for it) -- wait on the column header
    // instead, then pick the treemap one by DOM position.
    await screen.findByText('Μέγεθος');
    const fileLabel = screen.getAllByText('game.pak').find((el) => el.closest('g'));

    fireEvent.contextMenu(fileLabel, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByRole('menuitem', { name: 'Μετακίνηση σε καραντίνα…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Μετακίνηση σε καραντίνα' });
    // Not an exact match: this line also carries the size in the same text node.
    expect(within(dialog).getByText(/Αρχείο/)).toBeTruthy();
  });

  it('translates the hover tooltip for a folder the scan never opened, and for the aggregate "smaller items" cell', async () => {
    // "Docs" is scanned: true but carries no `children` at all -- not the
    // same thing as `scanned: false` (that's the coverage banner's own
    // remainder block), but real and common: a folder the scan reported
    // a size for without ever descending into it. Its own tooltip has
    // nothing translated to say (third line is just its real path), so
    // this is really about the OTHER two states: a genuinely unscanned
    // block, and the treemap's own aggregate bucket for whatever didn't
    // fit -- built by feeding it 125 tiny files so limitCells' own real
    // aggregation logic produces the bucket, rather than faking the
    // `aggregated` flag by hand.
    // 1 big directory + 144 tiny files = 145 top-level cells; limitCells'
    // own cap of 120 keeps the 120 largest (the directory among them, by
    // far the biggest single item) and aggregates the remaining 25.
    const manyFiles = Array.from({ length: 144 }, (_, i) => ({
      name: `f${i}.dat`, type: 'file', size: 1, scanned: true
    }));
    fetchDiskScan.mockResolvedValue({
      name: '', type: 'directory', size: 1_000_100,
      children: [
        { name: 'Unreached', type: 'directory', size: 1_000_000, scanned: false },
        ...manyFiles
      ]
    });
    mount();
    const user = userEvent.setup();
    await user.click(await crawlButton());
    // "Unreached" itself renders twice at once -- once as the folder
    // table's own row (real content), once as the treemap cell's label
    // (same node, same name, drawn twice) -- so the wait, and the pick of
    // which one is the treemap cell, both go by the not-scanned badge and
    // by DOM position (`.closest('g')`) instead of by the bare name.
    await screen.findByText('μη σαρωμένο');

    const unreachedLabel = screen.getAllByText('Unreached').find((el) => el.closest('g'));
    fireEvent.mouseEnter(unreachedLabel.closest('g'), { clientX: 10, clientY: 10 });
    expect(await screen.findByText(/δεν έχει μετρηθεί/)).toBeTruthy();
    expect(screen.getByText('Η σάρωση σταμάτησε πριν φτάσει εδώ. Το πραγματικό μέγεθος είναι άγνωστο.')).toBeTruthy();
    fireEvent.mouseLeave(unreachedLabel.closest('g'));

    const aggregateCell = screen.getByText('25 μικρότερα στοιχεία').closest('g');
    fireEvent.mouseEnter(aggregateCell, { clientX: 20, clientY: 20 });
    expect(await screen.findByText('Οι μικρότερες καταχωρίσεις σε αυτόν τον φάκελο, ομαδοποιημένες.')).toBeTruthy();
  });
});

describe('the Disk Map in another language, doing a fast (admin) scan', () => {
  it('translates the fast-index summary, the browsing-instant note, and the rescan button', async () => {
    fetchDiskScan.mockResolvedValue(TREE);
    scanDriveFast.mockResolvedValue({
      tree: TREE,
      stats: { recordsRead: 128000, mftComplete: false }
    });
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());
    await screen.findByText('Μέγεθος');
    await user.click(screen.getByRole('button', { name: 'Γρήγορη σάρωση (διαχειριστής)' }));

    expect(await screen.findByText(/128.000 αρχεία και φάκελοι διαβάστηκαν|128,000 αρχεία και φάκελοι διαβάστηκαν/)).toBeTruthy();
    expect(screen.getByText(/Η περιήγηση είναι άμεση από εδώ\./)).toBeTruthy();
    expect(screen.getByText(/Μέρος του ευρετηρίου δεν μπόρεσε να διαβαστεί/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Επανασάρωση δίσκου (διαχειριστής)' })).toBeTruthy();
  });

  it('shows the Greek scanning label while a fast scan is in flight', async () => {
    fetchDiskScan.mockResolvedValue(TREE);
    let resolveFast;
    scanDriveFast.mockImplementation(() => new Promise((r) => { resolveFast = r; }));
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());
    await screen.findByText('Μέγεθος');
    await user.click(screen.getByRole('button', { name: 'Γρήγορη σάρωση (διαχειριστής)' }));

    expect(await screen.findByRole('button', { name: 'Σάρωση δίσκου…' })).toBeTruthy();
    resolveFast({ tree: TREE, stats: { recordsRead: 1 } });
  });

  it('says the fast scan was declined, in Greek', async () => {
    fetchDiskScan.mockResolvedValue(TREE);
    scanDriveFast.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());
    await screen.findByText('Μέγεθος');
    await user.click(screen.getByRole('button', { name: 'Γρήγορη σάρωση (διαχειριστής)' }));

    expect(await screen.findByText('Δεν εγκρίθηκε — εξακολουθεί να χρησιμοποιείται η σάρωση φάκελο προς φάκελο.')).toBeTruthy();
  });
});

describe('the Disk Map in another language, when a scan ran out of time', () => {
  it('translates the banner without a coverage figure, and its rescan link', async () => {
    // No used-space figure at all (fetchDiskSpace resolves null, the
    // default), so withUnscannedRemainder never adds a remainder block --
    // exactly the case scanCoverage reports as null.
    fetchDiskScan.mockResolvedValue({ ...TREE, truncated: true });
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());

    expect(await screen.findByText(/Αυτή η σάρωση εξάντλησε τον χρόνο της πριν ολοκληρώσει τον δίσκο\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: "Εκτελέστε αντ' αυτού μια γρήγορη σάρωση" })).toBeTruthy();
  });

  it('translates the banner WITH a coverage figure, once real used-space is known', async () => {
    // used = 800 GB, the truncated tree measured 40 GB of it -- a real,
    // clean 5% that withUnscannedRemainder will accept (comfortably past
    // its 2% noise floor) and scanCoverage will report back as such.
    fetchDiskSpace.mockResolvedValue({ freeBytes: 200 * GB, totalBytes: 1000 * GB });
    fetchDiskScan.mockResolvedValue({ ...TREE, size: 40 * GB, truncated: true });
    const user = userEvent.setup();
    mount();

    await user.click(await crawlButton());

    expect(await screen.findByText(/Αυτή η σάρωση εξάντλησε τον χρόνο της: μέτρησε 40 GB από τα 800 GB που χρησιμοποιούνται \(5%\)\./))
      .toBeTruthy();
  });
});

describe('the Disk Map in another language, after the user pressed Stop', () => {
  async function stoppedScan() {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 200 * GB, totalBytes: 1000 * GB });
    fetchDiskScan.mockImplementation(async (_path, _signal, opts) => {
      opts?.onProgress?.({ type: 'complete', totalFiles: 10, totalBytes: 40 * GB, truncated: true, stoppedByUser: true, resultId: 'x' });
      return { ...TREE, size: 40 * GB, truncated: true };
    });
    const user = userEvent.setup();
    mount();
    await user.click(await crawlButton());
    return user;
  }

  it('says it once, in Greek, in the card, and never that time ran out', async () => {
    await stoppedScan();

    await screen.findByText(/Διακόψατε αυτή τη σάρωση: μέτρησε 40 GB από τα 800 GB/);
    expect(screen.getAllByText(/μέτρησε 40 GB/)).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/εξάντλησε τον χρόνο/);
  });

  it('names the unscanned block in Greek, not with the stored English key', async () => {
    await stoppedScan();

    await screen.findByText(/Διακόψατε αυτή τη σάρωση/);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Δεν σαρώθηκε')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Not scanned');
  });

  it('gives every folder row a translated open label and a translated actions button', async () => {
    fetchDiskScan.mockResolvedValue(TREE);
    const user = userEvent.setup();
    mount();
    await user.click(await crawlButton());

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('button', { name: /^Άνοιγμα .+, / }).length).toBeGreaterThan(0);
    expect(within(table).getAllByRole('button', { name: /^Ενέργειες για το / }).length).toBeGreaterThan(0);
  });
});

describe('the exported ScanFailure and LargestFilesView pieces, in another language', () => {
  function mountPiece(ui) {
    return render(
      <QueryClientProvider client={makeTestClient()}>
        <ThemeProvider>
          <LanguageProvider>{ui}</LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  it('translates a scan failure message', async () => {
    mountPiece(<ScanFailure path={'D:\\Games'} error="EACCES" />);
    expect(await screen.findByText('Αδυναμία σάρωσης του «D:\\Games»: EACCES')).toBeTruthy();
  });

  it('translates the empty largest-files message', async () => {
    mountPiece(<LargestFilesView files={[]} icons={{}} />);
    expect(await screen.findByText('Η σάρωση δεν βρήκε αρχεία για εμφάνιση.')).toBeTruthy();
  });
});
