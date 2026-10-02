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

/** The Disk Map choosing a drive. The invariant: nothing is hard-wired to C:,
 * the system drive is where it opens, and several drives are ONE fast-scan
 * request (one elevation prompt). */

vi.mock('recharts', async () => {
  const { cloneElement } = await import('react');
  return {
    ResponsiveContainer: ({ children }) => children,
    Treemap: ({ data, content }) => (data || []).map((node, i) =>
      cloneElement(content, { key: node.fullPath || node.name || i, ...node, x: 10, y: 10, width: 200, height: 120, depth: 1 })
    )
  };
});

const GB = 1024 ** 3;
const fetchDrives = vi.fn();
const scanDriveFast = vi.fn();
const fetchDiskScan = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(async () => null),
  fetchDrives: (...a) => fetchDrives(...a),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: (...a) => scanDriveFast(...a),
  stopDiskScan: vi.fn(async () => true),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: vi.fn(),
  revealInExplorer: vi.fn(async () => {})
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);

const drive = (letter, extra = {}) => ({
  letter, label: `Disk ${letter}`, fileSystem: 'NTFS', totalBytes: 100 * GB, freeBytes: 40 * GB,
  removable: false, system: false, ntfs: true, ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchDrives.mockResolvedValue({ systemDrive: 'C', drives: [drive('C', { system: true }), drive('D')] });
  window.localStorage.clear();
});

function mount() {
  return render(
    <QueryClientProvider client={makeTestClient()}>
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

const treeFor = (name, fileName) => ({
  name, type: 'directory', size: 300,
  children: [{ name: fileName, type: 'file', size: 300 }]
});

describe('the Disk Map drive picker', () => {
  it('lists the machine\'s drives', async () => {
    mount();
    expect(await screen.findByRole('button', { name: /D:.*Disk D/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /C:.*Disk C/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens on the system drive even when that is not C:', async () => {
    fetchDrives.mockResolvedValue({ systemDrive: 'D', drives: [drive('C'), drive('D', { system: true })] });
    mount();
    expect(await screen.findByText(/every file on D: in a few seconds/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /D:.*Disk D/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('switching to another drive offers the scan for THAT drive', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /D:.*Disk D/ }));
    expect(await screen.findByText(/every file on D: in a few seconds/)).toBeTruthy();
    expect(screen.queryByText(/every file on C:/)).toBeNull();
  });

  it('fast-scans only the chosen drive by default', async () => {
    scanDriveFast.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /D:.*Disk D/ }));
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    expect(scanDriveFast).toHaveBeenCalledWith(['D']);
  });

  it('sends every ticked drive in ONE request, so there is one prompt', async () => {
    scanDriveFast.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    mount();
    await screen.findByRole('button', { name: /D:.*Disk D/ });
    await user.click(await screen.findByRole('checkbox', { name: /D:/ }));
    await user.click(screen.getByRole('button', { name: 'Fast scan (admin)' }));
    expect(scanDriveFast).toHaveBeenCalledTimes(1);
    expect(scanDriveFast).toHaveBeenCalledWith(['C', 'D']);
  });

  it('keeps every drive that was read, and switching between them needs no new scan', async () => {
    scanDriveFast.mockResolvedValue({
      drives: [
        { driveLetter: 'C', tree: treeFor('C:', 'c-file.bin'), stats: { recordsRead: 5 } },
        { driveLetter: 'D', tree: treeFor('D:', 'd-file.bin'), stats: { recordsRead: 7 } }
      ]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: /D:/ }));
    await user.click(screen.getByRole('button', { name: 'Fast scan (admin)' }));

    expect((await screen.findAllByText('c-file.bin')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /D:.*Disk D/ }));
    expect((await screen.findAllByText('d-file.bin')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('c-file.bin')).toHaveLength(0);
    expect(scanDriveFast).toHaveBeenCalledTimes(1);
    expect(fetchDiskScan).not.toHaveBeenCalled();
    // Both are marked as having a scan in memory.
    expect(screen.getByRole('button', { name: /C:.*Disk C/ }).textContent).toMatch(/Scanned/);
    expect(screen.getByRole('button', { name: /D:.*Disk D/ }).textContent).toMatch(/Scanned/);
  });

  it('names a drive that failed beside the ones that worked', async () => {
    scanDriveFast.mockResolvedValue({
      drives: [
        { driveLetter: 'C', tree: treeFor('C:', 'c-file.bin'), stats: {} },
        { driveLetter: 'D', error: 'Access is denied' }
      ]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: /D:/ }));
    await user.click(screen.getByRole('button', { name: 'Fast scan (admin)' }));

    expect((await screen.findAllByText('c-file.bin')).length).toBeGreaterThan(0);
    expect(screen.getByText('Could not scan D:: Access is denied')).toBeTruthy();
  });

  it('cannot fast-scan a drive that is not NTFS, and says why', async () => {
    fetchDrives.mockResolvedValue({
      systemDrive: 'C',
      drives: [drive('C', { system: true }), drive('E', { fileSystem: 'exFAT', ntfs: false, removable: true })]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /E:.*Disk E/ }));

    expect(await screen.findByText('Only NTFS drives can be fast scanned.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fast scan (admin)' }).disabled).toBe(true);
    // The folder walk stays available for it.
    expect(screen.getByRole('button', { name: 'Walk folders instead' }).disabled).toBe(false);
  });

  it('only offers NTFS drives to ride along', async () => {
    fetchDrives.mockResolvedValue({
      systemDrive: 'C',
      drives: [drive('C', { system: true }), drive('E', { fileSystem: 'exFAT', ntfs: false })]
    });
    mount();
    await screen.findByRole('button', { name: /E:.*Disk E/ });
    expect(screen.queryByRole('checkbox', { name: /E:/ })).toBeNull();
  });

  it('walks the chosen drive\'s own root', async () => {
    fetchDiskScan.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /D:.*Disk D/ }));
    await user.click(await screen.findByRole('button', { name: 'Walk folders instead' }));
    await waitFor(() => expect(fetchDiskScan).toHaveBeenCalled());
    expect(fetchDiskScan.mock.calls[0][0]).toBe('D:\\');
  });

  it('still works when the drive list cannot be read', async () => {
    fetchDrives.mockRejectedValue(new Error('PowerShell failed'));
    mount();
    expect(await screen.findByText(/every file on C: in a few seconds/)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Drives' })).toBeNull();
  });
});

describe('the Disk Map scan totals', () => {
  it('lays the counted size, the size on disk and the volume\'s own used figure side by side', async () => {
    scanDriveFast.mockResolvedValue({
      drives: [{
        driveLetter: 'C', tree: treeFor('C:', 'c-file.bin'),
        stats: { recordsRead: 5, totalBytes: 10 * GB, allocatedBytes: 11 * GB, bitmapUsedBytes: 12 * GB, hardLinkedFiles: 3 }
      }]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    const totals = await screen.findByTestId('scan-totals');
    expect(totals.textContent).toContain('10 GB counted · 11 GB on disk · 12 GB in use on the volume');
    expect(totals.textContent).toContain('3 files with several names are counted once.');
  });

  it('says nothing about the volume when it could not be read', async () => {
    scanDriveFast.mockResolvedValue({
      drives: [{ driveLetter: 'C', tree: treeFor('C:', 'c-file.bin'), stats: { totalBytes: 10 * GB, allocatedBytes: 11 * GB, bitmapUsedBytes: null } }]
    });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    expect((await screen.findByTestId('scan-totals')).textContent).toBe('10 GB counted · 11 GB on disk');
  });
});