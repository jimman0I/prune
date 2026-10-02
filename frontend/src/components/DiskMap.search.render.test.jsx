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

/** The search box over the Tree and File views: plain text, wildcards and
 * /regex/, the matches marked on the treemap, a clear button, and an invalid
 * pattern handled without blanking anything. */

vi.mock('recharts', async () => {
  const { cloneElement } = await import('react');
  return {
    ResponsiveContainer: ({ children }) => children,
    Treemap: ({ data, content }) => (data || []).map((node, i) =>
      cloneElement(content, { key: node.fullPath || node.name || i, ...node, x: 10, y: 10, width: 200, height: 120, depth: 1 })
    )
  };
});

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
  name: 'C:', type: 'directory', size: 1500,
  children: [
    { name: 'Games', type: 'directory', size: 900, children: [
      { name: 'level1.pak', type: 'file', size: 500 },
      { name: 'level2.pak', type: 'file', size: 400 }
    ] },
    { name: 'Users', type: 'directory', size: 400, children: [{ name: 'notes.txt', type: 'file', size: 400 }] },
    { name: 'setup.exe', type: 'file', size: 200 }
  ]
};

beforeEach(async () => {
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
      </MotionConfig></ToastProvider></LanguageProvider></ThemeProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
  await screen.findByRole('table');
  return user;
}

const rowNames = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent);
const filesTab = () => screen.getAllByRole('button', { name: 'Files' }).find((b) => b.hasAttribute('aria-pressed'));
const cell = (name) => document.querySelector(`.treemap-cell[data-name="${name}"]`);

describe('searching the Tree view', () => {
  it('narrows the rows to the names that match', async () => {
    const user = await mountScanned();
    expect(rowNames()).toHaveLength(3);
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), 'use');
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toMatch(/Users/);
  });

  it('understands wildcards and regular expressions', async () => {
    const user = await mountScanned();
    const box = screen.getByRole('textbox', { name: 'Search names' });
    await user.type(box, '*.exe');
    expect(rowNames()).toHaveLength(1);
    expect(rowNames()[0]).toMatch(/setup\.exe/);

    await user.clear(box);
    await user.type(box, '/^(games|users)$/');
    expect(rowNames()).toHaveLength(2);
  });

  it('marks the matches on the treemap and dims the rest', async () => {
    const user = await mountScanned();
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), 'games');
    expect(cell('Games').getAttribute('data-search-match')).toBe('true');
    expect(cell('Users').getAttribute('data-search-match')).toBe('false');
    expect(cell('setup.exe').getAttribute('data-search-match')).toBe('false');
  });

  it('marks nothing when there is no search', async () => {
    await mountScanned();
    expect(cell('Games').hasAttribute('data-search-match')).toBe(false);
  });

  it('says so when nothing matches, and keeps the search to hand', async () => {
    const user = await mountScanned();
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), 'zzz');
    expect(await screen.findByText('Nothing here matches "zzz".')).toBeTruthy();
  });

  it('clears with the button and brings every row back', async () => {
    const user = await mountScanned();
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), 'use');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(rowNames()).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Search names' }).value).toBe('');
  });

  it('shows an invalid pattern as invalid without filtering anything', async () => {
    const user = await mountScanned();
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), '/(/');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(rowNames()).toHaveLength(3);
    expect(cell('Games').hasAttribute('data-search-match')).toBe(false);
  });
});

describe('searching the File view', () => {
  it('lists the biggest files that match, from anywhere in the tree', async () => {
    const user = await mountScanned();
    await user.click(filesTab());
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), '*.pak');
    await waitFor(() => {
      const listed = screen.queryAllByText(/^C:\\Games\\level\d\.pak$/);
      expect(listed).toHaveLength(2);
      // The unfiltered list has these two as well, so wait for the one that
      // is not a match to leave before calling the search applied.
      expect(screen.queryByText('C:\\Users\\notes.txt')).toBeNull();
    });
  });

  it('says so when no file matches', async () => {
    const user = await mountScanned();
    await user.click(filesTab());
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), '*.nothing');
    expect(await screen.findByText('Nothing here matches "*.nothing".')).toBeTruthy();
  });

  it('keeps the search when switching between Tree and Files', async () => {
    const user = await mountScanned();
    await user.type(screen.getByRole('textbox', { name: 'Search names' }), 'pak');
    await user.click(filesTab());
    expect(screen.getByRole('textbox', { name: 'Search names' }).value).toBe('pak');
  });
});
