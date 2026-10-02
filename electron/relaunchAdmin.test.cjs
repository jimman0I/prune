const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAdminRelaunch, parseRelaunchArg, waitForParentExit, RELAUNCH_FLAG } = require('./relaunchAdmin.cjs');

/* Prune restarting itself as Administrator, so the fast Disk Map scan needs
 * no prompt afterwards.
 *
 * What is held still here is everything that could go wrong around a
 * deliberately privileged action: that it only runs from a packaged build,
 * that a declined UAC prompt leaves the running app alone, that the old
 * instance goes away only once the elevated one has actually been started,
 * and that nothing the window sends can alter what gets launched. */

function fakeApp({ packaged = true } = {}) {
  const app = { isPackaged: packaged, quits: 0 };
  app.quit = () => { app.quits += 1; };
  return app;
}

function make(over = {}) {
  const calls = [];
  const app = over.app ?? fakeApp();
  const relaunch = createAdminRelaunch({
    app,
    platform: over.platform ?? 'win32',
    execPath: over.execPath ?? 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe',
    pid: over.pid ?? 4242,
    execFile: over.execFile ?? ((file, args, options, callback) => {
      calls.push({ file, args });
      callback(null, '', '');
    }),
    defer: (fn) => fn()
  });
  return { relaunch, app, calls };
}

test('starts the packaged exe with RunAs, naming the old process to wait for', async () => {
  const { relaunch, calls } = make();
  assert.deepEqual(await relaunch.relaunch(), { ok: true });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, 'powershell.exe');
  const script = calls[0].args[calls[0].args.length - 1];
  assert.match(script, /Start-Process/);
  assert.match(script, /-Verb RunAs/);
  assert.ok(script.includes("'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe'"));
  assert.ok(script.includes(`${RELAUNCH_FLAG}=4242`));
});

test('quits this instance only after the elevated one was started', async () => {
  const { relaunch, app } = make();
  await relaunch.relaunch();
  assert.equal(app.quits, 1);
});

test('a declined UAC prompt leaves the running app alone', async () => {
  const { relaunch, app } = make({
    execFile: (file, args, options, callback) => callback(new Error('The operation was canceled by the user.'), '', '')
  });
  assert.deepEqual(await relaunch.relaunch(), { ok: false, cancelled: true });
  assert.equal(app.quits, 0);
});

test('a real failure to start is reported, and the app stays open', async () => {
  const { relaunch, app } = make({
    execFile: (file, args, options, callback) => callback(new Error('Access is denied'), '', '')
  });
  const result = await relaunch.relaunch();
  assert.equal(result.ok, false);
  assert.match(result.error, /Access is denied/);
  assert.notEqual(result.cancelled, true);
  assert.equal(app.quits, 0);
});

test('refuses outside a packaged build, where execPath is Electron itself', async () => {
  // Relaunching an unpackaged app would start a bare electron.exe with no
  // app to run.
  const { relaunch, calls, app } = make({ app: fakeApp({ packaged: false }) });
  assert.equal(relaunch.canRelaunch(), false);
  const result = await relaunch.relaunch();
  assert.equal(result.ok, false);
  assert.equal(result.unsupported, true);
  assert.equal(calls.length, 0);
  assert.equal(app.quits, 0);
});

test('refuses on a platform without UAC', async () => {
  const { relaunch, calls } = make({ platform: 'linux' });
  assert.equal(relaunch.canRelaunch(), false);
  assert.equal((await relaunch.relaunch()).unsupported, true);
  assert.equal(calls.length, 0);
});

test('a quote in the install path cannot break out of the PowerShell literal', async () => {
  const { relaunch, calls } = make({ execPath: "C:\\Users\\O'Brien\\Prune.exe" });
  await relaunch.relaunch();
  const script = calls[0].args[calls[0].args.length - 1];
  assert.ok(script.includes("'C:\\Users\\O''Brien\\Prune.exe'"));
});

