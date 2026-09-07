const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const BACKEND_PORT = 3101;

function backendEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'index.js')
    : path.join(__dirname, '..', 'backend', 'src', 'index.js');
}

/** Same packaged-vs-dev path split as backendEntryPath() above. The icon
 * itself (the Prune mark -- a navy circle with a teal geometric leaf) is
 * shipped as a real extraResource, not inlined as base64 here -- keeping
 * this file readable mattered more than avoiding one more resourcesPath
 * call, and it's the same pattern this file already uses for the backend. */
function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, 'build', 'icon.png');
}

/** Where quarantine/backup data lives — outside the install directory so
 * an app upgrade never deletes it. Same reasoning as Re:Route's own
 * dataDir.js: userData survives upgrades, an install-relative path
 * doesn't. */
function quarantineRoot() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'quarantine') : null;
}

/** Same reasoning as quarantineRoot() above -- without this override,
 * settings.js's own default falls back to the raw %LOCALAPPDATA%\Prune\
 * settings.json, a DIFFERENT folder from quarantine's userData-based
 * root (Roaming, not Local). Both belong under the same app-data root. */
function settingsPath() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'settings.json') : null;
}

/** Starts the Express backend in-process (it's ESM, loaded via dynamic
 * import) — same pattern as Re:Route's electron/main.cjs. */
async function startBackend() {
  const quarantineDir = quarantineRoot();
  if (quarantineDir) process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
  const settingsFile = settingsPath();
  if (settingsFile) process.env.UNREVO_SETTINGS_PATH = settingsFile;
  const entry = pathToFileURL(backendEntryPath()).href;
  await import(entry); // side effect: calls server.listen()
}

/** Polls the backend until it answers, so the window doesn't load before
 * it's up. */
function waitForBackend(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port: BACKEND_PORT, path: '/api/health', timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) { reject(new Error('Backend did not start in time.')); return; }
        setTimeout(tryOnce, 300);
      });
      req.on('timeout', () => req.destroy());
    };
    tryOnce();
  });
}

/* The two palettes Windows paints its own buttons in.
 *
 * These duplicate two values from index.css and cannot read them: the
 * title bar overlay is a native surface configured in the main process,
 * where no stylesheet exists. Kept next to each other here, and named
 * after the themes they belong to, so the duplication is at least
 * visible -- `color` is the strip behind the buttons and has to match
 * --bg-base, `symbolColor` is the glyphs and matches --text-secondary. */
const OVERLAY_COLORS = {
  dark: { color: '#09090b', symbolColor: '#a1a1aa' },
  light: { color: '#f7f6f4', symbolColor: '#57534e' }
};

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    title: 'Prune',
    backgroundColor: '#09090b',
    icon: iconPath(),

    /* The window's own title bar, drawn by the app.
     *
     * `titleBarStyle: 'hidden'` with a `titleBarOverlay` rather than
     * `frame: false` with hand-drawn buttons, and the difference is worth
     * recording because the second one is what "custom title bar" usually
     * means.
     *
     * Windows still draws minimize/maximize/close here, in the colours
     * given below, over a bar this app owns the rest of. That keeps three
     * things that hand-drawn buttons lose: Snap Layouts (hovering maximize
     * on Windows 11 opens the tiling menu), correct hit-testing at the
     * screen edge for a maximized window, and keyboard and screen-reader
     * behaviour that comes free. It also needs no IPC -- a frameless
     * window has to expose minimize/maximize/close to the renderer, which
     * is a new surface on an app that currently exposes none at all.
     *
     * The cost is that the glyphs are Windows' rather than ours. They are
     * thin strokes in the same weight either way.
     *
     * Dark is only the STARTING palette. These colours are not CSS and no
     * stylesheet reaches them, so the renderer tells the main process when
     * the theme changes and the handler below repaints them -- otherwise
     * light mode leaves three dark glyphs on a light strip. */
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      ...OVERLAY_COLORS.dark,
      // 40, not the ~60 the reference design uses. Prune's screens are
      // dense -- tables, a treemap, a 55-row startup list -- and 20px of
      // permanent vertical chrome costs more here than on a page with one
      // panel in the middle of it.
      height: 40
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // One channel, one string. See preload.cjs -- the window's own
      // buttons are painted by Windows and cannot be reached from CSS, so
      // the renderer has to tell the main process when the theme changes.
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Electron's stock File/Edit/View/Window menu bar is a dev-tooling
  // default (Reload, Toggle DevTools, Zoom…) — nothing Prune's own UI
  // offers, and it doesn't belong on a native desktop utility that isn't a
  // browser. Same call Re:Route's own main.cjs already makes.
  win.removeMenu();

  /* Repaint the native buttons when the app changes theme.
   *
   * Validated against the fixed list rather than passed through: this
   * value crosses from the renderer, and setTitleBarOverlay takes colours
   * it will happily apply. An unknown theme is ignored rather than
   * guessed at. */
  ipcMain.on('prune:theme', (event, theme) => {
    if (event.sender !== win.webContents) return;
    const colors = OVERLAY_COLORS[theme];
    if (!colors || win.isDestroyed()) return;
    try {
      win.setTitleBarOverlay(colors);
    } catch {
      // Only Windows implements this. Elsewhere the call throws and the
      // app is otherwise fine, so it is not worth surfacing.
    }
  });

  // Dev-mode navigation to the Vite dev server can genuinely fail (started
  // `npm start` before `npm run dev` was ready, Vite still restarting after
  // an HMR crash, wrong port) — a bare, uncaught rejection here left NO
  // trace of why beyond the window's own static `title` staying "Prune"
  // as a fallback, which reads as "it loaded" when it didn't. Logged, not
  // silently swallowed; packaged mode (loadFile, a local file that either
  // exists or the build is broken) doesn't need the same handling.
  if (app.isPackaged) {
    await win.loadFile(path.join(process.resourcesPath, 'frontend-dist', 'index.html'));
  } else {
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error(`Failed to load the dev server at http://localhost:5174 (${errorDescription}, code ${errorCode}). Is "npm run dev" running in frontend/?`);
    });
    await win.loadURL('http://localhost:5174').catch(() => {}); // the did-fail-load listener above already reports this
  }
}

app.whenReady().then(async () => {
  await startBackend();
  await waitForBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});