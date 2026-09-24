// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';
import { INK_DARK, INK_LIGHT } from '../lib/fileTypeColors.js';

/** The Disk Map after the Apple design pass: one message after Stop, a
 * translated unscanned block, keyboard-reachable folder rows, a menu on every
 * row, table semantics, and a treemap label that can be read. */

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
const revealInExplorer = vi.fn(async () => {});

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: vi.fn(),
  stopDiskScan: vi.fn(async () => true),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(),
  revealInExplorer: (...a) => revealInExplorer(...a)
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue(null);
});

const GB = 1024 ** 3;

function ui(client) {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <MotionConfig reducedMotion="always">
              <DiskMap />
            </MotionConfig>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
const mount = (client = makeTestClient()) => render(ui(client));

const TREE = {
  name: '', type: 'directory', size: 10 * GB,
  children: [
    { name: 'Games', type: 'directory', size: 8 * GB, scanned: true, children: [{ name: 'a.pak', type: 'file', size: 8 * GB }] },
    { name: 'movie.mp4', type: 'file', size: 1 * GB }
  ]
};

const crawl = async (user) => user.click(await screen.findByRole('button', { name: 'Walk folders instead' }));

async function mountScanned(tree = TREE) {
  fetchDiskScan.mockResolvedValue(tree);
  const user = userEvent.setup();
  mount();
  await crawl(user);
  await screen.findByRole('table');
  return user;
}

describe('after Stop the screen says ONE thing', () => {
  const USED = { freeBytes: 200 * GB, totalBytes: 1000 * GB };

  function scanEndingWith(complete) {
    fetchDiskSpace.mockResolvedValue(USED);
    fetchDiskScan.mockImplementation(async (_path, _signal, opts) => {
      opts?.onProgress?.({ type: 'complete', totalFiles: 25677, totalBytes: 40 * GB, truncated: true, resultId: 'x', ...complete });
      return { ...TREE, size: 40 * GB, truncated: true };
    });
  }

  it('a user stop: one card with the coverage sentence, no banner, no "ran out of time" anywhere', async () => {
    scanEndingWith({ stoppedByUser: true });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    const card = await screen.findByRole('status');
    expect(card.textContent).toContain('You stopped this scan: it measured 40 GB of the 800 GB in use (5%).');
    expect(document.body.textContent).not.toMatch(/ran out of time/);
    // The sentence exists exactly once on the page: the old second banner is gone.
    expect(screen.getAllByText(/it measured 40 GB/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Run a fast scan instead' })).toHaveLength(1);
  });

  it('a time-limit stop says so, once, and not that the user stopped it', async () => {
    scanEndingWith({ stoppedByUser: false });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    const card = await screen.findByRole('status');
    expect(card.textContent).toContain('This scan ran out of time: it measured 40 GB of the 800 GB in use (5%).');
    expect(document.body.textContent).not.toMatch(/You stopped/);
    expect(screen.getAllByText(/it measured 40 GB/)).toHaveLength(1);
  });

  it('the unscanned block is named by the catalog and never claims a cause', async () => {
    scanEndingWith({ stoppedByUser: true });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Not scanned')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Not scanned \(ran out of time\)/);
  });

  it('a cached partial tree with no card keeps the explanation, still worded for a user stop', async () => {
    scanEndingWith({ stoppedByUser: true });
    const client = makeTestClient();
    const user = userEvent.setup();
    const first = mount(client);
    await crawl(user);
    await screen.findByRole('status');
    first.unmount();

    // Back on the folder later: the tree is cached, no scan runs, no card.
    mount(client);
    await screen.findByRole('table');
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.body.textContent).toContain('You stopped this scan: it measured 40 GB');
    expect(fetchDiskScan).toHaveBeenCalledTimes(1);
  });
});

describe('the folder table is keyboard-operable and is a table', () => {
  it('has table semantics with the default sort announced, and moves aria-sort when re-sorted', async () => {
    const user = await mountScanned();

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    const sizeHeader = headers.find((h) => h.textContent === 'Size');
    expect(sizeHeader.getAttribute('aria-sort')).toBe('descending');
    expect(headers.filter((h) => h.hasAttribute('aria-sort'))).toHaveLength(1);

    await user.click(within(table).getByRole('button', { name: 'Items' }));
    const itemsHeader = within(table).getAllByRole('columnheader').find((h) => h.textContent === 'Items');
    expect(itemsHeader.getAttribute('aria-sort')).toBe('descending');
    expect(sizeHeader.hasAttribute('aria-sort')).toBe(false);
  });

  it('gives every folder a real button named with what it opens and how big it is, and Enter drills in', async () => {
    const user = await mountScanned();

    const open = within(screen.getByRole('table')).getByRole('button', { name: 'Open Games, 8 GB' });
    expect(open.tagName).toBe('BUTTON');
    open.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(fetchDiskScan.mock.calls.at(-1)[0]).toBe('C:\\Games'));
  });

  it('Space drills in as well', async () => {
    const user = await mountScanned();

    within(screen.getByRole('table')).getByRole('button', { name: 'Open Games, 8 GB' }).focus();
    await user.keyboard(' ');

    await waitFor(() => expect(fetchDiskScan.mock.calls.at(-1)[0]).toBe('C:\\Games'));
  });

  it('files and unmeasured blocks are not offered as openable', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 200 * GB, totalBytes: 1000 * GB });
    await mountScanned({ ...TREE, size: 10 * GB, truncated: true });

    const table = screen.getByRole('table');
    expect(within(table).queryByRole('button', { name: /^Open movie\.mp4/ })).toBeNull();
    expect(within(table).queryByRole('button', { name: /^Open Not scanned/ })).toBeNull();
  });

  it('rows past the treemap 120-cell cutoff are still reachable, and drill in', async () => {
    const many = {
      name: '', type: 'directory', size: 1000 * GB,
      children: Array.from({ length: 150 }, (_, i) => ({
        name: `dir-${String(i).padStart(3, '0')}`, type: 'directory', size: (1000 - i) * 1024 ** 2, scanned: true
      }))
    };
    const user = await mountScanned(many);

    // The map only draws 120 cells plus one grouped block ...
    expect(document.querySelectorAll('g[role="button"]').length).toBeLessThanOrEqual(120);
    expect(screen.queryByText('dir-149', { selector: 'text' })).toBeNull();
    // ... but the table lists all 150, and the last is one keystroke away.
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('button', { name: /^Open dir-/ })).toHaveLength(150);
    const last = within(table).getByRole('button', { name: /^Open dir-149, / });
    last.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(fetchDiskScan.mock.calls.at(-1)[0]).toBe('C:\\dir-149'));
  });

  it('a mouse click anywhere on the row still drills in, once', async () => {
    const user = await mountScanned();

    const row = within(screen.getByRole('table')).getAllByRole('row').find((r) => r.textContent.includes('Games'));
    await user.click(row);
    await waitFor(() => expect(fetchDiskScan.mock.calls.at(-1)[0]).toBe('C:\\Games'));
    expect(fetchDiskScan.mock.calls.filter((c) => c[0] === 'C:\\Games')).toHaveLength(1);
  });
});

