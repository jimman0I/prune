const test = require('node:test');
const assert = require('node:assert/strict');
const { pickPaths, dialogOptionsFor } = require('./pathPicker.cjs');

/** The file/folder chooser behind "Shred files...". The renderer asks for a
 * KIND of thing to pick and gets back plain path strings; it cannot choose
 * the dialog's title, filters or default folder, so the one piece of main-
 * process UI it can open stays a plain "choose files" box. */

test('files: a multi-select file chooser', () => {
  const options = dialogOptionsFor('files');
  assert.deepEqual(options.properties, ['openFile', 'multiSelections']);
});

test('folders: a multi-select folder chooser', () => {
  const options = dialogOptionsFor('folders');
  assert.deepEqual(options.properties, ['openDirectory', 'multiSelections']);
});

test('anything else is refused rather than guessed at', () => {
  for (const kind of ['', 'both', 'all', undefined, null, 5, { properties: ['openFile'] }]) {
    assert.equal(dialogOptionsFor(kind), null);
  }
});

test('returns the chosen paths', async () => {
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: ['C:\\a.txt', 'C:\\b'] }) };
  assert.deepEqual(await pickPaths({ dialog, win: {}, kind: 'files' }), ['C:\\a.txt', 'C:\\b']);
});

test('a cancelled chooser is an empty list, not an error', async () => {
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  assert.deepEqual(await pickPaths({ dialog, win: {}, kind: 'folders' }), []);
});

test('only strings come back, whatever the dialog says', async () => {
  const dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: ['C:\\ok', 7, null, '', 'D:\\also'] }) };
  assert.deepEqual(await pickPaths({ dialog, win: {}, kind: 'files' }), ['C:\\ok', 'D:\\also']);
});

test('an unknown kind never opens a dialog', async () => {
  let opened = false;
  const dialog = { showOpenDialog: async () => { opened = true; return { canceled: true, filePaths: [] }; } };
  assert.deepEqual(await pickPaths({ dialog, win: {}, kind: 'weird' }), []);
  assert.equal(opened, false);
});

test('the dialog is parented to the window that asked', async () => {
  let parent;
  const dialog = { showOpenDialog: async (win) => { parent = win; return { canceled: true, filePaths: [] }; } };
  const win = { id: 7 };
  await pickPaths({ dialog, win, kind: 'files' });
  assert.equal(parent, win);
});
