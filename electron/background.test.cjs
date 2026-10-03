const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

/* What Prune puts into Windows outside its own folder, and that taking Prune
 * away takes it too.
 *
 * "Also run when Prune is closed" registers a Task Scheduler task. Its name is
 * written in two places that cannot import each other -- the backend service
 * that creates it (ESM) and the NSIS uninstaller that deletes it -- so the
 * names are compared here. A task the uninstaller does not know by name would
 * be left behind pointing at a program that is gone. */

const nsh = readFileSync(path.join(__dirname, 'build', 'installer.nsh'), 'utf8');
const taskService = readFileSync(path.join(__dirname, '..', 'backend', 'src', 'services', 'scheduledCleanTask.js'), 'utf8');

function backendTaskName() {
  const folder = /export const TASK_FOLDER = '([^']+)'/.exec(taskService)?.[1];
  const name = /export const TASK_NAME = '([^']+)'/.exec(taskService)?.[1];
  assert.ok(folder && name, 'could not read the task name from scheduledCleanTask.js');
  return `${folder}\\${name}`;
}

/** The body of the uninstaller's customUnInstall macro. */
function unInstallMacro() {
  const match = /!macro customUnInstall\r?\n([\s\S]*?)!macroend/.exec(nsh);
  assert.ok(match, 'installer.nsh has no customUnInstall macro');
  return match[1];
}

test('the uninstaller deletes the scheduled-clean task, by the name the app registers', () => {
  const body = unInstallMacro();
  assert.ok(
    body.includes(`/Delete /TN "${backendTaskName()}" /F`),
    `customUnInstall does not delete "${backendTaskName()}"`
  );
  assert.match(body, /\$SYSDIR\\schtasks\.exe/, 'schtasks.exe must be run by its full system path');
});

test('the deletion cannot fail the uninstall: the exit code is read and dropped', () => {
  const body = unInstallMacro();
  assert.match(body, /nsExec::Exec[^\n]*\/Delete[^\n]*\r?\n\s*Pop \$0/);
  assert.doesNotMatch(body, /Abort|MessageBox/i);
});

test('an update keeps the task: it is removed only when the program is really being uninstalled', () => {
  const body = unInstallMacro();
  assert.match(body, /\$\{ifNot\} \$\{isUpdated\}/i);
  const guarded = /\$\{ifNot\} \$\{isUpdated\}([\s\S]*?)\$\{endIf\}/i.exec(body)[1];
  assert.match(guarded, /schtasks/);
});

test('the uninstaller removes the sign-in entry and Windows\' mark for it, by the name the app writes', () => {
  const startup = readFileSync(path.join(__dirname, '..', 'backend', 'src', 'services', 'startWithWindows.js'), 'utf8');
  const name = /export const VALUE_NAME = '([^']+)'/.exec(startup)?.[1];
  assert.ok(name, 'could not read VALUE_NAME from startWithWindows.js');
  const body = unInstallMacro();
  assert.ok(body.includes(`DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${name}"`));
  assert.ok(body.includes(`DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run" "${name}"`));
  // Only the one value: never the key itself, which every program shares.
  assert.doesNotMatch(body, /DeleteRegKey/);
});

test('the sign-in entry is also kept across an update, like the task', () => {
  const guarded = /\$\{ifNot\} \$\{isUpdated\}([\s\S]*?)\$\{endIf\}/i.exec(unInstallMacro())[1];
  assert.match(guarded, /DeleteRegValue/);
});

test('main.cjs, the tray manager and the pure module agree on the tray-ready event', () => {
  const { TRAY_READY_EVENT } = require('./startMinimized.cjs');
  const tray = readFileSync(path.join(__dirname, '..', 'backend', 'src', 'lib', 'trayManager.js'), 'utf8');
  assert.ok(tray.includes(`app.emit?.('${TRAY_READY_EVENT}')`), 'trayManager.js must announce the event main.cjs waits for');
});

test('main.cjs takes the single-instance lock and shows the running window for a second launch', () => {
  const main = readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /requestSingleInstanceLock\(\)/);
  assert.match(main, /app\.on\('second-instance'/);
  assert.match(main, /shouldRevealForSecondInstance\(argv\)/);
  // The elevated relaunch must wait for the old instance BEFORE asking for the lock.
  assert.ok(main.indexOf('waitForParentExit(relaunchedFrom)') < main.indexOf('requestSingleInstanceLock()'));
});

test('main.cjs creates a --start-minimized window hidden, so nothing flashes', () => {
  const main = readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.match(main, /show: startMode === 'normal'/);
});

test('the macro is built into the uninstaller', () => {
  const start = nsh.indexOf('!macro customUnInstall');
  const before = nsh.slice(0, start);
  const opens = [...before.matchAll(/^!ifdef BUILD_UNINSTALLER/gm)].length;
  const closes = [...before.matchAll(/^!endif/gm)].length;
  const ifndefOpens = [...before.matchAll(/^!ifndef BUILD_UNINSTALLER/gm)].length;
  assert.equal(opens + ifndefOpens - closes, 1, 'customUnInstall must sit inside exactly one open !ifdef BUILD_UNINSTALLER');
  assert.ok(opens >= 1);
});
