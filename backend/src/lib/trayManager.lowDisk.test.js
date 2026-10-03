import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The tray's low-disk notification, wired to fake Electron pieces: what it
 * does with a low drive, when it stays quiet, and that it follows Settings. */

const GB = 1024 ** 3;
let lowDrives = [];
const findLowDrives = vi.fn(async ({ percent }) => (percent ? lowDrives : []));
vi.mock('../services/lowDisk.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findLowDrives: (...a) => findLowDrives(...a)
}));

const { startLowDiskNotifications, appIsInFront } = await import('./trayManager.js');

let dir;
const saved = {};
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-tray-lowdisk-'));
  saved.UNREVO_SETTINGS_PATH = process.env.UNREVO_SETTINGS_PATH;
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
  lowDrives = [{ drive: 'C:', label: '', freeBytes: 10 * GB, totalBytes: 250 * GB, percentFree: 4 }];
});
afterEach(() => {
  if (saved.UNREVO_SETTINGS_PATH === undefined) delete process.env.UNREVO_SETTINGS_PATH;
  else process.env.UNREVO_SETTINGS_PATH = saved.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

function fakes({ windows = [] } = {}) {
  const shown = [];
  class Notification {
    static isSupported() { return true; }
    constructor(options) { this.options = options; shown.push(this); }
    on() {}
    show() {}
  }
  const BrowserWindow = { getAllWindows: () => windows };
  return { Notification, BrowserWindow, shown };
}
const win = (state) => ({ isDestroyed: () => false, isVisible: () => true, isMinimized: () => false, isFocused: () => false, ...state });
const timing = { firstDelayMs: 5, intervalMs: 20 };
const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

describe('appIsInFront', () => {
  it('is true only for a window that is shown, not minimised, and focused', () => {
    const of = (w) => ({ getAllWindows: () => w });
    expect(appIsInFront(of([]))).toBe(false);
    expect(appIsInFront(of([win({})]))).toBe(false);
    expect(appIsInFront(of([win({ isFocused: () => true })]))).toBe(true);
    expect(appIsInFront(of([win({ isFocused: () => true, isMinimized: () => true })]))).toBe(false);
    expect(appIsInFront(of([win({ isFocused: () => true, isVisible: () => false })]))).toBe(false);
    expect(appIsInFront(of([win({ isFocused: () => true, isDestroyed: () => true })]))).toBe(false);
  });
});

describe('startLowDiskNotifications', () => {
  it('shows one native notification for a low drive, once, however long it keeps looking', async () => {
    const { Notification, BrowserWindow, shown } = fakes();
    const watcher = startLowDiskNotifications({ Notification, BrowserWindow, showMainWindow: vi.fn(), timing });
    await vi.waitFor(() => expect(shown).toHaveLength(1));
    await settle();
    watcher.stop();
    expect(shown).toHaveLength(1);
    expect(shown[0].options.title).toBe('Low disk space on C:');
  });

  it('stays quiet while Prune is the window in front', async () => {
    const { Notification, BrowserWindow, shown } = fakes({ windows: [win({ isFocused: () => true })] });
    const watcher = startLowDiskNotifications({ Notification, BrowserWindow, showMainWindow: vi.fn(), timing });
    await settle();
    watcher.stop();
    expect(shown).toHaveLength(0);
  });

  it('follows Settings: Off means no notification and no reading', async () => {
    writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ lowDiskWarning: 0 }), 'utf8');
    const { Notification, BrowserWindow, shown } = fakes();
    const watcher = startLowDiskNotifications({ Notification, BrowserWindow, showMainWindow: vi.fn(), timing });
    await settle();
    watcher.stop();
    expect(shown).toHaveLength(0);
    expect(findLowDrives).not.toHaveBeenCalled();
  });

  it('hands the share chosen in Settings to the reading', async () => {
    writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ lowDiskWarning: 15 }), 'utf8');
    const { Notification, BrowserWindow } = fakes();
    const watcher = startLowDiskNotifications({ Notification, BrowserWindow, showMainWindow: vi.fn(), timing });
    await vi.waitFor(() => expect(findLowDrives).toHaveBeenCalled());
    watcher.stop();
    expect(findLowDrives.mock.calls[0][0]).toEqual({ percent: 15 });
  });
});
