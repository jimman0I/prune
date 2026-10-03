const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  createHunterWidget, registerHunterIpc, sanitizeLabels, widgetPosition, pointInsideBounds, postJson,
  WIDGET_SIZE, RESULT_CHANNEL
} = require('./hunterWidget.cjs');

/* Hunter's crosshair: a small always-on-top window the person drags onto any
 * window. A real drag cannot be performed from here, so what is held still is
 * every decision around it: what the window is built like, that the main
 * window is minimised and always comes back, that the crosshair is hidden
 * before the point is looked up, that the point goes to the backend in
 * physical pixels, that a second Hunter reuses the first, that cancelling and
 * quitting leave nothing behind, and that only Prune's own window, and only
 * the crosshair itself, can talk to these handlers. */

class FakeWindow {
  constructor(options = {}) {
    this.options = options;
    this.destroyed = false;
    this.visible = false;
    this.minimized = false;
    this.focused = 0;
    this.shows = 0;
    this.listeners = {};
    this.onceListeners = {};
    this.sent = [];
    this.bounds = { x: options.x ?? 0, y: options.y ?? 0, width: options.width ?? 1280, height: options.height ?? 860 };
    this.webContents = {
      sent: this.sent,
      send: (channel, value) => this.sent.push([channel, value]),
      setWindowOpenHandler: (fn) => { this.openHandler = fn; },
      on: (name, fn) => { this.wcListeners = { ...(this.wcListeners || {}), [name]: fn }; }
    };
    this.alwaysOnTop = null;
    FakeWindow.created.push(this);
  }
  on(name, fn) { this.listeners[name] = fn; }
  once(name, fn) { this.onceListeners[name] = fn; }
  loadFile(file, options) { this.loaded = { file, options }; return FakeWindow.loadFails ? Promise.reject(new Error('ERR_FILE_NOT_FOUND')) : Promise.resolve(); }
  removeMenu() { this.menuRemoved = true; }
  setAlwaysOnTop(flag, level) { this.alwaysOnTop = { flag, level }; }
  show() { this.visible = true; this.shows += 1; }
  hide() { this.visible = false; }
  focus() { this.focused += 1; }
  minimize() { this.minimized = true; }
  restore() { this.minimized = false; }
  isMinimized() { return this.minimized; }
  isDestroyed() { return this.destroyed; }
  getBounds() { return this.bounds; }
  destroy() { this.destroyed = true; this.visible = false; this.listeners.closed?.(); }
  close() { this.destroy(); }
}
FakeWindow.created = [];

function setup(over = {}) {
  FakeWindow.created = [];
  const main = new FakeWindow({ width: 1280, height: 860, x: 100, y: 50 });
  main.visible = true;
  const asked = [];
  const screen = {
    getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
    getCursorScreenPoint: () => over.cursor ?? { x: 800, y: 400 },
    dipToScreenPoint: (p) => (over.scale ? { x: p.x * over.scale, y: p.y * over.scale } : p)
  };
  const results = [];
  const hunter = createHunterWidget({
    BrowserWindow: FakeWindow,
    screen,
    getMainWindow: () => main,
    askBackend: over.askBackend ?? (async (point) => { asked.push({ ...point, widgetVisible: FakeWindow.created[1]?.visible }); return { status: 'picked', pid: 7, exePath: 'D:\\a.exe' }; }),
    send: (result) => results.push(result),
    pagePath: 'C:\\app\\hunterWidget.html',
    preloadPath: 'C:\\app\\hunterWidgetPreload.cjs',
    platform: over.platform ?? 'win32',
    wait: async () => {},
    ...over.extra
  });
  return { hunter, main, asked, results, widget: () => FakeWindow.created[1] };
}

/* ---- the pure parts ---- */

test('labels are plain short text, with English fallbacks', () => {
  assert.deepEqual(sanitizeLabels({ hint: 'Drag me', cancel: 'Stop' }), { hint: 'Drag me', cancel: 'Stop' });
  assert.deepEqual(sanitizeLabels(undefined), { hint: 'Drag onto a window', cancel: 'Cancel' });
  assert.deepEqual(sanitizeLabels({ hint: 5, cancel: null }), { hint: 'Drag onto a window', cancel: 'Cancel' });
  assert.deepEqual(sanitizeLabels({ hint: '   ', cancel: '' }), { hint: 'Drag onto a window', cancel: 'Cancel' });
});

