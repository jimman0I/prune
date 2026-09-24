// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** The Disk Map wired to the scan's real progress events. The invariant: a
 * percentage appears only when the event carried a real one. */

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

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: (...a) => scanDriveFast(...a),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(),
  revealInExplorer: vi.fn(async () => {})
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue(null);
});

const GB = 1024 ** 3;

function mount(client = makeTestClient()) {
  return render(
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

const TREE = {
  name: '', type: 'directory', size: 10_000_000,
  children: [{ name: 'Docs', type: 'directory', size: 2_000_000, scanned: true }]
};

const crawl = async (user) => user.click(await screen.findByRole('button', { name: 'Walk folders instead' }));

/** A scan that reports the given events and then never finishes, so the
 * scanning card stays on screen to be inspected. */
function scanReporting(...events) {
  fetchDiskScan.mockImplementation((_path, _signal, opts) => {
    for (const e of events) opts?.onProgress?.(e);
    return new Promise(() => {});
  });
}

describe('the Disk Map while a folder scan reports progress', () => {
  it('shows the counters and NO percent when the event has no percent', async () => {
    scanReporting({ type: 'progress', files: 1200, bytes: 5 * GB, percent: null });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    await waitFor(() => expect(document.body.textContent).toMatch(/1[,.]200 files scanned · 5 GB processed/));
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('shows 37% when the event carries a real 37', async () => {
    scanReporting({ type: 'progress', files: 900, bytes: 2 * GB, percent: 37 });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    expect(await screen.findByText('37%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('37');
  });

  it('shows neither counters nor a percent from a scan that reports nothing', async () => {
    fetchDiskScan.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await crawl(user);

    await screen.findByText(/Scanning C:/);
    expect(document.body.textContent).not.toContain('files scanned');
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
  });

  it('ignores progress that arrives after the scan was aborted', async () => {
    let late;
    fetchDiskScan.mockImplementation((_path, signal, opts) => {
      late = () => opts.onProgress({ type: 'progress', files: 777, bytes: 1, percent: 88 });
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const client = makeTestClient();
    const user = userEvent.setup();
    mount(client);
    await crawl(user);
    await screen.findByText(/Scanning C:/);

    await act(async () => { await client.cancelQueries(); });
    act(() => late());

    expect(document.body.textContent).not.toMatch(/777/);
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
  });
});

describe('the Disk Map once a folder scan completes', () => {
  it('shows the complete strip with counts above the results, and Scan again rescans', async () => {
    let calls = 0;
    fetchDiskScan.mockImplementation(async (_path, _signal, opts) => {
      calls += 1;
      opts?.onProgress?.({ type: 'progress', files: 10, bytes: 100, percent: null });
      opts?.onProgress?.({ type: 'complete', totalFiles: 2500, totalBytes: 3 * GB, truncated: false, resultId: 'x' });
      return TREE;
    });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    expect(await screen.findByText(/^Scan complete — 2[,.]500 files, 3 GB$/)).toBeTruthy();
    expect(calls).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Scan again' }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('shows no complete strip when the scan never reported a completion', async () => {
    fetchDiskScan.mockResolvedValue(TREE);
    const user = userEvent.setup();
    mount();
    await crawl(user);

    await waitFor(() => expect(screen.queryByText(/Scanning C:/)).toBeNull());
    expect(screen.queryByText(/Scan complete/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scan again' })).toBeNull();
  });
});

describe('the Disk Map when a scan fails', () => {
  it('offers Retry, which scans again', async () => {
    let calls = 0;
    fetchDiskScan.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('EACCES: permission denied');
      return TREE;
    });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    expect(await screen.findByText(/EACCES: permission denied/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(screen.queryByText(/EACCES/)).toBeNull());
  });
});

describe('the Disk Map during a fast (admin) scan', () => {
  it('shows the elapsed-time card with no percent and no counters, and replaces the chooser', async () => {
    let resolveFast;
    scanDriveFast.mockImplementation(() => new Promise((r) => { resolveFast = r; }));
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));

    expect(await screen.findByText(/Elapsed 00:0\d/)).toBeTruthy();
    expect(screen.getByText(/Windows reports no progress/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
    expect(document.body.textContent).not.toContain('files scanned');
    expect(screen.queryByText('Read the whole drive')).toBeNull();
    resolveFast({ cancelled: true });
    await screen.findByText('Read the whole drive');
  });
});
