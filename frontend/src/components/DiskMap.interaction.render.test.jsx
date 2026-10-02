// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import ToastHost from './ToastHost.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** Selecting a thing in one place lights it in the other, and the right-click
 * menu grows Properties and "Exclude this folder". */

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
const updateSettings = vi.fn(async (partial) => ({ ...settings, ...partial }));
let settings = { excludeFolders: [], excludeExtensions: [] };
vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => settings),
  updateSettings: (...a) => updateSettings(...a),
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

const GB = 1024 ** 3;
const TREE = {
  name: 'C:', type: 'directory', size: 10 * GB, allocated: 11 * GB,
  children: [
    { name: 'Games', type: 'directory', size: 8 * GB, allocated: 8 * GB + 4096, modified: Date.UTC(2026, 6, 4, 12), children: [
      { name: 'a.pak', type: 'file', size: 5 * GB }, { name: 'b', type: 'directory', size: 3 * GB, children: [{ name: 'c.pak', type: 'file', size: 3 * GB }] }
    ] },
    { name: 'notes.txt', type: 'file', size: 100, allocated: 4096, modified: Date.UTC(2026, 0, 2, 12) }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  settings = { excludeFolders: [], excludeExtensions: [] };
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

const row = (name) => within(screen.getByRole('table')).getAllByRole('row').find((r) => r.textContent.startsWith(name));
const cell = (name) => document.querySelector(`.treemap-cell[data-name="${name}"]`);

describe('select-sync between the Tree rows and the map', () => {
  it('lights a map block when its row is pointed at, and clears when the pointer leaves', async () => {
    await mountScanned();
    expect(cell('Games').hasAttribute('data-selected')).toBe(false);
    fireEvent.mouseEnter(row('Games'));
    expect(cell('Games').getAttribute('data-selected')).toBe('true');
    expect(cell('notes.txt').hasAttribute('data-selected')).toBe(false);
    fireEvent.mouseLeave(row('Games'));
    expect(cell('Games').hasAttribute('data-selected')).toBe(false);
  });

  it('lights a row when its block is pointed at', async () => {
    await mountScanned();
    fireEvent.mouseEnter(cell('notes.txt'));
    expect(row('notes.txt').getAttribute('data-selected')).toBe('true');
    expect(row('Games').hasAttribute('data-selected')).toBe(false);
    fireEvent.mouseLeave(cell('notes.txt'));
    expect(row('notes.txt').hasAttribute('data-selected')).toBe(false);
  });

  it('follows keyboard focus the same way', async () => {
    await mountScanned();
    fireEvent.focus(within(row('Games')).getAllByRole('button')[0]);
    expect(cell('Games').getAttribute('data-selected')).toBe('true');
  });

  it('keeps the selection while the right-click menu is open on it', async () => {
    await mountScanned();
    fireEvent.mouseEnter(row('Games'));
    fireEvent.contextMenu(row('Games'));
    await screen.findByRole('menu');
    fireEvent.mouseLeave(row('Games'));
    expect(cell('Games').getAttribute('data-selected')).toBe('true');
  });
});

describe('the right-click menu', () => {
  const open = async (name) => {
    fireEvent.contextMenu(row(name));
    return screen.findByRole('menu');
  };

  it('offers Properties for a folder and for a file', async () => {
    await mountScanned();
    expect(within(await open('Games')).getByRole('menuitem', { name: 'Properties' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(within(await open('notes.txt')).getByRole('menuitem', { name: 'Properties' })).toBeTruthy();
  });

  it('shows size, allocated, counts, modified date and the full path', async () => {
    const user = await mountScanned();
    await user.click(within(await open('Games')).getByRole('menuitem', { name: 'Properties' }));
    const dialog = await screen.findByRole('dialog', { name: 'Properties' });
    const text = dialog.textContent;
    expect(text).toContain('C:\\Games');
    expect(text).toContain('Folder');
    expect(text).toContain('8 GB');
    expect(text).toContain('Allocated');
    expect(text).toMatch(/Files\s*2/);
    expect(text).toMatch(/Folders\s*1/);
    expect(text).toContain(new Date(Date.UTC(2026, 6, 4, 12)).toLocaleString());
  });

  it('shows a file without folder counts', async () => {
    const user = await mountScanned();
    await user.click(within(await open('notes.txt')).getByRole('menuitem', { name: 'Properties' }));
    const dialog = await screen.findByRole('dialog', { name: 'Properties' });
    expect(dialog.textContent).toContain('File');
    expect(dialog.textContent).not.toMatch(/Folders/);
  });

  it('closes with the Close button', async () => {
    const user = await mountScanned();
    await user.click(within(await open('notes.txt')).getByRole('menuitem', { name: 'Properties' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Properties' })).toBeNull());
  });

  it('adds a folder to the exclusions in Settings, and says future scans will skip it', async () => {
    const user = await mountScanned();
    await user.click(within(await open('Games')).getByRole('menuitem', { name: 'Exclude this folder' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0][0]).toEqual({ excludeFolders: ['C:\\Games'] });
    expect(await screen.findByText('C:\\Games will be skipped by future scans.')).toBeTruthy();
  });

  it('keeps the folders already excluded', async () => {
    settings = { excludeFolders: ['D:\\Keep'], excludeExtensions: [] };
    const user = await mountScanned();
    await user.click(within(await open('Games')).getByRole('menuitem', { name: 'Exclude this folder' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0][0]).toEqual({ excludeFolders: ['D:\\Keep', 'C:\\Games'] });
  });

  it('does not add a folder twice, in any case or with a trailing slash', async () => {
    settings = { excludeFolders: ['c:\\games\\'], excludeExtensions: [] };
    const user = await mountScanned();
    await user.click(within(await open('Games')).getByRole('menuitem', { name: 'Exclude this folder' }));
    expect(await screen.findByText('C:\\Games is already excluded.')).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('says so when the exclusion could not be saved', async () => {
    updateSettings.mockRejectedValueOnce(new Error('disk full'));
    const user = await mountScanned();
    await user.click(within(await open('Games')).getByRole('menuitem', { name: 'Exclude this folder' }));
    expect(await screen.findByText('Could not save that exclusion.')).toBeTruthy();
  });

  it('is only offered for folders', async () => {
    await mountScanned();
    const menu = await open('notes.txt');
    expect(within(menu).queryByRole('menuitem', { name: 'Exclude this folder' })).toBeNull();
  });

  it('keeps the existing choices', async () => {
    await mountScanned();
    const menu = await open('Games');
    for (const name of ['Open in Explorer', 'Copy path', 'Move to quarantine…']) {
      expect(within(menu).getByRole('menuitem', { name })).toBeTruthy();
    }
  });
});