test('labels lose control characters and are cut to a sane length', () => {
  const labels = sanitizeLabels({ hint: 'a\u0000b\nc\u007fd', cancel: 'x'.repeat(500) });
  assert.equal(labels.hint, 'abcd');
  assert.equal(labels.cancel.length, 40);
});

test('the crosshair sits at the top centre of the work area, inside it', () => {
  const pos = widgetPosition({ x: 1920, y: 0, width: 1920, height: 1040 }, { width: 80, height: 88 });
  assert.equal(pos.x, 1920 + 920);
  assert.ok(pos.y >= 0 && pos.y < 100);
});

test('pointInsideBounds', () => {
  const b = { x: 100, y: 100, width: 80, height: 88 };
  assert.equal(pointInsideBounds({ x: 100, y: 100 }, b), true);
  assert.equal(pointInsideBounds({ x: 179, y: 187 }, b), true);
  assert.equal(pointInsideBounds({ x: 180, y: 100 }, b), false);
  assert.equal(pointInsideBounds({ x: 99, y: 150 }, b), false);
});

/* ---- starting ---- */

test('start opens a small, frameless, always-on-top, non-resizable, skip-taskbar crosshair and minimises Prune', async () => {
  const { hunter, main, widget } = setup();
  assert.deepEqual(await hunter.start({ hint: 'Drag me', cancel: 'Stop' }), { ok: true });
  const w = widget();
  assert.equal(w.options.width, WIDGET_SIZE.width);
  assert.equal(w.options.height, WIDGET_SIZE.height);
  assert.ok(WIDGET_SIZE.width <= 96 && WIDGET_SIZE.height <= 96);
  assert.equal(w.options.frame, false);
  assert.equal(w.options.transparent, true);
  assert.equal(w.options.resizable, false);
  assert.equal(w.options.skipTaskbar, true);
  assert.equal(w.options.alwaysOnTop, true);
  assert.equal(w.options.minimizable, false);
  assert.equal(w.options.maximizable, false);
  assert.equal(w.options.fullscreenable, false);
  assert.equal(w.options.show, false);
  assert.equal(main.minimized, true);
  assert.equal(w.alwaysOnTop.flag, true);
  assert.equal(w.menuRemoved, true);
});

test('the crosshair page is sandboxed, isolated, and given only the plain-text labels', async () => {
  const { hunter, widget } = setup();
  await hunter.start({ hint: 'Drag me', cancel: 'Stop' });
  const prefs = widget().options.webPreferences;
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.preload, 'C:\\app\\hunterWidgetPreload.cjs');
  assert.equal(widget().loaded.file, 'C:\\app\\hunterWidget.html');
  assert.deepEqual(widget().loaded.options.query, { hint: 'Drag me', cancel: 'Stop' });
  assert.deepEqual(widget().openHandler(), { action: 'deny' });
});

test('the crosshair is shown once its page is ready, not before', async () => {
  const { hunter, widget } = setup();
  await hunter.start({});
  assert.equal(widget().visible, false);
  widget().onceListeners['ready-to-show']();
  assert.equal(widget().visible, true);
  assert.ok(widget().focused >= 1);
});

test('a second Hunter while one is open reuses it: no second window, no second minimise', async () => {
  const { hunter, main, widget } = setup();
  await hunter.start({});
  widget().onceListeners['ready-to-show']();
  main.minimized = false;
  const again = await hunter.start({});
  assert.deepEqual(again, { ok: true, reused: true });
  assert.equal(FakeWindow.created.length, 2);
  assert.ok(widget().shows >= 2);
  assert.equal(main.minimized, false);
});

test('start is refused off Windows, and when Prune\'s window is gone', async () => {
  const off = setup({ platform: 'linux' });
  assert.deepEqual(await off.hunter.start({}), { ok: false, unsupported: true });
  assert.equal(FakeWindow.created.length, 1);

  const { hunter, main } = setup();
  main.destroyed = true;
  const result = await hunter.start({});
  assert.equal(result.ok, false);
  assert.match(result.error, /window/i);
});

test('a crosshair page that will not load puts Prune back and says the hunt failed', async () => {
  FakeWindow.loadFails = true;
  try {
    const { hunter, main, results } = setup();
    await hunter.start({});
    await new Promise((r) => setImmediate(r));
    assert.equal(main.minimized, false);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'failed');
    assert.match(results[0].error, /ERR_FILE_NOT_FOUND/);
    assert.equal(hunter.isOpen(), false);
  } finally {
    FakeWindow.loadFails = false;
  }
});
/* ---- dropping ---- */

