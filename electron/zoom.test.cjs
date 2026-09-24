const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zoomActionForInput, applyZoomAction, resolveSavedZoom, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } = require('./zoom.cjs');

const key = (k, extra = {}) => ({ type: 'keyDown', key: k, control: true, meta: false, alt: false, shift: false, isAutoRepeat: false, ...extra });

test('zoomActionForInput -- Ctrl+= and Ctrl++ zoom in, including the shifted and numpad forms', () => {
  assert.equal(zoomActionForInput(key('=')), 'in');
  assert.equal(zoomActionForInput(key('+', { shift: true })), 'in');
  assert.equal(zoomActionForInput(key('+')), 'in'); // numpad plus
});

test('zoomActionForInput -- Ctrl+- zooms out and Ctrl+0 resets', () => {
  assert.equal(zoomActionForInput(key('-')), 'out');
  assert.equal(zoomActionForInput(key('0')), 'reset');
});

test('zoomActionForInput -- a key auto-repeat still steps, so holding the key keeps zooming', () => {
  assert.equal(zoomActionForInput(key('=', { isAutoRepeat: true })), 'in');
});

test('zoomActionForInput -- ignores everything that is not exactly a zoom chord', () => {
  assert.equal(zoomActionForInput(key('=', { control: false })), null, 'no Ctrl');
  assert.equal(zoomActionForInput(key('-', { alt: true })), null, 'Alt held');
  assert.equal(zoomActionForInput(key('-', { meta: true })), null, 'Cmd/Win held');
  assert.equal(zoomActionForInput(key('a')), null);
  assert.equal(zoomActionForInput(key('k')), null, 'the app\'s own Ctrl+K must pass through');
  assert.equal(zoomActionForInput(key('=', { type: 'keyUp' })), null, 'only the press, not the release');
  assert.equal(zoomActionForInput(null), null);
  assert.equal(zoomActionForInput({}), null);
});

test('applyZoomAction -- steps by ZOOM_STEP and resets to 0', () => {
  assert.equal(applyZoomAction(0, 'in'), ZOOM_STEP);
  assert.equal(applyZoomAction(0, 'out'), -ZOOM_STEP);
  assert.equal(applyZoomAction(2, 'reset'), 0);
  assert.equal(applyZoomAction(1, 'nonsense'), 1);
});

test('applyZoomAction -- clamps to the range so text can never be lost to a runaway zoom', () => {
  assert.equal(applyZoomAction(ZOOM_MAX, 'in'), ZOOM_MAX);
  assert.equal(applyZoomAction(ZOOM_MIN, 'out'), ZOOM_MIN);
  let level = 0;
  for (let i = 0; i < 100; i++) level = applyZoomAction(level, 'in');
  assert.equal(level, ZOOM_MAX);
  for (let i = 0; i < 100; i++) level = applyZoomAction(level, 'out');
  assert.equal(level, ZOOM_MIN);
});

test('applyZoomAction -- an unclamped level from elsewhere is pulled back into range', () => {
  assert.equal(applyZoomAction(99, 'out'), ZOOM_MAX);
  assert.equal(applyZoomAction(-99, 'in'), ZOOM_MIN);
});

test('range -- includes 100% and is wide enough to matter but narrow enough to keep the layout', () => {
  assert.ok(ZOOM_MIN < 0 && ZOOM_MAX > 0);
  assert.ok(ZOOM_MAX >= 2, 'at least two steps up: the whole point is enlarging 9px text');
  assert.ok(ZOOM_MAX <= 4 && ZOOM_MIN >= -3);
});

test('resolveSavedZoom -- returns a valid saved level, snapped and clamped', () => {
  assert.equal(resolveSavedZoom({ zoomLevel: 1 }), 1);
  assert.equal(resolveSavedZoom({ zoomLevel: 99 }), ZOOM_MAX);
  assert.equal(resolveSavedZoom({ zoomLevel: -99 }), ZOOM_MIN);
});

test('resolveSavedZoom -- anything unusable means 100%, never a crash or NaN zoom', () => {
  for (const bad of [null, undefined, {}, { zoomLevel: 'big' }, { zoomLevel: NaN }, { zoomLevel: Infinity }, 'x', 4]) {
    assert.equal(resolveSavedZoom(bad), 0);
  }
});

test('main.cjs wiring -- routes keys and Ctrl+wheel through zoom.cjs and persists the level', () => {
  // main.cjs needs a running Electron to import, so this reads the source:
  // it can only catch the wiring being removed, not prove it works.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'main.cjs'), 'utf8');
  assert.match(src, /require\('\.\/zoom\.cjs'\)/);
  assert.match(src, /wc\.on\('before-input-event'/);
  assert.match(src, /wc\.on\('zoom-changed'/);
  assert.match(src, /event\.preventDefault\(\)/);
  assert.match(src, /zoomLevel \}\);/, 'the saved window state carries the zoom level');
  assert.match(src, /resolveSavedZoom\(saved\)/);
});
