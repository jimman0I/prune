const { app, BrowserWindow } = require('electron');
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

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    title: 'Prune',
    backgroundColor: '#09090b',
    icon: iconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Electron's stock File/Edit/View/Window menu bar is a dev-tooling
  // default (Reload, Toggle DevTools, Zoom…) — nothing Prune's own UI
  // offers, and it doesn't belong on a native desktop utility that isn't a
  // browser. Same call Re:Route's own main.cjs already makes.
  win.removeMenu();

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