test('on drop the crosshair is hidden BEFORE the lookup, and the point goes to the backend', async () => {
  const { hunter, asked, widget } = setup({ cursor: { x: 800, y: 400 } });
  await hunter.start({});
  widget().onceListeners['ready-to-show']();
  await hunter.drop();
  assert.equal(asked.length, 1);
  assert.deepEqual({ x: asked[0].x, y: asked[0].y }, { x: 800, y: 400 });
  assert.equal(asked[0].widgetVisible, false);
});

test('the point is converted from DIPs to physical pixels and rounded to whole numbers', async () => {
  const { hunter, asked } = setup({ cursor: { x: 801, y: 401 }, scale: 1.25 });
  await hunter.start({});
  await hunter.drop();
  assert.deepEqual({ x: asked[0].x, y: asked[0].y }, { x: 1001, y: 501 });
  assert.ok(Number.isInteger(asked[0].x) && Number.isInteger(asked[0].y));
});

test('the answer restores Prune and goes to its window, and the crosshair is gone', async () => {
  const { hunter, main, results, widget } = setup();
  await hunter.start({});
  assert.equal(main.minimized, true);
  await hunter.drop();
  assert.equal(main.minimized, false);
  assert.ok(main.focused >= 1);
  assert.deepEqual(results, [{ status: 'picked', pid: 7, exePath: 'D:\\a.exe' }]);
  assert.equal(widget().destroyed, true);
  assert.equal(hunter.isOpen(), false);
});

test('releasing on the crosshair itself is not a drop: it stays open, nothing is asked', async () => {
  const { hunter, asked, results, widget } = setup({ cursor: { x: 1000, y: 40 } });
  await hunter.start({});
  widget().bounds = { x: 960, y: 24, width: 80, height: 88 };
  await hunter.drop();
  assert.equal(asked.length, 0);
  assert.equal(results.length, 0);
  assert.equal(hunter.isOpen(), true);
});

test('a backend that fails, or answers nonsense, is a failed result and Prune still comes back', async () => {
  const down = setup({ askBackend: async () => { throw new Error('ECONNREFUSED'); } });
  await down.hunter.start({});
  await down.hunter.drop();
  assert.equal(down.results[0].status, 'failed');
  assert.match(down.results[0].error, /ECONNREFUSED/);
  assert.equal(down.main.minimized, false);

  const junk = setup({ askBackend: async () => 'nope' });
  await junk.hunter.start({});
  await junk.hunter.drop();
  assert.equal(junk.results[0].status, 'failed');
  assert.equal(junk.main.minimized, false);
});

test('a drop with no crosshair open does nothing', async () => {
  const { hunter, asked, results } = setup();
  await hunter.drop();
  assert.equal(asked.length, 0);
  assert.equal(results.length, 0);
});

test('two drops at once ask once', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const calls = [];
  const { hunter, results } = setup({ askBackend: async (p) => { calls.push(p); await gate; return { status: 'nothing' }; } });
  await hunter.start({});
  const first = hunter.drop();
  const second = hunter.drop();
  release();
  await Promise.all([first, second]);
  assert.equal(calls.length, 1);
  assert.deepEqual(results, [{ status: 'nothing' }]);
});

test('quitting while the lookup is running sends nothing to a window that is going away', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { hunter, results } = setup({ askBackend: async () => { await gate; return { status: 'nothing' }; } });
  await hunter.start({});
  const dropped = hunter.drop();
  hunter.dispose();
  release();
  await dropped;
  assert.deepEqual(results, []);
});

/* ---- cancelling and quitting ---- */

test('cancelling from Prune closes the crosshair and restores the window without announcing anything', async () => {
  const { hunter, main, results, widget } = setup();
  await hunter.start({});
  assert.deepEqual(await hunter.cancel(), { ok: true, cancelled: true });
  assert.equal(widget().destroyed, true);
  assert.equal(main.minimized, false);
  assert.deepEqual(results, []);
  assert.equal(hunter.isOpen(), false);
});

test('cancelling with nothing open says so and changes nothing', async () => {
  const { hunter, main } = setup();
  assert.deepEqual(await hunter.cancel(), { ok: true, cancelled: false });
  assert.equal(main.minimized, false);
});

test('Esc or the cross on the crosshair closes it, restores Prune and tells it the hunt was cancelled', async () => {
  const { hunter, main, results, widget } = setup();
  await hunter.start({});
  hunter.cancelFromWidget();
  assert.equal(widget().destroyed, true);
  assert.equal(main.minimized, false);
  assert.deepEqual(results, [{ status: 'cancelled' }]);
});

