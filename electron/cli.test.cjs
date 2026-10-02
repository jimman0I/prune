const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const config = require('./electron-builder.config.cjs');

/* The command line ships with the app.
 *
 * Prune.exe is a GUI-subsystem program and cannot print to a console, so the
 * CLI is a Node script (backend/src/cli.js, already shipped with the
 * backend) run through Prune.exe with ELECTRON_RUN_AS_NODE=1, and
 * `prune-cli.cmd` beside Prune.exe does that for the user -- the way VS
 * Code's `code` command works. These checks stop either half going missing
 * from the installer without a build noticing: nothing else fails if it does. */

const wrapperSource = path.join(__dirname, 'build', 'prune-cli.cmd');

test('the wrapper script exists', () => {
  assert.ok(existsSync(wrapperSource), 'electron/build/prune-cli.cmd is missing');
});

test('the wrapper runs Prune.exe as plain Node on the shipped cli.js, with the caller\'s arguments', () => {
  const cmd = readFileSync(wrapperSource, 'utf8');
  assert.match(cmd, /ELECTRON_RUN_AS_NODE=1/);
  assert.match(cmd, /"%~dp0Prune\.exe"/);
  assert.match(cmd, /resources\\backend\\src\\cli\.js/);
  assert.match(cmd, /%\*/);
  assert.match(cmd, /exit \/b %errorlevel%/i, 'the exit code must reach the caller');
});

test('the wrapper does not leak ELECTRON_RUN_AS_NODE to the caller\'s shell', () => {
  const cmd = readFileSync(wrapperSource, 'utf8');
  assert.match(cmd, /setlocal/i);
});

test('the installer puts the wrapper next to Prune.exe', () => {
  const extra = (config.extraFiles || []).find((entry) => entry.to === 'prune-cli.cmd');
  assert.ok(extra, 'extraFiles has no entry for prune-cli.cmd');
  assert.equal(extra.from, 'build/prune-cli.cmd');
});

test('the CLI script itself is part of the shipped backend (and not filtered out)', () => {
  const backend = config.extraResources.find((r) => r.to === 'backend/src');
  assert.ok(backend, 'backend/src is not shipped');
  // cli.js must pass every filter: it is not a test file, fakeVolume or testSupport.
  assert.ok(backend.filter.includes('**/*'));
  assert.ok(!backend.filter.some((f) => f !== '**/*' && !f.startsWith('!')));
  assert.ok(existsSync(path.join(__dirname, '..', 'backend', 'src', 'cli.js')));
  assert.ok(!/(\.test\.js|fakeVolume|testSupport)/.test('cli.js'));
});

test('the zip build gets the wrapper too, since extraFiles applies to every target', () => {
  assert.ok(config.win.target.some((t) => t.target === 'zip'));
});
