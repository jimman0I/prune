/** Hunter's crosshair: a small always-on-top window the person drags onto any
 * window to learn which program it belongs to.
 *
 * The flow, end to end:
 *   1. The Hunter dialog asks the main process to start (prune:hunter:start).
 *      A ~80x88 frameless, transparent, always-on-top, skip-taskbar window with
 *      a crosshair opens near the top of the screen and Prune's own window is
 *      minimised so other windows can be targeted.
 *   2. The person presses the crosshair, drags, and releases over a window.
 *      The crosshair's page reports only "dropped" (or "cancelled").
 *   3. The main process reads where the pointer is with Electron's screen API,
 *      hides the crosshair FIRST so it is not what gets hit, converts the point
 *      from DIPs to physical pixels, and asks the backend about that one point
 *      (POST /api/hunter/at-point).
 *   4. Prune's window is restored and the answer goes to it on a one-way event
 *      (prune:hunter:result).
 *
 * Nothing here watches the keyboard or polls the pointer: the crosshair's page
 * hears its own pointer events, and the main process reads the pointer once,
 * at the moment of the drop. That is deliberate. Antivirus reads polling input
 * as a keylogger, and an earlier Hunter that did was a liability for a cleaner
 * (see backend/src/services/noKeyPolling.test.js).
 *
 * Kept free of `require('electron')` so it is testable under node:test: the
 * window class, the screen, and the backend call are handed in. */

const WIDGET_SIZE = { width: 80, height: 88 };
const LABEL_MAX = 40;
const DEFAULT_LABELS = { hint: 'Drag onto a window', cancel: 'Cancel' };
const RESULT_CHANNEL = 'prune:hunter:result';
// How long the crosshair gets to actually leave the screen before the point is
// looked up. The lookup itself takes far longer to start, so this is margin.
const HIDE_SETTLE_MS = 120;

/** One plain-text label: a string, without control characters, trimmed and
 * cut to LABEL_MAX, or the fallback. These come from the page and end up in a
 * file URL's query and then in the crosshair's text, so nothing richer than
 * short plain text is accepted. */
function sanitizeLabel(value, fallback) {
  if (typeof value !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LABEL_MAX);
  return clean || fallback;
}

function sanitizeLabels(labels) {
  const given = labels && typeof labels === 'object' ? labels : {};
  return {
    hint: sanitizeLabel(given.hint, DEFAULT_LABELS.hint),
    cancel: sanitizeLabel(given.cancel, DEFAULT_LABELS.cancel)
  };
}

/** Top centre of a display's work area, a little below its edge. */
function widgetPosition(workArea, size = WIDGET_SIZE) {
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: Math.round(workArea.y + 24)
  };
}

function pointInsideBounds(point, bounds) {
  return point.x >= bounds.x && point.x < bounds.x + bounds.width
    && point.y >= bounds.y && point.y < bounds.y + bounds.height;
}

/** An answer from the backend, or a failed result if it is not one. */
function normalizeResult(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.status === 'string') return raw;
  return { status: 'failed' };
}

/** POST a JSON body to the local backend and parse the JSON answer. Rejects on
 * a refusal (the backend's own `error` text), on an answer that is not JSON,
 * and on a connection that fails or times out. `agent: false` so a kept-alive
 * socket to a backend that restarted is never reused. */
function postJson({ http, port, path, body, timeoutMs = 60_000 }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port, path, method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(text); } catch { reject(new Error('The backend sent an answer Prune could not read.')); return; }
        if (res.statusCode >= 400) { reject(new Error(data?.error || `Request failed: ${res.statusCode}`)); return; }
        resolve(data);
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('The lookup took too long.')));
    req.on('error', reject);
    req.end(payload);
  });
}

