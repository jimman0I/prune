const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInstallerQuitWatcher, QUIT_FLAG } = require('./installerQuit.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prune-quit-'));
const noTimer = { setTimer: () => ({}), clearTimer: () => {} };

test('a flag written after start makes the app quit once, and is consumed', () => {
  const dir = tmp();
  let quits = 0;
  const watcher = createInstallerQuitWatcher({ dir, onQuit: () => { quits += 1; }, ...noTimer });
  fs.writeFileSync(path.join(dir, QUIT_FLAG), 'quit');
  assert.equal(watcher.check(), true);
  assert.equal(quits, 1);
  assert.equal(fs.existsSync(path.join(dir, QUIT_FLAG)), false);
  assert.equal(watcher.check(), false);
  assert.equal(quits, 1);
});

test('no flag means nothing happens', () => {
  const dir = tmp();
  let quits = 0;
  const watcher = createInstallerQuitWatcher({ dir, onQuit: () => { quits += 1; }, ...noTimer });
  assert.equal(watcher.check(), false);
  assert.equal(quits, 0);
});

test('a flag left over from before this start is deleted and ignored', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, QUIT_FLAG), 'quit');
  let quits = 0;
  const watcher = createInstallerQuitWatcher({ dir, onQuit: () => { quits += 1; }, ...noTimer });
  assert.equal(fs.existsSync(path.join(dir, QUIT_FLAG)), false, 'removed at start');
  assert.equal(watcher.check(), false);
  assert.equal(quits, 0);
});

test('a stale flag that appears with an old timestamp is removed without quitting', () => {
  const dir = tmp();
  let quits = 0;
  const watcher = createInstallerQuitWatcher({ dir, onQuit: () => { quits += 1; }, ...noTimer });
  const file = path.join(dir, QUIT_FLAG);
  fs.writeFileSync(file, 'quit');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(file, old, old);
  assert.equal(watcher.check(), false);
  assert.equal(fs.existsSync(file), false);
  assert.equal(quits, 0);
});

test('the timer polls and stops itself after quitting', () => {
  const dir = tmp();
  let tick;
  let cleared = 0;
  let quits = 0;
  createInstallerQuitWatcher({
    dir, onQuit: () => { quits += 1; },
    setTimer: (fn) => { tick = fn; return {}; },
    clearTimer: () => { cleared += 1; }
  });
  tick();
  assert.equal(quits, 0);
  fs.writeFileSync(path.join(dir, QUIT_FLAG), 'quit');
  tick();
  assert.equal(quits, 1);
  assert.equal(cleared, 1);
});

test('installer.nsh asks the running app to quit, for install and uninstall, with the same file name', () => {
  const nsh = fs.readFileSync(path.join(__dirname, 'build', 'installer.nsh'), 'utf8');
  assert.match(nsh, /installer-quit\.flag/);
  assert.equal(QUIT_FLAG, 'installer-quit.flag');
  assert.match(nsh, /!macro customInit[\s\S]*?PruneAskAppToQuit[\s\S]*?!macroend/);
  assert.match(nsh, /!macro customUnInit[\s\S]*?PruneAskAppToQuit[\s\S]*?!macroend/);
});

test('main.cjs starts the watcher in the packaged app and the builder ships the module', () => {
  const main = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /require\('\.\/installerQuit\.cjs'\)/);
  assert.match(main, /createInstallerQuitWatcher\(\{[\s\S]*?app\.quit\(\)/);
  const builder = fs.readFileSync(path.join(__dirname, 'electron-builder.config.cjs'), 'utf8');
  assert.match(builder, /'installerQuit\.cjs'/);
});
