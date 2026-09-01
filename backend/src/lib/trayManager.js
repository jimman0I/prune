import { freemem, totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSystemDriveSpace } from '../services/diskSpace.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Same packaged-vs-dev path split as main.cjs's own iconPath() -- the
 * real app icon (the Prune mark -- a navy circle with a teal geometric leaf),
 * shipped as a real extraResource (see electron-builder.config.cjs) so
 * both this file and main.cjs point at the exact same asset instead of
 * two different hand-maintained copies. `app` is only known to be real
 * here, not at module-load time, so this takes it as a parameter rather
 * than importing 'electron' a second time. */
function iconPath(app) {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(here, '..', '..', '..', 'electron', 'build', 'icon.png');
}

const TOOLTIP_REFRESH_MS = 10_000;

function formatGB(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

async function buildTooltip() {
  const ramFree = freemem();
  const ramTotal = totalmem();
  let diskLine = 'Disk: unavailable';
  try {
    const { freeBytes, totalBytes } = await getSystemDriveSpace();
    diskLine = `Disk: ${formatGB(freeBytes)} free / ${formatGB(totalBytes)}`;
  } catch {
    // getSystemDriveSpace already never throws in practice, but a tray
    // tooltip is the last place that should ever crash the app -- keep
    // the fallback text rather than propagate.
  }
  return `Prune - System Optimizer\nRAM: ${formatGB(ramFree)} free / ${formatGB(ramTotal)}\n${diskLine}`;
}

let initialized = false;

/** Builds the system tray icon, its live RAM/disk tooltip, its context
 * menu, and the "close hides instead of quits" window behavior -- all
 * without touching electron/main.cjs, which owns the actual window/app
 * lifecycle and is out of scope for this feature.
 *
 * Real architecture constraint: backend/src/index.js runs two ways --
 * inside Electron's main process (packaged, or `electron .` dev mode,
 * where `import('electron')` resolves to the real API), and standalone
 * (`node src/index.js`, and every `vitest run`), where 'electron' is not
 * even an installed package. A static top-level `import { Tray } from
 * 'electron'` would throw on module load and crash the ENTIRE backend --
 * including the whole test suite -- in the standalone case. The dynamic
 * import below is guarded specifically so this file is always safe to
 * import, and initTray() always safe to call, regardless of which
 * runtime it's in; outside a real Electron process it silently no-ops.
 *
 * `app.on('browser-window-created', ...)` is what makes the close-to-tray
 * behavior possible without a hook in main.cjs: it's an Electron APP-level
 * event that fires for every BrowserWindow ever created, anywhere in the
 * process, including the one main.cjs's own createWindow() makes. */
export async function initTray() {
  if (initialized) return;
  initialized = true;

  let electron;
  try {
    electron = await import('electron');
  } catch {
    return; // not running inside Electron -- standalone dev/test, expected
  }

  const { app, Tray, Menu, nativeImage, BrowserWindow } = electron;
  if (!app) return;
  await app.whenReady();

  const icon = nativeImage.createFromPath(iconPath(app));
  const tray = new Tray(icon);

  const refreshTooltip = () => { buildTooltip().then((text) => tray.setToolTip(text)); };
  refreshTooltip();
  setInterval(refreshTooltip, TOOLTIP_REFRESH_MS).unref?.();

  const showMainWindow = () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    win.show();
    win.focus();
  };

  const menu = Menu.buildFromTemplate([
    { label: 'Open Prune', click: showMainWindow },
    {
      label: 'Quick Clean (Temp Files)',
      click: async () => {
        const { executeCleanup } = await import('../services/cleanup.js');
        await executeCleanup(['tempFiles']);
      }
    },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showMainWindow);

  // Close-to-tray: preventDefault must run SYNCHRONOUSLY every time this
  // fires, before the async settings read below resolves -- otherwise the
  // window would close for real before this handler gets a chance to stop
  // it. If the user's own preference turns out to be false, win.destroy()
  // finishes the close that preventDefault already blocked.
  let quitting = false;
  app.on('before-quit', () => { quitting = true; });
  const attachCloseHandler = (win) => {
    win.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      import('../services/settings.js')
        .then(({ getSettings }) => getSettings())
        .then((settings) => {
          if (settings.minimizeToTray === false) win.destroy();
          else win.hide();
        });
    });
  };
  for (const win of BrowserWindow.getAllWindows()) attachCloseHandler(win);
  app.on('browser-window-created', (_event, win) => attachCloseHandler(win));
}
