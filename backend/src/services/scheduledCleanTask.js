import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { win32, dirname } from 'node:path';
import { isPruneExecutable } from './runAsAdmin.js';

const execFileAsync = promisify(execFile);

/** "Also run when Prune is closed": one Windows Task Scheduler task.
 *
 * A scheduled task that deletes files is persistence-like on its face, so
 * every property of this one is chosen to be the smallest, plainest, most
 * visible version of it:
 *
 *  - It exists only because the person switched it on in Settings, and goes the
 *    moment they switch it off, turn the schedule off or stop it cleaning.
 *    Nothing creates it as a side effect, and nothing else starts it.
 *  - It is one task, `\Prune\Scheduled clean`, for the CURRENT USER, "run only
 *    when logged on" (an interactive token: no password is asked for or
 *    stored) at the LIMITED run level: no elevation, ever.
 *  - It runs one thing: `prune-cli.cmd clean --preset recommended --report`
 *    from the folder the running Prune.exe is in -- the same command line
 *    anyone can run themselves. The path comes from process.execPath and
 *    nothing else; no request, setting or file can name another program.
 *  - Every call is an argv array to schtasks.exe / powershell.exe by full
 *    path, never a shell string. The task definition is an XML file Prune
 *    writes itself (and deletes at once), with every inserted value escaped.
 *  - The task's real state is read back from Task Scheduler for the switch;
 *    nothing is remembered in settings.json.
 *  - The installer's uninstaller deletes it too (electron/build/installer.nsh).
 *
 * Unpackaged builds (a checkout, a test), other platforms and a missing
 * prune-cli.cmd are refused before anything is executed. `exec`, `execPath`,
 * `platform`, `fileExists`, `writeFile`, `rm` and the clock are injectable; no
 * test creates a real task. */

export const TASK_FOLDER = 'Prune';
export const TASK_NAME = 'Scheduled clean';
/** The name schtasks.exe takes: folder, backslash, task. */
export const TASK_FULL_NAME = `${TASK_FOLDER}\\${TASK_NAME}`;
export const TASK_ARGUMENTS = 'clean --preset recommended --report';
export const CLI_WRAPPER = 'prune-cli.cmd';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---- the schedule, from the settings the in-app scheduler already uses ---- */

/** The schedule a task should follow: `{ frequency, hour, minute, weekday }`, or
 * null when the automation settings do not describe a cleaning schedule.
 *
 * It follows settings.automation and nothing else -- there is no second
 * schedule to set. Only a schedule that is on AND set to clean qualifies: a
 * "measure only" schedule must never become a task that deletes files. */
export function scheduleOf(automation) {
  if (!automation || automation.enabled !== true || automation.task !== 'clean') return null;
  const { frequency, hour, minute, weekday } = automation;
  if (frequency !== 'daily' && frequency !== 'weekly') return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (frequency === 'weekly' && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) return null;
  return { frequency, hour, minute, weekday: frequency === 'weekly' ? weekday : null };
}

const pad = (n) => String(n).padStart(2, '0');

/** What a registered task should contain for a schedule and an install folder.
 * Also what a task read back is compared with. */
export function expectedTask({ cliPath, schedule }) {
  return {
    execute: cliPath,
    arguments: TASK_ARGUMENTS,
    trigger: schedule.frequency === 'weekly' ? 'weekly' : 'daily',
    time: `${pad(schedule.hour)}:${pad(schedule.minute)}`,
    daysOfWeek: schedule.frequency === 'weekly' ? 1 << schedule.weekday : null
  };
}

/** Whether a task read back from Task Scheduler is the one these settings call
 * for: same program, same arguments, same trigger, time and day. */
export function isInSync(actual, expected) {
  if (!actual || !expected) return false;
  if (String(actual.execute ?? '').replace(/^"|"$/g, '').toLowerCase() !== expected.execute.toLowerCase()) return false;
  if (String(actual.arguments ?? '').trim() !== expected.arguments) return false;
  if (actual.trigger !== expected.trigger) return false;
  if (actual.time !== expected.time) return false;
  return (actual.daysOfWeek ?? null) === expected.daysOfWeek;
}

/* ---- the task definition ---- */

