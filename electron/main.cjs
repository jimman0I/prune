const { app, BrowserWindow, ipcMain, nativeTheme, screen } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const { createUpdater } = require('./updater.cjs');
const { resolveWindowState, loadWindowState, saveWindowState, saveWindowStateSync } = require('./windowState.cjs');

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

/** Same reasoning as settingsPath() -- outside the install directory so
 * an upgrade never wipes it, in the same userData root as everything
 * else Prune persists. */
function windowStatePath() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'window-state.json') : null;
}

/** Starts the Express backend in-process (it's ESM, loaded via dynamic
 * import) — same pattern as Re:Route's electron/main.cjs. */
async function startBackend() {
  const quarantineDir = quarantineRoot();
  if (quarantineDir) process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
  const settingsFile = settingsPath();
  if (settingsFile) process.env.UNREVO_SETTINGS_PATH = settingsFile;
  // Packaged only -- see sqliteVacuum.js's own dev-mode fallback, which
  // reaches electron/build/sqlite3.exe directly by relative path when
  // this isn't set, the same packaged-vs-dev split iconPath() above uses.
  if (app.isPackaged) process.env.UNREVO_SQLITE3_PATH = path.join(process.resourcesPath, 'sqlite3.exe');
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

/** Which of the two palettes to paint BEFORE the renderer has said
 * anything -- the window's backgroundColor and its titleBarOverlay are
 * both native surfaces set at construction time, not CSS, so hardcoding
 * 'dark' here painted every light-OS machine dark for the moment between
 * the window appearing and the renderer's first `prune:theme` IPC
 * message correcting it. `nativeTheme.shouldUseDarkColors` is Electron's
 * own read of the OS preference, synchronous and available in the main
 * process before any window exists -- the same signal the renderer's
 * `systemPrefersDark()` reads from `prefers-color-scheme`, just reached
 * from the other side of the process boundary.
 *
 * This still does not know about an in-app choice stored in the
 * renderer's localStorage (main process has no route to that without
 * extra plumbing this doesn't have yet) -- someone who picked light
 * while their OS is dark still sees one native-chrome flash while the
 * IPC catches up. What it does fix is the far more common case: an
 * untouched install on a light-OS machine, which used to paint dark on
 * every single launch. */
function startingTheme() {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

/** A second display at a different scale than the one a window was
 * created on -- an external monitor, or a TV used as one, plugged into a
 * laptop with its own HiDPI panel -- is exactly the case Windows' own
 * Per-Monitor-V2 DPI awareness is supposed to handle by itself. What it
 * does not reliably do on Windows, a real and long-standing
 * Chromium/Electron gap, is relayout an ALREADY-OPEN window's CONTENT the
 * moment its current display's scale factor changes: the native frame
 * rescales correctly, but the page inside can be left laid out for the
 * OLD scale factor, which reads as the content occupying only part of
 * the window -- "it only uses half of the screen" is exactly that shape
 * of bug, moving a window onto a second display is exactly how it's
 * triggered, and "some devices, never this one" fits a single-display
 * machine that can never even reach the code path that breaks.
 *
 * The fix that Electron's own issue tracker and other apps converge on is
 * not a CSS one: nudge the window's bounds by a pixel and back the moment
 * its current display's metrics change, which forces Chromium to
 * recompute layout against the display it is actually on now.
 * `display-metrics-changed` fires for exactly that -- a scale factor,
 * resolution or rotation change, which covers a window being dragged (or
 * the OS reassigning it) onto a differently-scaled display, not only a
 * monitor being reconnected.
 *
 * Unconfirmed against the actual reported hardware: there is no second,
 * differently-scaled display on this machine to reproduce the bug
 * against, only to confirm this nudge is inert here (`current.id` never
 * matches `changedDisplay.id` on a one-display machine, so it never
 * fires). It is the standard, narrowly-scoped, idempotent mitigation for
 * the specific bug class the symptom matches -- not a confirmed fix,
 * same honesty this project already applies to a fix it could not fully
 * verify against the reporter's own hardware (see the League of Legends
 * hardcoded-path fix). */
function nudgeOnDisplayChange(win) {
  const onMetricsChanged = (_event, changedDisplay) => {
    if (win.isDestroyed()) return;
    const current = screen.getDisplayMatching(win.getBounds());
    if (changedDisplay.id !== current.id) return;
    const bounds = win.getBounds();
    win.setBounds({ ...bounds, width: bounds.width + 1 });
    win.setBounds(bounds);
  };
  screen.on('display-metrics-changed', onMetricsChanged);
  win.once('closed', () => screen.removeListener('display-metrics-changed', onMetricsChanged));
}

async function createWindow() {
  const startTheme = startingTheme();
  const stateFile = windowStatePath();
  const saved = stateFile ? await loadWindowState(stateFile) : null;
  const resolvedBounds = resolveWindowState({
    saved,
    displays: screen.getAllDisplays(),
    defaultBounds: { width: 1280, height: 860 }
  });
  const win = new BrowserWindow({
    width: resolvedBounds.width,
    height: resolvedBounds.height,
    x: resolvedBounds.x,
    y: resolvedBounds.y,
    minWidth: 900,
    minHeight: 560,
    title: 'Prune',
    backgroundColor: OVERLAY_COLORS[startTheme].color,
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
     * `startingTheme()` above only picks which of these two palettes to
     * paint FIRST, from the OS preference. These colours are not CSS and
     * no stylesheet reaches them, so the renderer still tells the main
     * process whenever the theme actually changes (a toggle, or an
     * in-app choice overriding the OS) and the handler below repaints
     * them -- otherwise light mode leaves three dark glyphs on a light
     * strip. */
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      ...OVERLAY_COLORS[startTheme],
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
  nudgeOnDisplayChange(win);

  if (resolvedBounds.isMaximized) win.maximize();

  if (stateFile) {
    let saveTimer = null;
    const scheduleSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (win.isDestroyed()) return;
        saveWindowState(stateFile, { ...win.getBounds(), isMaximized: win.isMaximized() });
      }, 500);
    };
    win.on('resize', scheduleSave);
    win.on('move', scheduleSave);
    win.on('close', () => {
      // Unconditional, not debounced -- the window is closing right now,
      // so a pending debounce that hasn't fired yet must not be lost.
      // Synchronous, not the async saveWindowState the debounced saves
      // above use -- window-all-closed's app.quit() can fire before an
      // in-flight async write settles, silently losing the final save.
      clearTimeout(saveTimer);
      saveWindowStateSync(stateFile, { ...win.getBounds(), isMaximized: win.isMaximized() });
    });
  }

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

/* The update button's three requests (see preload.cjs and updater.cjs).
 *
 * Registered once, not per window, because ipcMain.handle refuses a
 * second handler for the same channel. Each one checks that the request
 * came from one of Prune's own windows, and the updater itself checks the
 * version it is handed, so nothing the renderer sends is taken on trust.
 * Progress goes back to every window, of which there is normally one. */
function registerUpdateHandlers() {
  const updater = createUpdater({
    autoUpdater,
    isPackaged: app.isPackaged,
    send: (channel, value) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(`prune:update:${channel}`, value);
      }
    }
  });
  const fromPrune = (event) => {
    if (!BrowserWindow.fromWebContents(event.sender)) throw new Error('Not a request from Prune.');
  };
  ipcMain.handle('prune:update:prepare', (event, version) => { fromPrune(event); return updater.prepare(version); });
  ipcMain.handle('prune:update:install', (event) => { fromPrune(event); updater.install(); });
  ipcMain.handle('prune:update:install-on-quit', (event, enabled) => { fromPrune(event); updater.installOnQuit(enabled); });
}

