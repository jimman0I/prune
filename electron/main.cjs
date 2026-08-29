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

/** Where quarantine/backup data lives — outside the install directory so
 * an app upgrade never deletes it. Same reasoning as Re:Route's own
 * dataDir.js: userData survives upgrades, an install-relative path
 * doesn't. */
function quarantineRoot() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'quarantine') : null;
}

/** Starts the Express backend in-process (it's ESM, loaded via dynamic
 * import) — same pattern as Re:Route's electron/main.cjs. */
async function startBackend() {
  const quarantineDir = quarantineRoot();
  if (quarantineDir) process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
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
    title: 'unrevo',
    backgroundColor: '#09090b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    await win.loadFile(path.join(process.resourcesPath, 'frontend-dist', 'index.html'));
  } else {
    await win.loadURL('http://localhost:5174');
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