const xmlEscape = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** The task as XML. Everything inserted is escaped; nothing else varies. */
export function buildTaskXml({ cliPath, workingDirectory, user = null, schedule, now = new Date() }) {
  const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(schedule.hour)}:${pad(schedule.minute)}:00`;
  const recurrence = schedule.frequency === 'weekly'
    ? `<ScheduleByWeek><DaysOfWeek><${WEEKDAY_NAMES[schedule.weekday]} /></DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek>`
    : '<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>';
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>Prune</Author>
    <Description>Cleans the Prune "recommended" rules on a schedule, even when Prune is closed. Created from Prune's Settings; turn it off there or uninstall Prune to remove it.</Description>
    <URI>\\${xmlEscape(TASK_FULL_NAME)}</URI>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>${start}</StartBoundary>
      <Enabled>true</Enabled>
      ${recurrence}
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">${user ? `
      <UserId>${xmlEscape(user)}</UserId>` : ''}
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(cliPath)}</Command>
      <Arguments>${xmlEscape(TASK_ARGUMENTS)}</Arguments>
      <WorkingDirectory>${xmlEscape(workingDirectory)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

/** schtasks.exe reads an XML task file as UTF-16 with a byte-order mark. */
export const toUtf16File = (xml) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);

/* ---- reading the real state ---- */

/** Constant: no value is ever spliced into it (the task name and folder are
 * this file's own constants). No double quotes, so it crosses a command line
 * unchanged. Prints one line of JSON. */
export const READ_SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  `$t = Get-ScheduledTask -TaskPath '\\${TASK_FOLDER}\\' -TaskName '${TASK_NAME}'`,
  'if (-not $t) { [pscustomobject]@{ exists = $false } | ConvertTo-Json -Compress; return }',
  `$i = Get-ScheduledTaskInfo -TaskPath '\\${TASK_FOLDER}\\' -TaskName '${TASK_NAME}'`,
  '$a = @($t.Actions)[0]',
  '$g = @($t.Triggers)[0]',
  'function Ms($d) { if ($d -and $d.Year -gt 2000) { ([DateTimeOffset]$d).ToUnixTimeMilliseconds() } else { $null } }',
  '[pscustomobject]@{',
  '  exists = $true',
  '  state = [string]$t.State',
  '  execute = [string]$a.Execute',
  '  arguments = [string]$a.Arguments',
  '  trigger = if ($g) { [string]$g.CimClass.CimClassName } else { $null }',
  '  start = if ($g) { [string]$g.StartBoundary } else { $null }',
  '  days = if ($g -and $g.DaysOfWeek) { [int]$g.DaysOfWeek } else { $null }',
  '  next = Ms $i.NextRunTime',
  '  last = Ms $i.LastRunTime',
  '  result = [int64]$i.LastTaskResult',
  '} | ConvertTo-Json -Compress'
].join('\n');

/** The one line of JSON READ_SCRIPT printed, as the fields this service uses.
 * Anything unreadable is "no such task". */
export function parseTaskInfo(stdout) {
  let raw;
  try {
    raw = JSON.parse(String(stdout ?? '').trim().split(/\r?\n/).pop() || 'null');
  } catch {
    return { exists: false };
  }
  if (!raw || raw.exists !== true) return { exists: false };
  const trigger = /weekly/i.test(raw.trigger ?? '') ? 'weekly' : /daily/i.test(raw.trigger ?? '') ? 'daily' : 'other';
  const time = /T(\d{2}:\d{2})/.exec(String(raw.start ?? ''))?.[1] ?? null;
  const ms = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  return {
    exists: true,
    disabled: /disabled/i.test(String(raw.state ?? '')),
    execute: String(raw.execute ?? ''),
    arguments: String(raw.arguments ?? ''),
    trigger,
    time,
    daysOfWeek: Number.isInteger(raw.days) ? raw.days : null,
    nextRun: ms(raw.next),
    lastRun: ms(raw.last),
    lastTaskResult: Number.isFinite(Number(raw.result)) ? Number(raw.result) : null
  };
}

/* ---- the service ---- */

function defaultWorkDir() {
  const settings = process.env.UNREVO_SETTINGS_PATH;
  return settings ? dirname(settings) : tmpdir();
}

export function createScheduledCleanTask({
  exec = execFileAsync,
  execPath = process.execPath,
  platform = process.platform,
  systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows',
  fileExists = existsSync,
  write = writeFile,
  remove = rm,
  makeDir = mkdir,
  workDir = defaultWorkDir,
  user = (process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : null),
  now = () => new Date(),
  presenceTtlMs = 5 * 60_000
} = {}) {
  const schtasks = `${systemRoot}\\System32\\schtasks.exe`;
  const powershell = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
  const installDir = typeof execPath === 'string' ? win32.dirname(execPath) : '';
  const cliPath = win32.join(installDir, CLI_WRAPPER);

  /** Why a task cannot be offered here, or null if it can. Decided from the
   * running executable alone, before anything is executed. */
  function unsupportedReason() {
    if (platform !== 'win32') return 'platform';
    if (!isPruneExecutable(execPath, platform)) return 'unpackaged';
    if (!fileExists(cliPath)) return 'cli-missing';
    return null;
  }

  const run = (file, args, timeout = 30_000) => exec(file, args, { windowsHide: true, timeout });

  async function readTask() {
    const { stdout } = await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', READ_SCRIPT]);
    return parseTaskInfo(stdout);
  }

  // The in-app scheduler asks "is there a task?" every time a run falls due.
  // PowerShell is not free, so the answer is kept for a few minutes and thrown
  // away whenever this service changes the task.
  let presence = null;
  const forget = () => { presence = null; };

  async function delegates() {
    if (unsupportedReason()) return false;
    if (presence && Date.now() - presence.at < presenceTtlMs) return presence.value;
    let value = false;
    try {
      value = (await readTask()).exists === true;
    } catch {
      value = false;
    }
    presence = { value, at: Date.now() };
    return value;
  }

  async function status(schedule = null) {
    const reason = unsupportedReason();
    if (reason) {
      return { supported: false, reason, exists: false, inSync: null, nextRun: null, lastRun: null, lastTaskResult: null };
    }
    const info = await readTask();
    presence = { value: info.exists === true, at: Date.now() };
    if (!info.exists) {
      return { supported: true, reason: null, exists: false, inSync: null, nextRun: null, lastRun: null, lastTaskResult: null };
    }
    const inSync = schedule ? isInSync(info, expectedTask({ cliPath, schedule })) && !info.disabled : false;
    return {
      supported: true,
      reason: null,
      exists: true,
      inSync,
      nextRun: info.disabled ? null : info.nextRun,
      lastRun: info.lastRun,
      lastTaskResult: info.lastTaskResult
    };
  }

  async function create(schedule) {
    const reason = unsupportedReason();
    if (reason) throw Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true, reason });
    if (!schedule) throw Object.assign(new Error('Set the scheduled run to clean first.'), { needsSchedule: true });

    const dir = workDir();
    const file = win32.join(dir, 'prune-scheduled-clean-task.xml');
    const xml = buildTaskXml({ cliPath, workingDirectory: installDir, user, schedule, now: now() });
    await makeDir(dir, { recursive: true });
    await write(file, toUtf16File(xml));
    try {
      await run(schtasks, ['/Create', '/TN', TASK_FULL_NAME, '/XML', file, '/F']);
    } finally {
      await remove(file, { force: true }).catch(() => {});
      forget();
    }
  }

  async function deleteTask() {
    if (unsupportedReason()) return;
    try {
      await run(schtasks, ['/Delete', '/TN', TASK_FULL_NAME, '/F']);
    } catch (err) {
      // "There is no such task" is a success for a delete; anything else is
      // only an error if the task is still there afterwards.
      if ((await readTask()).exists) throw err;
    } finally {
      forget();
    }
  }

  // One change at a time: a quick on/off/on must not interleave schtasks calls.
  let queue = Promise.resolve();
  const serialised = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };

  return {
    supported: () => unsupportedReason() === null,
    status,
    delegates,
    /** Creates the task, or replaces it with one that follows `schedule`. */
    enable: (schedule) => serialised(async () => { await create(schedule); return status(schedule); }),
    /** Deletes the task. Safe to call when there is none, or where tasks are not supported. */
    disable: (schedule = null) => serialised(async () => { await deleteTask(); return status(schedule); }),
    /** Keeps an EXISTING task in line with the settings: gone when the schedule
     * no longer cleans, re-registered when the time, day or install folder
     * changed. Never creates one that was not there. */
    reconcile: (automation) => serialised(async () => {
      if (unsupportedReason()) return { action: 'none' };
      const schedule = scheduleOf(automation);
      const info = await readTask();
      presence = { value: info.exists === true, at: Date.now() };
      if (!info.exists) return { action: 'none' };
      if (!schedule) { await deleteTask(); return { action: 'removed' }; }
      if (isInSync(info, expectedTask({ cliPath, schedule })) && !info.disabled) return { action: 'none' };
      await create(schedule);
      return { action: 'updated' };
    })
  };
}

const service = createScheduledCleanTask();
export const scheduledCleanSupported = () => service.supported();
export const getScheduledCleanStatus = (schedule) => service.status(schedule);
export const enableScheduledClean = (schedule) => service.enable(schedule);
export const disableScheduledClean = (schedule) => service.disable(schedule);
export const reconcileScheduledClean = (automation) => service.reconcile(automation);
export const scheduledCleanDelegates = () => service.delegates();