function createHunterWidget({
  BrowserWindow, screen, getMainWindow, askBackend, send, pagePath, preloadPath,
  platform = process.platform,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  // The one open crosshair, or null. `busy` is set while a drop is being looked
  // up; `closing` while WE close the window, so its 'closed' event is not read
  // as the person closing it.
  let current = null;

  const isOpen = () => current !== null && !current.win.isDestroyed();

  function restoreMain() {
    const main = getMainWindow();
    if (!main || main.isDestroyed()) return;
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
  }

  function closeWidget() {
    const mine = current;
    current = null;
    if (!mine) return;
    mine.closing = true;
    if (!mine.win.isDestroyed()) mine.win.destroy();
  }

  /** The person (or a crash) ended the hunt: back to Prune, and tell it. */
  function endHunt(result) {
    closeWidget();
    restoreMain();
    send(result);
  }

  function start(labels) {
    if (platform !== 'win32') return { ok: false, unsupported: true };
    if (isOpen()) {
      current.win.show();
      current.win.focus();
      return { ok: true, reused: true };
    }
    const main = getMainWindow();
    if (!main || main.isDestroyed()) return { ok: false, error: 'Prune\'s window is not available.' };

    const clean = sanitizeLabels(labels);
    const display = screen.getDisplayMatching(main.getBounds());
    const { x, y } = widgetPosition(display.workArea);
    const win = new BrowserWindow({
      width: WIDGET_SIZE.width,
      height: WIDGET_SIZE.height,
      x,
      y,
      useContentSize: true,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      title: 'Prune Hunter',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: false,
        spellcheck: false,
        preload: preloadPath
      }
    });
    const mine = { win, busy: false, closing: false };
    current = mine;

    win.removeMenu();
    // Above ordinary windows and above full-screen ones, so it can be dropped
    // from anywhere.
    win.setAlwaysOnTop(true, 'screen-saver');
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      win.show();
      win.focus();
    });
    win.on('closed', () => {
      if (mine.closing || current !== mine) return;
      // Closed some other way (Alt+F4, the system): that is a cancel.
      current = null;
      restoreMain();
      send({ status: 'cancelled' });
    });
    Promise.resolve(win.loadFile(pagePath, { query: clean })).catch((err) => {
      if (current !== mine) return;
      endHunt({ status: 'failed', error: err?.message || 'The crosshair could not open.' });
    });

    main.minimize();
    return { ok: true };
  }

  /** Called when the person lets go. Reads the pointer once, hides the
   * crosshair, asks the backend about that point and hands the answer to
   * Prune's window. */
  async function drop() {
    const mine = current;
    if (!mine || mine.busy || mine.win.isDestroyed()) return;

    const cursor = screen.getCursorScreenPoint();
    // Let go on the crosshair itself: nothing was chosen, keep waiting.
    if (pointInsideBounds(cursor, mine.win.getBounds())) return;

    mine.busy = true;
    mine.win.hide();
    await wait(HIDE_SETTLE_MS);
    if (current !== mine) return; // quit or cancelled while hiding

    const physical = screen.dipToScreenPoint ? screen.dipToScreenPoint(cursor) : cursor;
    let result;
    try {
      result = normalizeResult(await askBackend({ x: Math.round(physical.x), y: Math.round(physical.y) }));
    } catch (err) {
      result = { status: 'failed', error: err?.message || 'The lookup failed.' };
    }
    if (current !== mine) return; // the app is quitting: nobody to tell
    endHunt(result);
  }

  /** Prune's own Cancel: close the crosshair and restore the window. The
   * dialog already knows, so nothing is announced. */
  function cancel() {
    if (!isOpen()) return { ok: true, cancelled: false };
    closeWidget();
    restoreMain();
    return { ok: true, cancelled: true };
  }

  /** Esc or the cross on the crosshair: the same, but Prune is told. */
  function cancelFromWidget() {
    if (!isOpen()) return;
    endHunt({ status: 'cancelled' });
  }

  /** The app is quitting (or its window closed): remove the crosshair and say
   * nothing to anyone. */
  function dispose() {
    closeWidget();
  }

  function isWidgetSender(sender) {
    return isOpen() && current.win.webContents === sender;
  }

  return { start, drop, cancel, cancelFromWidget, dispose, isOpen, isWidgetSender };
}

/** The four channels, each checked against who sent it. Starting and
 * cancelling answer Prune's own window and nothing else -- not even the
 * crosshair, which is a window of this app too; dropping and cancelling from
 * the crosshair answer the crosshair's own page and nothing else. The page
 * names no coordinates: the main process reads the pointer itself. */
function registerHunterIpc({ ipcMain, hunter, getMainWindow }) {
  const fromPrune = (event) => {
    const main = getMainWindow();
    if (!main || main.isDestroyed() || event.sender !== main.webContents) throw new Error('Not a request from Prune.');
  };
  ipcMain.handle('prune:hunter:start', (event, labels) => { fromPrune(event); return hunter.start(labels); });
  ipcMain.handle('prune:hunter:cancel', (event) => { fromPrune(event); return hunter.cancel(); });
  ipcMain.on('prune:hunter-widget:drop', (event) => {
    if (hunter.isWidgetSender(event.sender)) hunter.drop().catch(() => {});
  });
  ipcMain.on('prune:hunter-widget:cancel', (event) => {
    if (hunter.isWidgetSender(event.sender)) hunter.cancelFromWidget();
  });
}

module.exports = {
  createHunterWidget, registerHunterIpc, sanitizeLabels, widgetPosition, pointInsideBounds, normalizeResult, postJson,
  WIDGET_SIZE, RESULT_CHANNEL, DEFAULT_LABELS
};
