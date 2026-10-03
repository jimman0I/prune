const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./electron-builder.config.cjs');

/* "Always run as administrator" is an opt-in flag in the user's own registry,
 * written by the backend (backend/src/services/runAsAdmin.js). What is held
 * still here is what it must NOT do to the build: the installer and the
 * manifest stay as they were, so nobody who never turns the switch on is ever
 * asked to elevate, and the installer neither sets nor clears the flag. */

const read = (...parts) => fs.readFileSync(path.join(__dirname, ...parts), 'utf8');

test('the manifest still asks for the ordinary execution level', () => {
  assert.equal(config.win.requestedExecutionLevel, undefined, 'win.requestedExecutionLevel was set');
  assert.equal(config.nsis.perMachine, undefined);
  assert.equal(JSON.stringify(config).includes('requireAdministrator'), false);
  assert.equal(JSON.stringify(config).includes('highestAvailable'), false);
});

test('the installer does not touch the compatibility flags', () => {
  const script = read('build', 'installer.nsh');
  assert.equal(/AppCompatFlags|RUNASADMIN/i.test(script), false);
});

test('only the backend writes the flag -- not the main process, its helpers or the preload', () => {
  for (const file of fs.readdirSync(__dirname).filter((f) => /\.cjs$/.test(f) && !/\.test\.cjs$/.test(f))) {
    const source = read(file);
    assert.equal(/AppCompatFlags|RUNASADMIN/.test(source), false, `${file} mentions the compatibility flag`);
  }
});