describe('every row has a menu, by right-click or by the "..." button', () => {
  it('the "..." button on a folder row opens the same menu as the map', async () => {
    const user = await mountScanned();

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Actions for Games' }));

    expect(await screen.findByText('Open in Explorer')).toBeTruthy();
    expect(screen.getByText('Copy path')).toBeTruthy();
    await user.click(screen.getByText('Open in Explorer'));
    expect(revealInExplorer).toHaveBeenCalledWith('C:\\Games');
    // Opening the menu did not also drill into the folder.
    expect(fetchDiskScan).toHaveBeenCalledTimes(1);
  });

  it('a right-click on a row opens it too, and offers the guarded move to quarantine', async () => {
    const user = await mountScanned();

    const row = within(screen.getByRole('table')).getAllByRole('row').find((r) => r.textContent.includes('Games'));
    fireEvent.contextMenu(row, { clientX: 40, clientY: 40 });
    await user.click(await screen.findByText('Move to quarantine…'));

    expect(await screen.findByText('Move this to quarantine?')).toBeTruthy();
    expect(screen.getByText('C:\\Games')).toBeTruthy();
  });

  it('a file row has the button as well', async () => {
    await mountScanned();
    expect(within(screen.getByRole('table')).getByRole('button', { name: 'Actions for movie.mp4' })).toBeTruthy();
  });

  it('the unmeasured block has neither a button nor a menu', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 200 * GB, totalBytes: 1000 * GB });
    await mountScanned({ ...TREE, truncated: true });

    const table = screen.getByRole('table');
    expect(within(table).queryByRole('button', { name: 'Actions for Not scanned' })).toBeNull();
    const row = within(table).getAllByRole('row').find((r) => r.textContent.includes('Not scanned'));
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    expect(screen.queryByText('Open in Explorer')).toBeNull();
  });

  it('the Largest files rows have the "..." button too', async () => {
    const user = await mountScanned();

    await user.click(screen.getByRole('button', { name: 'Files', pressed: false }));
    await user.click(await screen.findByRole('button', { name: 'Actions for a.pak' }));
    expect(await screen.findByText('Move to quarantine…')).toBeTruthy();
  });
});

describe('the treemap label can be read', () => {
  it('uses the dark ink on a type colour and white on the neutrals', async () => {
    await mountScanned();

    const labels = [...document.querySelectorAll('text')];
    const fillOf = (name) => labels.find((el) => el.textContent === name)?.getAttribute('fill');
    // movie.mp4 is painted a palette colour; Games is a directory neutral.
    expect(fillOf('movie.mp4')).toBe(INK_DARK);
    expect(fillOf('Games')).toBe(INK_LIGHT);
    // Full opacity: the old 85% white is gone.
    for (const label of labels) expect(label.hasAttribute('fill-opacity')).toBe(false);
  });

  it('keyboard focus draws a stroke on the cell (a rule exists, and it is scoped to the rectangle)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toMatch(/\.treemap-cells \.treemap-cell:focus-visible\s*>\s*rect\s*\{[^}]*stroke-width/);
  });
});

describe('small things', () => {
  it('the breadcrumb says where you are and is a 24 px target', async () => {
    await mountScanned();

    const here = screen.getByRole('button', { name: 'C:' });
    expect(here.getAttribute('aria-current')).toBe('page');
    expect(here.className).toContain('min-h-6');
  });

  it('the folder table and the type panel sit side by side only from 1400 px, never at lg', async () => {
    await mountScanned();

    const wrapper = [...document.querySelectorAll('div')].find((d) => /min-\[1400px\]:grid-cols/.test(d.className));
    expect(wrapper).toBeTruthy();
    expect(document.body.innerHTML).not.toContain('lg:grid-cols-[minmax(0,1fr)_360px]');
  });

  it('the drive chooser heading is an h2 under the page h1', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 2, name: 'Read the whole drive' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Disk Map' })).toBeTruthy();
  });
});