test('two clicks start one elevated instance, not two', async () => {
  let release;
  const calls = [];
  const { relaunch } = make({
    execFile: (file, args, options, callback) => { calls.push(args); release = () => callback(null, '', ''); }
  });
  const first = relaunch.relaunch();
  const second = relaunch.relaunch();
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls.length, 1);
  assert.deepEqual(a, b);
});

test('can try again after a declined prompt', async () => {
  let answers = [new Error('canceled by the user'), null];
  const calls = [];
  const { relaunch } = make({
    execFile: (file, args, options, callback) => { calls.push(1); callback(answers.shift(), '', ''); }
  });
  assert.equal((await relaunch.relaunch()).cancelled, true);
  assert.deepEqual(await relaunch.relaunch(), { ok: true });
  assert.equal(calls.length, 2);
});

/* The elevated instance's start-up. */

test('parseRelaunchArg -- reads the old pid from the one flag, and nothing else', () => {
  assert.equal(parseRelaunchArg([`${RELAUNCH_FLAG}=1234`]), 1234);
  assert.equal(parseRelaunchArg(['--other', `${RELAUNCH_FLAG}=77`, 'x']), 77);
  for (const bad of [[], [`${RELAUNCH_FLAG}=`], [`${RELAUNCH_FLAG}=abc`], [`${RELAUNCH_FLAG}=-5`], [`${RELAUNCH_FLAG}=0`],
    [`${RELAUNCH_FLAG}=12; calc`], [`${RELAUNCH_FLAG}=99999999999`], [RELAUNCH_FLAG], ['--prune-relaunch-after-x=5']]) {
    assert.equal(parseRelaunchArg(bad), null, JSON.stringify(bad));
  }
});

test('waitForParentExit -- returns as soon as the old process is gone', async () => {
  let alive = 3;
  const sleeps = [];
  const exited = await waitForParentExit(55, {
    isAlive: () => alive-- > 0,
    sleep: async (ms) => { sleeps.push(ms); },
    now: () => 0,
    timeoutMs: 15000
  });
  assert.equal(exited, true);
  assert.equal(sleeps.length, 3);
});

test('waitForParentExit -- gives up after the timeout rather than hanging the start-up', async () => {
  let t = 0;
  const exited = await waitForParentExit(55, {
    isAlive: () => true,
    sleep: async (ms) => { t += ms; },
    now: () => t,
    timeoutMs: 1000,
    intervalMs: 250
  });
  assert.equal(exited, false);
  assert.ok(t >= 1000);
});

test('waitForParentExit -- an already-gone process is no wait at all', async () => {
  const sleeps = [];
  assert.equal(await waitForParentExit(55, { isAlive: () => false, sleep: async (m) => sleeps.push(m), now: () => 0 }), true);
  assert.equal(sleeps.length, 0);
});

/* main.cjs and preload.cjs wiring -- read as source, like zoom.test.cjs. */

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

test('main.cjs wiring -- the IPC handlers are sender-checked and the new instance waits for the old one', () => {
  const src = read('main.cjs');
  assert.match(src, /require\('\.\/relaunchAdmin\.cjs'\)/);
  assert.match(src, /ipcMain\.handle\('prune:admin:relaunch', \(event\) => \{ fromPrune\(event\);/);
  assert.match(src, /ipcMain\.handle\('prune:admin:can-relaunch', \(event\) => \{ fromPrune\(event\);/);
  assert.match(src, /parseRelaunchArg\(process\.argv\)/);
  assert.match(src, /waitForParentExit\(/);
});

test('preload.cjs wiring -- exposes two fixed requests and no arguments', () => {
  const src = read('preload.cjs');
  assert.match(src, /relaunch: \(\) => ipcRenderer\.invoke\('prune:admin:relaunch'\)/);
  assert.match(src, /canRelaunch: \(\) => ipcRenderer\.invoke\('prune:admin:can-relaunch'\)/);
});
