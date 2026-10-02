// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** The folder walk of a whole drive: no clock, results as they build, an
 * honest account of the part not read yet, and the Stop button still there. */

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
const fetchDiskScan = vi.fn();
const stopDiskScan = vi.fn(async () => true);
vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(async () => ({ totalBytes: 100 * GB, freeBytes: 60 * GB })),
  fetchDrives: vi.fn(async () => ({ systemDrive: 'C', drives: [] })),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  stopDiskScan: (...a) => stopDiskScan(...a),
  scanDriveFast: vi.fn(),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(),
  revealInExplorer: vi.fn(async () => {})
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });

const SNAPSHOT = {
  name: 'C:', type: 'directory', size: 12 * GB, allocated: 13 * GB, partial: true, truncated: true,
  children: [
    { name: 'Users', type: 'directory', size: 9 * GB, children: [{ name: 'me', type: 'directory', size: 9 * GB }] },
    { name: 'Windows', type: 'directory', size: 2 * GB },
    { name: '', type: 'file', aggregated: true, count: 41, size: 1 * GB }
  ]
};

async function startWalk() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider><LanguageProvider><ToastProvider><MotionConfig reducedMotion="always">
        <DiskMap />
      </MotionConfig></ToastProvider></LanguageProvider></ThemeProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByRole('button', { name: 'Walk folders instead' }));
  return user;
}

describe('a folder walk of a whole drive, while it runs', () => {
  it('shows what has been read so far in the Tree view, beside the progress card', async () => {
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'start', scanId: 'w1' });
      opts.onProgress({ type: 'progress', files: 500, bytes: 12 * GB, percent: 30, snapshot: SNAPSHOT });
      return new Promise(() => {});
    });
    await startWalk();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Users')).toBeTruthy();
    expect(within(table).getByText('Windows')).toBeTruthy();
    expect(screen.getByText('Scanning C:\\')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.getByText('Showing what has been read so far. Sizes keep growing until the scan finishes.')).toBeTruthy();
  });

  it('accounts for the part not read yet as unscanned, from the drive\'s real used space', async () => {
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'progress', files: 5, bytes: 12 * GB, percent: 30, snapshot: SNAPSHOT });
      return new Promise(() => {});
    });
    await startWalk();
    const table = await screen.findByRole('table');
    // 40 GB in use, 12 GB read: the other 28 GB is a block marked not scanned,
    // not an absence, and every folder is a share of the whole drive.
    expect(within(table).getByText('Not scanned').closest('[role="row"]').textContent).toContain('not scanned');
    expect(document.querySelector('.treemap-cell[data-name="Not scanned"]')).not.toBeNull();
    expect(within(table).getByText('Users').closest('[role="row"]').textContent).toContain('22.5%');
  });

  it('names the folded-together block in the user\'s language', async () => {
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'progress', files: 5, bytes: 12 * GB, percent: 30, snapshot: SNAPSHOT });
      return new Promise(() => {});
    });
    await startWalk();
    expect(within(await screen.findByRole('table')).getByText('41 smaller items')).toBeTruthy();
  });

  it('shows only the card until the walk has read something', async () => {
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'start', scanId: 'w1' });
      opts.onProgress({ type: 'progress', files: 0, bytes: 0, percent: 0 });
      return new Promise(() => {});
    });
    await startWalk();
    await screen.findByText('Scanning C:\\');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says there is no time limit: no countdown, and no claim that it may not finish', async () => {
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'progress', files: 5, bytes: 100, percent: null });
      return new Promise(() => {});
    });
    await startWalk();
    await screen.findByText('Scanning C:\\');
    expect(document.body.textContent).not.toMatch(/s left/);
    expect(document.body.textContent).not.toMatch(/may not finish/);
    expect(screen.getByText(/stop at any time and keep what was read/)).toBeTruthy();
  });

  it('Stop still asks the backend to stop, and the partial result is kept', async () => {
    let finish;
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'start', scanId: 'w9' });
      opts.onProgress({ type: 'progress', files: 5, bytes: 12 * GB, percent: 30, snapshot: SNAPSHOT });
      return new Promise((resolve) => { finish = (tree) => { opts.onProgress({ type: 'complete', totalFiles: 5, totalBytes: 12 * GB, truncated: true, stoppedByUser: true, resultId: 'r' }); resolve(tree); }; });
    });
    const user = await startWalk();
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(stopDiskScan).toHaveBeenCalledWith('w9');

    finish({ name: 'C:', type: 'directory', size: 12 * GB, truncated: true, children: [{ name: 'Users', type: 'directory', size: 12 * GB, children: [] }] });
    expect(await screen.findByText(/^Scan stopped early/)).toBeTruthy();
    expect(within(screen.getByRole('table')).getByText('Users')).toBeTruthy();
    expect(screen.queryByText(/Showing what has been read so far/)).toBeNull();
  });

  it('replaces the partial picture with the finished tree', async () => {
    let finish;
    fetchDiskScan.mockImplementation((_p, _s, opts) => {
      opts.onProgress({ type: 'progress', files: 5, bytes: 12 * GB, percent: 30, snapshot: SNAPSHOT });
      return new Promise((resolve) => { finish = (tree) => { opts.onProgress({ type: 'complete', totalFiles: 9, totalBytes: 40 * GB, truncated: false, resultId: 'r' }); resolve(tree); }; });
    });
    await startWalk();
    await screen.findByRole('table');
    finish({ name: 'C:', type: 'directory', size: 40 * GB, children: [{ name: 'Everything', type: 'directory', size: 40 * GB, children: [] }] });
    expect(await screen.findByText(/^Scan complete/)).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Everything')).toBeTruthy();
    expect(within(table).queryByText('Windows')).toBeNull();
  });
});