test('closing the crosshair some other way (Alt+F4) counts as cancelling', async () => {
  const { hunter, main, results, widget } = setup();
  await hunter.start({});
  widget().listeners.closed();
  assert.equal(main.minimized, false);
  assert.deepEqual(results, [{ status: 'cancelled' }]);
  assert.equal(hunter.isOpen(), false);
});

test('quitting closes the crosshair quietly: no restore, no message', async () => {
  const { hunter, main, results, widget } = setup();
  await hunter.start({});
  hunter.dispose();
  assert.equal(widget().destroyed, true);
  assert.deepEqual(results, []);
  assert.equal(main.minimized, true);
  assert.equal(hunter.isOpen(), false);
  hunter.dispose(); // idempotent
});

/* ---- the IPC handlers ---- */

function fakeIpc() {
  const handlers = {};
  const listeners = {};
  return {
    handlers, listeners,
    handle: (channel, fn) => { handlers[channel] = fn; },
    on: (channel, fn) => { listeners[channel] = fn; }
  };
}

function wire() {
  const ctx = setup();
  const ipc = fakeIpc();
  registerHunterIpc({ ipcMain: ipc, hunter: ctx.hunter, getMainWindow: () => ctx.main });
  return { ...ctx, ipc };
}

test('registers exactly the four fixed channels', () => {
  const { ipc } = wire();
  assert.deepEqual(Object.keys(ipc.handlers).sort(), ['prune:hunter:cancel', 'prune:hunter:start']);
  assert.deepEqual(Object.keys(ipc.listeners).sort(), ['prune:hunter-widget:cancel', 'prune:hunter-widget:drop']);
});

test('Prune\'s window can start and cancel a hunt', async () => {
  const { ipc, main, widget } = wire();
  assert.deepEqual(await ipc.handlers['prune:hunter:start']({ sender: main.webContents }, { hint: 'h', cancel: 'c' }), { ok: true });
  assert.ok(widget());
  assert.deepEqual(await ipc.handlers['prune:hunter:cancel']({ sender: main.webContents }), { ok: true, cancelled: true });
});

test('nothing else may start or cancel a hunt -- not the crosshair, not some other window', async () => {
  const { ipc, widget, main } = wire();
  await ipc.handlers['prune:hunter:start']({ sender: main.webContents }, {});
  const stranger = { sender: { not: 'prune' } };
  assert.throws(() => ipc.handlers['prune:hunter:start'](stranger, {}), /Not a request from Prune/);
  assert.throws(() => ipc.handlers['prune:hunter:cancel'](stranger), /Not a request from Prune/);
  assert.throws(() => ipc.handlers['prune:hunter:cancel']({ sender: widget().webContents }), /Not a request from Prune/);
  assert.throws(() => ipc.handlers['prune:hunter:start']({ sender: widget().webContents }, {}), /Not a request from Prune/);
});

test('only the crosshair\'s own page can report a drop or a cancel', async () => {
  const { ipc, main, widget, asked, results } = wire();
  await ipc.handlers['prune:hunter:start']({ sender: main.webContents }, {});
  ipc.listeners['prune:hunter-widget:drop']({ sender: main.webContents });
  ipc.listeners['prune:hunter-widget:drop']({ sender: { not: 'the crosshair' } });
  ipc.listeners['prune:hunter-widget:cancel']({ sender: main.webContents });
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.length, 0);
  assert.equal(results.length, 0);
  assert.equal(hunterOpen(widget()), true);

  ipc.listeners['prune:hunter-widget:drop']({ sender: widget().webContents });
  await new Promise((r) => setImmediate(r));
  assert.equal(asked.length, 1);
});

function hunterOpen(win) { return !win.destroyed; }

test('the crosshair\'s cancel closes it and reports the cancel', async () => {
  const { ipc, main, widget, results } = wire();
  await ipc.handlers['prune:hunter:start']({ sender: main.webContents }, {});
  ipc.listeners['prune:hunter-widget:cancel']({ sender: widget().webContents });
  assert.deepEqual(results, [{ status: 'cancelled' }]);
});

test('results reach Prune\'s window on the one-way result channel', () => {
  assert.equal(RESULT_CHANNEL, 'prune:hunter:result');
});

/* ---- the call to the backend ---- */

