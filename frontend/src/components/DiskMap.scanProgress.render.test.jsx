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
const stopDiskScan = vi.fn(async () => true);

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: (...a) => scanDriveFast(...a),
  stopDiskScan: (...a) => stopDiskScan(...a),
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

  it('does not call a partial (ran-out-of-time) scan complete', async () => {
    fetchDiskScan.mockImplementation(async (_path, _signal, opts) => {
      opts?.onProgress?.({ type: 'complete', totalFiles: 82747, totalBytes: 34.8 * GB, truncated: true, resultId: 'x' });
      return { ...TREE, truncated: true };
    });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    expect(await screen.findByText(/^Scan stopped early — 82[,.]747 files/)).toBeTruthy();
    expect(screen.queryByText(/Scan complete/)).toBeNull();
    expect(screen.getByTestId('scan-stopped-mark')).toBeTruthy();
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

describe('the Disk Map remembers how long a fast scan took', () => {
  const KEY = 'prune.fastScanMs';
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { window.localStorage.clear(); });

  const fastButton = () => screen.findByRole('button', { name: 'Fast scan (admin)' });

  it('stores the duration of a scan that finished, and nothing before it', async () => {
    let finish;
    scanDriveFast.mockImplementation(() => new Promise((r) => { finish = r; }));
    const user = userEvent.setup();
    mount();
    await user.click(await fastButton());
    expect(window.localStorage.getItem(KEY)).toBeNull();

    await act(async () => { await new Promise((r) => setTimeout(r, 1100)); finish({ tree: TREE, stats: {} }); });

    await waitFor(() => expect(Number(window.localStorage.getItem(KEY))).toBeGreaterThanOrEqual(1000));
  });

  it('does not store a declined (cancelled) scan', async () => {
    scanDriveFast.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    mount();
    await user.click(await fastButton());

    await screen.findByText(/Not approved/);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('does not store a failed scan', async () => {
    scanDriveFast.mockRejectedValue(new Error('the reader crashed'));
    const user = userEvent.setup();
    mount();
    await user.click(await fastButton());

    await screen.findByText('the reader crashed');
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('first ever scan shows no estimate; the next one estimates from the stored duration', async () => {
    scanDriveFast.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    const first = mount();
    await user.click(await fastButton());
    await screen.findByText(/Elapsed/);
    expect(document.body.textContent).not.toMatch(/based on your last scan/);
    first.unmount();

    window.localStorage.setItem(KEY, '20000');
    mount();
    await user.click(await fastButton());
    expect(await screen.findByText(/^About \d+ s left, based on your last scan$/)).toBeTruthy();
  });

  it('ignores a garbage stored value rather than showing nonsense', async () => {
    window.localStorage.setItem(KEY, 'banana');
    scanDriveFast.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await user.click(await fastButton());

    await screen.findByText(/Elapsed/);
    expect(document.body.textContent).not.toMatch(/left/);
  });
});

describe('the Disk Map passes the server time limit to the walk card', () => {
  it('shows "up to N s left" from the progress event', async () => {
    scanReporting({ type: 'progress', files: 10, bytes: 100, percent: null, remainingMs: 27_000 });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    expect(await screen.findByText(/^Up to (26|27) s left$/)).toBeTruthy();
  });
});

describe('the Disk Map Stop button', () => {
  it('appears once the backend announced the scan id, and stops that scan', async () => {
    scanReporting({ type: 'start', scanId: 'scan-77', remainingMs: 30_000 });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(stopDiskScan).toHaveBeenCalledWith('scan-77');
  });

  it('is not offered before the scan has an id', async () => {
    scanReporting();
    const user = userEvent.setup();
    mount();
    await crawl(user);

    await screen.findByText(/Scanning C:/);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('is not offered during the fast (admin) scan', async () => {
    scanDriveFast.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));

    await screen.findByText(/Elapsed/);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('a stopped scan ends in the partial result, worded as stopped early', async () => {
    fetchDiskScan.mockImplementation(async (_path, _signal, opts) => {
      opts?.onProgress?.({ type: 'start', scanId: 's', remainingMs: 30_000 });
      opts?.onProgress?.({ type: 'complete', totalFiles: 40, totalBytes: 2048, truncated: true, resultId: 'x' });
      return { ...TREE, truncated: true };
    });
    const user = userEvent.setup();
    mount();
    await crawl(user);

    expect(await screen.findByText(/^Scan stopped early — 40 files/)).toBeTruthy();
  });
});
