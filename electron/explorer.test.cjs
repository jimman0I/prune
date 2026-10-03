const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const config = require('./electron-builder.config.cjs');
const requests = require('./explorerRequests.cjs');

/* "Add Prune to the right-click menu" is made of four parts that live in
 * different packages and cannot import each other: the backend service that
 * writes the registry verbs (ESM), the NSIS uninstaller that removes them, the
 * main process that reads the command line (CommonJS), and the preload that
 * hands the request to the page. These tests compare them, and check the
 * promises the feature makes about what a request can do. */

const read = (...parts) => readFileSync(path.join(__dirname, ...parts), 'utf8');
const main = read('main.cjs');
const preload = read('preload.cjs');
const nsh = read('build', 'installer.nsh');

async function backendEntries() {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'backend', 'src', 'services', 'explorerMenu.js')).href);
  return mod.ENTRIES;
}

function unInstallMacro() {
  const match = /!macro customUnInstall\r?\n([\s\S]*?)!macroend/.exec(nsh);
  assert.ok(match, 'installer.nsh has no customUnInstall macro');
  return match[1];
}

test('the uninstaller removes exactly the keys the app writes, and the empty shell keys above them', async () => {
  const entries = await backendEntries();
  assert.equal(entries.length, 4);
  const body = unInstallMacro();
  const nsisKey = (key) => key.replace(/^HKCU\\/, '');
  const verbs = [...body.matchAll(/DeleteRegKey HKCU "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(verbs.sort(), entries.map((e) => nsisKey(e.key)).sort());
  const shells = [...body.matchAll(/DeleteRegKey \/ifempty HKCU "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(shells.sort(), [...new Set(entries.map((e) => nsisKey(e.key).replace(/\\[^\\]+$/, '')))].sort());
});

test('every key it removes is named for Prune and sits under a verb list, never a bare class key', async () => {
  const entries = await backendEntries();
  for (const { key } of entries) {
    assert.match(key, /^HKCU\\Software\\Classes\\(?:\*|Directory|exefile|lnkfile)\\shell\\Prune(?:Shred|FindProgram)$/);
  }
});

test('the uninstaller leaves them for an update, like the other entries Prune keeps across one', () => {
  const guarded = /\$\{ifNot\} \$\{isUpdated\}([\s\S]*?)\$\{endIf\}/i.exec(unInstallMacro())[1];
  assert.match(guarded, /DeleteRegKey HKCU "Software\\Classes\\\*\\shell\\PruneShred"/);
});

test('the flags the menu writes are the flags the main process reads', async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'backend', 'src', 'services', 'explorerMenu.js')).href);
  assert.equal(mod.SHRED_FLAG, requests.SHRED_FLAG);
  assert.equal(mod.FIND_FLAG, requests.FIND_FLAG);
  // What Explorer runs: the program, the flag, and the one path in place of %1.
  // Windows hands that to the program as separate arguments, and the main
  // process reads them as a request.
  const exe = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe';
  assert.equal(mod.commandFor(exe, mod.SHRED_FLAG), `"${exe}" --shred "%1"`);
  assert.deepEqual(requests.parseOpenRequest([exe, mod.SHRED_FLAG, 'C:\\old.docx']).request, { kind: 'shred', path: 'C:\\old.docx' });
  assert.deepEqual(requests.parseOpenRequest([exe, mod.FIND_FLAG, 'C:\\a.exe']).request, { kind: 'find-program', path: 'C:\\a.exe' });
});

test('main.cjs reads a request from its own command line and from a second launch', () => {
  assert.match(main, /require\('\.\/explorerRequests\.cjs'\)/);
  assert.match(main, /parseOpenRequest\(process\.argv\)/);
  assert.match(main, /app\.on\('second-instance', \(_event, argv\) => \{[\s\S]*?parseOpenRequest\(argv\)/);
  // A request shows the window even when the launch carried --start-minimized.
  assert.match(main, /parseStartMinimized\(process\.argv\) && !/);
});

test('main.cjs only turns a request into a one-way event: it runs nothing from it', () => {
  const relay = /const openRequests = createOpenRequestRelay\(\{[\s\S]*?\r?\n\}\);/.exec(main)?.[0];
  const ready = /function registerOpenRequestHandlers\(\) \{[\s\S]*?\r?\n\}/.exec(main)?.[0];
  const second = /app\.on\('second-instance'[\s\S]*?\r?\n  \}\);/.exec(main)?.[0];
  assert.ok(relay && ready && second, 'could not find the request handling in main.cjs');
  for (const section of [relay, ready, second]) {
    assert.doesNotMatch(section, /execFile|spawn|shell\.|openPath|exec\(|fs\.|unlink|rm\(/);
  }
  assert.match(relay, /webContents\.send\(OPEN_REQUEST_CHANNEL, request\)/);
});

test('main.cjs hears "the page is listening" only from its own window, and only as a boolean', () => {
  assert.match(main, /ipcMain\.on\(OPEN_REQUEST_READY_CHANNEL, \(event, ready\) => \{\s*if \(!mainWindow \|\| event\.sender !== mainWindow\.webContents\) return;\s*openRequests\.setReady\(ready === true\);/);
  // A page that reloads is not listening until it says so again.
  assert.match(main, /did-start-loading', \(\) => openRequests\.setReady\(false\)/);
});

test('the preload carries the same two channels, and sends back nothing but true or false', () => {
  assert.ok(preload.includes(`'${requests.OPEN_REQUEST_CHANNEL}'`), 'request channel');
  assert.ok(preload.includes(`'${requests.OPEN_REQUEST_READY_CHANNEL}'`), 'ready channel');
  assert.match(preload, /onOpenRequest:/);
  const block = /onOpenRequest: \(callback\) => \{([\s\S]*?)\n  \},/.exec(preload)[1];
  assert.doesNotMatch(block, /invoke\(/);
  const sends = [...block.matchAll(/ipcRenderer\.send\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(sends, ["'prune:open-request:ready', true", "'prune:open-request:ready', false"]);
});

test('the new main-process file is packed, so a packaged app does not fail to start', () => {
  assert.ok(config.files.includes('explorerRequests.cjs'), 'explorerRequests.cjs is not in files[]');
});
