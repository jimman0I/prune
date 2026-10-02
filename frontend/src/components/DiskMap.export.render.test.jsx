// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import ToastHost from './ToastHost.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** Exporting what the Disk Map is showing: the rows as a CSV, the map as a
 * PNG. Both are made in the window; the download itself is stubbed here. */

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

const saveBlob = vi.fn();
vi.mock('../lib/download.js', () => ({ saveBlob: (...a) => saveBlob(...a) }));
const svgToPngBlob = vi.fn();
vi.mock('../lib/exportPng.js', () => ({ svgToPngBlob: (...a) => svgToPngBlob(...a) }));

const scanDriveFast = vi.fn();
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
  revealInExplorer: vi.fn(async () => {})
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);

const TREE = {
  name: 'C:', type: 'directory', size: 1500, allocated: 8192,
  children: [
    { name: 'Games', type: 'directory', size: 900, allocated: 4096, modified: Date.UTC(2026, 6, 4, 12, 0, 0), children: [
      { name: 'level1.pak', type: 'file', size: 500, allocated: 4096, modified: Date.UTC(2026, 5, 1, 0, 0, 0) }
    ] },
    { name: 'say, "hi".txt', type: 'file', size: 100, allocated: 4096 }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  scanDriveFast.mockResolvedValue({ drives: [{ driveLetter: 'C', tree: TREE, stats: {} }] });
});

async function mountScanned() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider><LanguageProvider><ToastProvider><MotionConfig reducedMotion="always">
        <DiskMap />
        <ToastHost />
      </MotionConfig></ToastProvider></LanguageProvider></ThemeProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
  await screen.findByRole('table');
  return user;
}

const csvOf = async () => {
  const blob = saveBlob.mock.calls.at(-1)[0];
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
};

describe('exporting a CSV', () => {
  it('writes the rows of the folder in view, escaped, with their sizes and dates', async () => {
    const user = await mountScanned();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(saveBlob).toHaveBeenCalledTimes(1);
    const filename = saveBlob.mock.calls[0][1];
    expect(filename).toMatch(/^prune-C-\d{4}-\d{2}-\d{2}\.csv$/);

    const lines = (await csvOf()).replace('\uFEFF', '').split('\r\n');
    expect(lines[0]).toBe('path,size,allocated,files,folders,modified');
    expect(lines).toContain('C:\\Games,900,4096,1,0,2026-07-04T12:00:00.000Z');
    expect(lines).toContain('"C:\\say, ""hi"".txt",100,4096,1,0,');
  });

  it('exports only what the search left on screen', async () => {
    const user = await mountScanned();
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), 'games');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const lines = (await csvOf()).replace('\uFEFF', '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith('C:\\Games,')).toBe(true);
  });

  it('exports the File view\'s list when that is the view', async () => {
    const user = await mountScanned();
    await user.click(screen.getAllByRole('button', { name: 'Files' }).find((b) => b.hasAttribute('aria-pressed')));
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));
    const lines = (await csvOf()).replace('\uFEFF', '').trim().split('\r\n');
    expect(lines.some((l) => l.startsWith('C:\\Games\\level1.pak,500,4096,1,0,2026-06-01'))).toBe(true);
  });

  it('says what it saved', async () => {
    const user = await mountScanned();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/^Exported prune-C-/)).toBeTruthy();
  });

  it('reports a failure instead of staying silent', async () => {
    saveBlob.mockImplementationOnce(() => { throw new Error('disk full'); });
    const user = await mountScanned();
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Could not export: disk full')).toBeTruthy();
  });
});

describe('saving the map as a PNG', () => {
  it('rasterises the map and saves the result', async () => {
    const png = new Blob(['png'], { type: 'image/png' });
    svgToPngBlob.mockResolvedValue(png);
    const user = await mountScanned();
    await user.click(screen.getByRole('button', { name: 'Save map as PNG' }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(svgToPngBlob.mock.calls[0][0].tagName.toLowerCase()).toBe('svg');
    expect(saveBlob.mock.calls[0][0]).toBe(png);
    expect(saveBlob.mock.calls[0][1]).toMatch(/\.png$/);
  });

  it('reports a rasterising failure', async () => {
    svgToPngBlob.mockRejectedValue(new Error('The map could not be drawn to an image.'));
    const user = await mountScanned();
    await user.click(screen.getByRole('button', { name: 'Save map as PNG' }));
    expect(await screen.findByText('Could not export: The map could not be drawn to an image.')).toBeTruthy();
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it('is offered for the map only, not for the file list', async () => {
    const user = await mountScanned();
    await user.click(screen.getAllByRole('button', { name: 'Files' }).find((b) => b.hasAttribute('aria-pressed')));
    expect(screen.queryByRole('button', { name: 'Save map as PNG' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
  });
});
