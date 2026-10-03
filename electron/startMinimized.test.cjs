const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  START_MINIMIZED_FLAG, parseStartMinimized, decideStartMode, readMinimizeToTray, settleHiddenStart, revealSteps, shouldRevealForSecondInstance
} = require('./startMinimized.cjs');

/* "Start Prune when I sign in to Windows", minimised.
 *
 * The Run key starts Prune.exe with --start-minimized. Everything that decides
 * what the window then does is a pure function here, so it can be tested
 * without Electron: whether the flag was given, where the window goes (the
 * tray, or the taskbar when the tray cannot be relied on), and what a second
 * launch does. The rule under all of it: never lose the window. */

test('the flag is exactly --start-minimized', () => {
  assert.equal(START_MINIMIZED_FLAG, '--start-minimized');
});

test('parseStartMinimized: only the exact flag counts', () => {
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe', '--start-minimized']), true);
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe', '--other', '--start-minimized']), true);
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe']), false);
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe', '--start-minimized=1']), false);
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe', '--start-minimized-now']), false);
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe', '--START-MINIMIZED']), false);
  assert.equal(parseStartMinimized(['C:\\Prune\\Prune.exe', 'start-minimized']), false);
});

test('parseStartMinimized: the program name is never read as a flag, and bad input is false', () => {
  assert.equal(parseStartMinimized(['--start-minimized']), false);
  assert.equal(parseStartMinimized([]), false);
  assert.equal(parseStartMinimized(undefined), false);
  assert.equal(parseStartMinimized(null), false);
  assert.equal(parseStartMinimized('--start-minimized'), false);
  assert.equal(parseStartMinimized(['exe', 42, null, {}]), false);
});

test('decideStartMode: a normal launch shows the window, whatever the tray setting is', () => {
  assert.equal(decideStartMode({ startMinimized: false, minimizeToTray: true }), 'normal');
  assert.equal(decideStartMode({ startMinimized: false, minimizeToTray: false }), 'normal');
  assert.equal(decideStartMode({}), 'normal');
  assert.equal(decideStartMode(), 'normal');
});

test('decideStartMode: a minimised start goes to the tray only when the tray setting is on', () => {
  assert.equal(decideStartMode({ startMinimized: true, minimizeToTray: true }), 'tray');
  assert.equal(decideStartMode({ startMinimized: true, minimizeToTray: false }), 'taskbar');
  assert.equal(decideStartMode({ startMinimized: true }), 'taskbar');
  assert.equal(decideStartMode({ startMinimized: true, minimizeToTray: 'yes' }), 'taskbar');
  assert.equal(decideStartMode({ startMinimized: 'true', minimizeToTray: true }), 'normal');
});

test('readMinimizeToTray: true only for an explicit true in the settings file', () => {
  const read = (text) => () => text;
  assert.equal(readMinimizeToTray('C:\\s.json', read(JSON.stringify({ minimizeToTray: true }))), true);
  assert.equal(readMinimizeToTray('C:\\s.json', read(JSON.stringify({ minimizeToTray: false }))), false);
  assert.equal(readMinimizeToTray('C:\\s.json', read(JSON.stringify({}))), false);
  assert.equal(readMinimizeToTray('C:\\s.json', read(JSON.stringify({ minimizeToTray: 'true' }))), false);
  assert.equal(readMinimizeToTray('C:\\s.json', read('not json')), false);
  assert.equal(readMinimizeToTray('C:\\s.json', read('null')), false);
  assert.equal(readMinimizeToTray('C:\\s.json', () => { throw new Error('ENOENT'); }), false);
  assert.equal(readMinimizeToTray(null, () => { throw new Error('must not be read'); }), false);
});

test('settleHiddenStart: a window meant for the tray stays hidden only if the tray is really there', async () => {
  assert.equal(await settleHiddenStart({ mode: 'tray', trayReady: () => true, waitForTray: async () => true }), 'tray');
  assert.equal(await settleHiddenStart({ mode: 'tray', trayReady: () => false, waitForTray: async () => true }), 'tray');
});

test('settleHiddenStart: no tray in time means the taskbar, never a lost window', async () => {
  assert.equal(await settleHiddenStart({ mode: 'tray', trayReady: () => false, waitForTray: async () => false }), 'taskbar');
  assert.equal(await settleHiddenStart({ mode: 'tray', trayReady: () => false, waitForTray: async () => { throw new Error('x'); } }), 'taskbar');
});

test('settleHiddenStart: the other modes are already settled, and the tray is not even asked', async () => {
  const forbidden = async () => { throw new Error('must not wait'); };
  assert.equal(await settleHiddenStart({ mode: 'normal', trayReady: () => false, waitForTray: forbidden }), 'normal');
  assert.equal(await settleHiddenStart({ mode: 'taskbar', trayReady: () => false, waitForTray: forbidden }), 'taskbar');
});

test('revealSteps: bring a window back in the right order', () => {
  assert.deepEqual(revealSteps({ isMinimized: true, isVisible: true }), ['restore', 'show', 'focus']);
  assert.deepEqual(revealSteps({ isMinimized: false, isVisible: false }), ['show', 'focus']);
  assert.deepEqual(revealSteps({ isMinimized: false, isVisible: true }), ['show', 'focus']);
  assert.deepEqual(revealSteps({ isMinimized: true, isVisible: false }), ['restore', 'show', 'focus']);
});

test('shouldRevealForSecondInstance: a normal second launch shows the window, a second silent start does not', () => {
  assert.equal(shouldRevealForSecondInstance(['C:\\Prune\\Prune.exe']), true);
  assert.equal(shouldRevealForSecondInstance(['C:\\Prune\\Prune.exe', '--start-minimized']), false);
  assert.equal(shouldRevealForSecondInstance(undefined), true);
});
