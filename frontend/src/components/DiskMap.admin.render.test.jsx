// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** What the drive chooser says about administrator rights: nothing to approve
 * when Prune already has them, otherwise what the fast scan needs and why,
 * with a restart that makes later scans prompt-free. The folder walk stays. */

vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }) => children, Treemap: () => null }));

const fetchMftStatus = vi.fn();
const scanDriveFast = vi.fn();
const fetchDiskScan = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(async () => null),
  fetchDrives: vi.fn(async () => ({ systemDrive: 'C', drives: [] })),
  fetchMftStatus: (...a) => fetchMftStatus(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: (...a) => scanDriveFast(...a),
  stopDiskScan: vi.fn(async () => true),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(),
  revealInExplorer: vi.fn(async () => {})
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(() => { cleanup(); delete window.pruneWindow; });
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  fetchMftStatus.mockResolvedValue({ elevated: false });
});

const mount = () => render(
  <QueryClientProvider client={makeTestClient()}>
    <ThemeProvider><LanguageProvider><ToastProvider><MotionConfig reducedMotion="always">
      <DiskMap />
    </MotionConfig></ToastProvider></LanguageProvider></ThemeProvider>
  </QueryClientProvider>
);

const bridge = (admin) => { window.pruneWindow = { admin }; };

describe('the drive chooser when Prune already runs as administrator', () => {
  beforeEach(() => fetchMftStatus.mockResolvedValue({ elevated: true }));

  it('says the scan starts without a prompt and drops the UAC warning', async () => {
    mount();
    expect(await screen.findByText(/running as administrator, so this scan starts without a prompt/)).toBeTruthy();
    expect(screen.queryByText(/Needs administrator approval/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restart Prune as administrator' })).toBeNull();
  });
});

describe('the drive chooser when Prune is not elevated', () => {
  it('explains what the fast scan needs and why', async () => {
    mount();
    expect(await screen.findByText(/Needs administrator approval/)).toBeTruthy();
    expect(await screen.findByText(/Windows only lets administrators read a drive’s file index/)).toBeTruthy();
  });

  it('keeps the folder walk available, with no permission needed', async () => {
    mount();
    expect((await screen.findByRole('button', { name: 'Walk folders instead' })).disabled).toBe(false);
  });

  it('offers a restart only when the desktop app says it can', async () => {
    mount();
    await screen.findByText(/Needs administrator approval/);
    expect(screen.queryByRole('button', { name: 'Restart Prune as administrator' })).toBeNull();
    cleanup();

    bridge({ canRelaunch: async () => false, relaunch: vi.fn() });
    mount();
    await screen.findByText(/Needs administrator approval/);
    expect(screen.queryByRole('button', { name: 'Restart Prune as administrator' })).toBeNull();
  });

  it('restarts through the bridge when asked, and says it is restarting', async () => {
    const relaunch = vi.fn(() => new Promise(() => {}));
    bridge({ canRelaunch: async () => true, relaunch });
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole('button', { name: 'Restart Prune as administrator' }));
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Restarting…' })).toBeTruthy();
  });

  it('a declined prompt leaves everything as it was and says so', async () => {
    const relaunch = vi.fn(async () => ({ ok: false, cancelled: true }));
    bridge({ canRelaunch: async () => true, relaunch });
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole('button', { name: 'Restart Prune as administrator' }));
    expect(await screen.findByText('Not approved — Prune is still running as before.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart Prune as administrator' }).disabled).toBe(false);
  });

  it('shows the reason when the restart fails', async () => {
    bridge({ canRelaunch: async () => true, relaunch: async () => ({ ok: false, error: 'Access is denied' }) });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Restart Prune as administrator' }));
    expect(await screen.findByText('Could not restart as administrator: Access is denied')).toBeTruthy();
  });

  it('still works when the status cannot be read, treating it as not elevated', async () => {
    fetchMftStatus.mockRejectedValue(new Error('down'));
    mount();
    expect(await screen.findByText(/Needs administrator approval/)).toBeTruthy();
  });
});

describe('the drive chooser remembers the way you last scanned', () => {
  it('focuses and emphasises the fast scan by default', async () => {
    mount();
    const fast = await screen.findByRole('button', { name: 'Fast scan (admin)' });
    expect(fast.className).toContain('btn-primary');
  });

  it('after a folder walk, emphasises the walk next time', async () => {
    fetchDiskScan.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    const first = mount();
    await user.click(await screen.findByRole('button', { name: 'Walk folders instead' }));
    await waitFor(() => expect(window.localStorage.getItem('prune.diskScanMode')).toBe('crawl'));
    first.unmount();

    mount();
    const walk = await screen.findByRole('button', { name: 'Walk folders instead' });
    expect(walk.className).toContain('btn-primary');
    expect(screen.getByRole('button', { name: 'Fast scan (admin)' }).className).not.toContain('btn-primary');
  });

  it('remembers a fast scan too, but never starts one by itself', async () => {
    scanDriveFast.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    await waitFor(() => expect(window.localStorage.getItem('prune.diskScanMode')).toBe('fast'));
    cleanup();

    scanDriveFast.mockClear();
    mount();
    await screen.findByRole('button', { name: 'Fast scan (admin)' });
    expect(scanDriveFast).not.toHaveBeenCalled();
  });
});