app.whenReady().then(async () => {
  /* Backend startup and window creation used to run strictly one after
   * the other: start the backend, POLL it every 300ms until it answers,
   * THEN create the window and start loading its page -- nothing visible
   * happened until the backend was not just started but confirmed
   * healthy. Nothing about creating a BrowserWindow or loading its page
   * touches the backend at all; only the RENDERER's own fetch calls hit
   * 127.0.0.1:3101, over a network stack that already retries once (see
   * lib/queryClient.js) and whose screens already render a loading state
   * before their first answer arrives (Dashboard's "Reading drive
   * health…" placeholders, for one). Running the two in parallel instead
   * puts a visible window on screen as soon as its own page loads,
   * rather than waiting out whatever the backend's own startup and first
   * health check happen to cost on top of that.
   *
   * `backendReady`'s own no-op `.catch` below exists only so a backend
   * that fails to start doesn't log a spurious "unhandled rejection"
   * during the gap before the real `await backendReady` further down --
   * that later await still sees and surfaces the original rejection,
   * since `.catch(() => {})` returns a new promise without altering
   * `backendReady` itself. */
  const backendReady = startBackend().then(() => waitForBackend());
  backendReady.catch(() => {});
  registerUpdateHandlers();

  await createWindow();
  await backendReady;

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});