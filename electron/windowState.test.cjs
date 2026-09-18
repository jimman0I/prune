const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { resolveWindowState, loadWindowState, saveWindowState } = require('./windowState.cjs');

const DEFAULT_BOUNDS = { width: 1280, height: 860 };

// A real single-display layout: 0,0 to 1920,1080.
const ONE_DISPLAY = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];

test('resolveWindowState -- returns the default with isMaximized:false when nothing was saved', () => {
  const result = resolveWindowState({ saved: null, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.deepEqual(result, { ...DEFAULT_BOUNDS, x: undefined, y: undefined, isMaximized: false });
});

test('resolveWindowState -- returns the saved bounds when the saved position is still on a real display', () => {
  const saved = { width: 1000, height: 700, x: 100, y: 100, isMaximized: false };
  const result = resolveWindowState({ saved, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.deepEqual(result, saved);
});

test('resolveWindowState -- falls back to the default when the saved position is on no currently-connected display', () => {
  // A second monitor at x:1920+ that no longer exists -- ONE_DISPLAY only covers 0-1920.
  const saved = { width: 1000, height: 700, x: 2200, y: 100, isMaximized: false };
  const result = resolveWindowState({ saved, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.deepEqual(result, { ...DEFAULT_BOUNDS, x: undefined, y: undefined, isMaximized: false });
});

test('resolveWindowState -- preserves a real isMaximized:true', () => {
  const saved = { width: 1000, height: 700, x: 100, y: 100, isMaximized: true };
  const result = resolveWindowState({ saved, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
  assert.equal(result.isMaximized, true);
});

test('resolveWindowState -- treats a malformed saved value as absent', () => {
  for (const junk of [{}, { width: 'nope' }, { width: 1000, height: 700 }, 'not an object', null]) {
    const result = resolveWindowState({ saved: junk, displays: ONE_DISPLAY, defaultBounds: DEFAULT_BOUNDS });
    assert.deepEqual(result, { ...DEFAULT_BOUNDS, x: undefined, y: undefined, isMaximized: false });
  }
});

test('loadWindowState / saveWindowState -- round-trips through a real file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'prune-window-state-test-'));
  const filePath = path.join(dir, 'window-state.json');
  try {
    assert.equal(await loadWindowState(filePath), null); // nothing written yet

    const state = { width: 1400, height: 900, x: 50, y: 50, isMaximized: false };
    await saveWindowState(filePath, state);
    assert.deepEqual(await loadWindowState(filePath), state);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadWindowState -- tolerates a corrupt file, returns null rather than throwing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'prune-window-state-test-'));
  const filePath = path.join(dir, 'window-state.json');
  const { writeFile } = require('node:fs/promises');
  try {
    await writeFile(filePath, 'not valid json{{{');
    assert.equal(await loadWindowState(filePath), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