test('postJson sends the point as JSON to the backend and parses the answer', async () => {
  let seen;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen = { method: req.method, url: req.url, type: req.headers['content-type'], host: req.headers.host, origin: req.headers.origin, body: JSON.parse(body) };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'nothing' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const port = server.address().port;
    const answer = await postJson({ http, port, path: '/api/hunter/at-point', body: { x: 12, y: -3 } });
    assert.deepEqual(answer, { status: 'nothing' });
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, '/api/hunter/at-point');
    assert.equal(seen.type, 'application/json');
    assert.equal(seen.host, `127.0.0.1:${port}`);
    assert.equal(seen.origin, undefined);
    assert.deepEqual(seen.body, { x: 12, y: -3 });
  } finally {
    server.close();
  }
});

test('postJson rejects on an error status, on non-JSON, and on a dead port', async () => {
  const server = http.createServer((req, res) => {
    req.resume();
    if (req.url === '/bad') { res.statusCode = 400; res.end(JSON.stringify({ error: 'x and y must be whole numbers.' })); return; }
    res.end('<html>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    await assert.rejects(postJson({ http, port, path: '/bad', body: {} }), /whole numbers/);
    await assert.rejects(postJson({ http, port, path: '/html', body: {} }), /answer/i);
  } finally {
    server.close();
  }
  await assert.rejects(postJson({ http, port, path: '/x', body: {}, timeoutMs: 500 }));
});

/* ---- packaging and wiring (read as source, like relaunchAdmin.test.cjs) ---- */

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const config = require('./electron-builder.config.cjs');

test('the crosshair\'s code, preload and page are all packed', () => {
  for (const file of ['hunterWidget.cjs', 'hunterWidgetPreload.cjs', 'hunterWidget.html']) {
    assert.ok(config.files.includes(file), `${file} is not in files[]`);
    assert.ok(fs.existsSync(path.join(__dirname, file)), `${file} does not exist`);
  }
});

test('every file main.cjs points at by __dirname is packed, pages included', () => {
  const main = read('main.cjs');
  const named = [...main.matchAll(/path\.join\(__dirname, '([^']+)'\)/g)].map((m) => m[1]).filter((f) => /\.(cjs|html|js)$/.test(f));
  assert.ok(named.includes('hunterWidget.html'));
  assert.ok(named.includes('hunterWidgetPreload.cjs'));
  for (const file of named) assert.ok(config.files.includes(file), `${file} is not in files[]`);
});

test('main.cjs wiring -- registered once, closed with the window and on quit', () => {
  const src = read('main.cjs');
  assert.match(src, /require\('\.\/hunterWidget\.cjs'\)/);
  assert.match(src, /registerHunterIpc\(\{/);
  assert.match(src, /hunter\.dispose\(\)/);
  assert.match(src, /app\.on\('before-quit'/);
  assert.match(src, /\/api\/hunter\/at-point/);
});

test('preload.cjs wiring -- start (with labels only), cancel, and a result listener', () => {
  const src = read('preload.cjs');
  assert.match(src, /ipcRenderer\.invoke\('prune:hunter:start'/);
  assert.match(src, /ipcRenderer\.invoke\('prune:hunter:cancel'\)/);
  assert.match(src, /ipcRenderer\.on\('prune:hunter:result'/);
});

test('the crosshair\'s preload exposes a drop and a cancel and nothing else', () => {
  const src = read('hunterWidgetPreload.cjs');
  assert.match(src, /ipcRenderer\.send\('prune:hunter-widget:drop'\)/);
  assert.match(src, /ipcRenderer\.send\('prune:hunter-widget:cancel'\)/);
  assert.equal((src.match(/ipcRenderer\.(send|invoke|on)\(/g) || []).length, 2);
  assert.equal(/require\((?!'electron')/.test(src), false);
});

test('the crosshair\'s page: no network, no external anything, text set as text, Esc cancels', () => {
  const html = read('hunterWidget.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.equal(/https?:\/\//.test(html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')), false, 'a remote URL');
  assert.equal(/\btitle="/.test(html), false, 'a native hover tooltip');
  assert.equal(/innerHTML|outerHTML|document\.write|eval\(/.test(html), false);
  assert.match(html, /<svg/);
  assert.match(html, /cursor: crosshair/);
  assert.match(html, /textContent/);
  assert.match(html, /'Escape'/);
  assert.match(html, /setPointerCapture/);
  assert.match(html, /pruneHunterWidget\.drop\(\)/);
  assert.match(html, /pruneHunterWidget\.cancel\(\)/);
});
