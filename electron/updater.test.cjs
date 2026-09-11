const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater } = require('./updater.cjs');

/* The part of Prune that replaces itself.
 *
 * electron-updater does the downloading, the SHA-512 check and the
 * silent install. What is Prune's own, and what these tests hold still,
 * is everything around that: that nothing downloads or installs without
 * being asked, that only the version the user was shown gets installed,
 * and that a development build never tries to replace an installed copy.
 *
 * The updater is a fake with electron-updater's shape, so no network and
 * no installer is ever touched here. */

function fakeAutoUpdater({ offered = '2.5.0', available = true } = {}) {
  const updater = new EventEmitter();
  updater.autoDownload = true;          // electron-updater's own defaults,
  updater.autoInstallOnAppQuit = true;  // which Prune must turn off
  updater.checks = 0;
  updater.downloads = 0;
  updater.installs = [];
  updater.checkForUpdates = async () => {
    updater.checks += 1;
    return { isUpdateAvailable: available, updateInfo: { version: offered } };
  };
  updater.downloadUpdate = async () => {
    updater.downloads += 1;
    return ['C:\\fake\\Prune-Setup.exe'];
  };
  updater.quitAndInstall = (...args) => { updater.installs.push(args); };
  return updater;
}

const make = (over = {}) => {
  const autoUpdater = over.autoUpdater ?? fakeAutoUpdater();
  const sent = [];
  const updater = createUpdater({
    autoUpdater,
    isPackaged: over.isPackaged ?? true,
    send: (channel, value) => sent.push([channel, value])
  });
  return { updater, autoUpdater, sent };
};

test('turns off both of electron-updater\'s automatic behaviours', () => {
  // Out of the box it downloads the moment a check finds something and
  // installs whatever it downloaded when the app quits. Neither is
  // something anyone agreed to.
  const { autoUpdater } = make();
  assert.equal(autoUpdater.autoDownload, false);
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
});

test('downloads the version it was asked for, and says so', async () => {
  const { updater, autoUpdater } = make();
  assert.deepEqual(await updater.prepare('2.5.0'), { version: '2.5.0' });
  assert.equal(autoUpdater.checks, 1);
  assert.equal(autoUpdater.downloads, 1);
  assert.equal(updater.readyVersion(), '2.5.0');
});

test('refuses in a development build, before asking GitHub anything', async () => {
  // An unpackaged Electron has nothing to replace, and electron-updater
  // would quietly answer null. Saying why beats a button that does nothing.
  const { updater, autoUpdater } = make({ isPackaged: false });
  await assert.rejects(updater.prepare('2.5.0'), /installed app/);
  assert.equal(autoUpdater.checks, 0);
});

test('refuses anything that is not a plain version number', async () => {
  // The version arrives from the renderer, so it is checked here too.
  const { updater, autoUpdater } = make();
  for (const bad of ['2.5', 'v2.5.0', '2.5.0-beta', '../../x', '', null, undefined, 250]) {
    await assert.rejects(updater.prepare(bad), /not a version/, String(bad));
  }
  assert.equal(autoUpdater.checks, 0);
});

test('installs only the version the button showed, never a different one', async () => {
  // The button says "Update to 2.5.0". If a 2.5.1 was published since, the
  // user has not seen that one -- so nothing is downloaded, and the button
  // gets a check that is up to date next time.
  const { updater, autoUpdater } = make({ autoUpdater: fakeAutoUpdater({ offered: '2.5.1' }) });
  await assert.rejects(updater.prepare('2.5.0'), /2\.5\.1/);
  assert.equal(autoUpdater.downloads, 0);
  assert.equal(updater.readyVersion(), null);
});

test('refuses when GitHub offers nothing newer at all', async () => {
  const { updater, autoUpdater } = make({ autoUpdater: fakeAutoUpdater({ offered: '2.4.1', available: false }) });
  await assert.rejects(updater.prepare('2.5.0'), /nothing newer|2\.4\.1/);
  assert.equal(autoUpdater.downloads, 0);
});

test('downloads once, however many times the button is clicked', async () => {
  const { updater, autoUpdater } = make();
  await Promise.all([updater.prepare('2.5.0'), updater.prepare('2.5.0'), updater.prepare('2.5.0')]);
  assert.equal(autoUpdater.checks, 1);
  assert.equal(autoUpdater.downloads, 1);

  // And not again once it is on disk.
  await updater.prepare('2.5.0');
  assert.equal(autoUpdater.downloads, 1);
});

test('can try again after a download fails', async () => {
  const autoUpdater = fakeAutoUpdater();
  let fail = true;
  const download = autoUpdater.downloadUpdate;
  autoUpdater.downloadUpdate = async () => {
    if (fail) { fail = false; throw new Error('net::ERR_CONNECTION_RESET'); }
    return download();
  };
  const { updater } = make({ autoUpdater });

  await assert.rejects(updater.prepare('2.5.0'), /ERR_CONNECTION_RESET/);
  assert.equal(updater.readyVersion(), null);
  assert.deepEqual(await updater.prepare('2.5.0'), { version: '2.5.0' });
});

test('passes download progress on as a whole percentage', async () => {
  const { autoUpdater, sent } = make();
  autoUpdater.emit('download-progress', { percent: 41.7 });
  autoUpdater.emit('download-progress', { percent: 100 });
  assert.deepEqual(sent, [['progress', 42], ['progress', 100]]);
});

test('will not install something it has not downloaded', () => {
  const { updater, autoUpdater } = make();
  assert.throws(() => updater.install(), /no downloaded update/);
  assert.deepEqual(autoUpdater.installs, []);
});

test('installs silently and reopens Prune afterwards', async () => {
  // Silent: Prune installs per-user, so there is no admin prompt and no
  // wizard to click through a second time. Run after: the whole point of
  // one click is not having to find the app again.
  const { updater, autoUpdater } = make();
  await updater.prepare('2.5.0');
  updater.install();
  assert.deepEqual(autoUpdater.installs, [[true, true]]);
});

test('installs on quit only when told to, and only by an explicit true', () => {
  const { updater, autoUpdater } = make();
  updater.installOnQuit(true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  for (const notTrue of [false, 'true', 1, undefined]) {
    updater.installOnQuit(notTrue);
    assert.equal(autoUpdater.autoInstallOnAppQuit, false, String(notTrue));
  }
});
