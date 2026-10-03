import { describe, it, expect, vi } from 'vitest';
import {
  TASK_FULL_NAME, TASK_ARGUMENTS, CLI_WRAPPER, READ_SCRIPT,
  scheduleOf, expectedTask, isInSync, buildTaskXml, toUtf16File, parseTaskInfo, createScheduledCleanTask
} from './scheduledCleanTask.js';

/** "Also run when Prune is closed" is one Windows scheduled task, so what is
 * held still here is its safety, not just its plumbing: it is created only on
 * request, for the current user at the limited run level with no stored
 * password, runs only Prune's own prune-cli.cmd with a fixed command line,
 * follows the schedule that already exists, goes away when it should, and is
 * never touched in a development build. Nothing here creates a real task:
 * every test hands the service a fake Task Scheduler. */

const EXE = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe';
const CLI = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\prune-cli.cmd';
const DAILY = { enabled: true, task: 'clean', frequency: 'daily', hour: 2, minute: 5, weekday: 0 };
const WEEKLY = { enabled: true, task: 'clean', frequency: 'weekly', hour: 23, minute: 30, weekday: 3 };

describe('scheduleOf: the schedule the task follows', () => {
  it('reads the existing automation settings, nothing else', () => {
    expect(scheduleOf(DAILY)).toEqual({ frequency: 'daily', hour: 2, minute: 5, weekday: null });
    expect(scheduleOf(WEEKLY)).toEqual({ frequency: 'weekly', hour: 23, minute: 30, weekday: 3 });
  });

  it('is nothing unless the schedule is on AND set to clean', () => {
    expect(scheduleOf({ ...DAILY, enabled: false })).toBeNull();
    expect(scheduleOf({ ...DAILY, enabled: 'yes' })).toBeNull();
    expect(scheduleOf({ ...DAILY, task: 'scan' })).toBeNull();
    expect(scheduleOf(null)).toBeNull();
    expect(scheduleOf(undefined)).toBeNull();
  });

  it('is nothing for a schedule the in-app one would refuse too', () => {
    expect(scheduleOf({ ...DAILY, frequency: 'hourly' })).toBeNull();
    expect(scheduleOf({ ...DAILY, hour: 24 })).toBeNull();
    expect(scheduleOf({ ...DAILY, minute: -1 })).toBeNull();
    expect(scheduleOf({ ...DAILY, hour: 1.5 })).toBeNull();
    expect(scheduleOf({ ...WEEKLY, weekday: 7 })).toBeNull();
    expect(scheduleOf({ ...WEEKLY, weekday: undefined })).toBeNull();
  });
});

describe('buildTaskXml', () => {
  const NOW = new Date(2026, 9, 3, 12, 0, 0);
  const build = (schedule, over = {}) => buildTaskXml({
    cliPath: CLI, workingDirectory: 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune', user: 'PC\\me', schedule: scheduleOf(schedule), now: NOW, ...over
  });

  it('runs prune-cli.cmd with the fixed arguments, from its own folder', () => {
    const xml = build(DAILY);
    expect(xml).toContain(`<Command>${CLI}</Command>`);
    expect(xml).toContain('<Arguments>clean --preset recommended --report</Arguments>');
    expect(xml).toContain('<WorkingDirectory>C:\\Users\\me\\AppData\\Local\\Programs\\Prune</WorkingDirectory>');
    expect(TASK_ARGUMENTS).toBe('clean --preset recommended --report');
    expect(xml.match(/<Exec>/g)).toHaveLength(1);
  });

  it('is a current-user, logged-on-only, limited task with no stored password', () => {
    const xml = build(DAILY);
    expect(xml).toContain('<UserId>PC\\me</UserId>');
    expect(xml).toContain('<LogonType>InteractiveToken</LogonType>');
    expect(xml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
    expect(xml).not.toMatch(/HighestAvailable|S4U|Password|ServiceAccount/i);
    expect(xml).not.toContain('<WakeToRun>true');
  });

  it('leaves the user out, for Windows to fill in, when none is known', () => {
    expect(build(DAILY, { user: null })).not.toContain('<UserId>');
  });

  it('daily: every day at the chosen time, starting today so the first run is the next one', () => {
    const xml = build(DAILY);
    expect(xml).toContain('<StartBoundary>2026-10-03T02:05:00</StartBoundary>');
    expect(xml).toContain('<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>');
    expect(xml).not.toContain('ScheduleByWeek');
  });

  it('weekly: the chosen weekday, every week', () => {
    const xml = build(WEEKLY);
    expect(xml).toContain('<StartBoundary>2026-10-03T23:30:00</StartBoundary>');
    expect(xml).toContain('<ScheduleByWeek><DaysOfWeek><Wednesday /></DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek>');
  });

  it('catches up a run that was missed while the PC was off, but does not wake it', () => {
    const xml = build(DAILY);
    expect(xml).toContain('<StartWhenAvailable>true</StartWhenAvailable>');
    expect(xml).toContain('<WakeToRun>false</WakeToRun>');
    expect(xml).toContain('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>');
    expect(xml).toContain('<ExecutionTimeLimit>PT2H</ExecutionTimeLimit>');
  });

  it('escapes everything it inserts, so an odd path or name cannot add markup', () => {
    const xml = build(DAILY, { cliPath: 'C:\\A&B <x>\\prune-cli.cmd', user: 'D\\O\'Brien "x"' });
    expect(xml).toContain('<Command>C:\\A&amp;B &lt;x&gt;\\prune-cli.cmd</Command>');
    expect(xml).toContain('<UserId>D\\O&apos;Brien &quot;x&quot;</UserId>');
  });

  it('is saved for schtasks.exe as UTF-16 with a byte-order mark', () => {
    const file = toUtf16File('<a>é</a>');
    expect([...file.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    expect(file.subarray(2).toString('utf16le')).toBe('<a>é</a>');
    expect(buildTaskXml({ cliPath: CLI, workingDirectory: 'C:\\x', schedule: scheduleOf(DAILY) })).toContain('encoding="UTF-16"');
  });
});

describe('parseTaskInfo', () => {
  it('reads the line PowerShell prints', () => {
    const info = parseTaskInfo(JSON.stringify({
      exists: true, state: 'Ready', execute: CLI, arguments: TASK_ARGUMENTS, trigger: 'MSFT_TaskWeeklyTrigger',
      start: '2026-10-03T23:30:00', days: 8, next: 1790000000000, last: 1789000000000, result: 267011
    }) + '\r\n');
    expect(info).toEqual({
      exists: true, disabled: false, execute: CLI, arguments: TASK_ARGUMENTS, trigger: 'weekly', time: '23:30',
      daysOfWeek: 8, nextRun: 1790000000000, lastRun: 1789000000000, lastTaskResult: 267011
    });
  });

  it('reads "never run" and "disabled"', () => {
    const info = parseTaskInfo(JSON.stringify({ exists: true, state: 'Disabled', trigger: 'MSFT_TaskDailyTrigger', start: '2026-01-01T02:00:00', next: null, last: null, result: 0 }));
    expect(info).toMatchObject({ disabled: true, trigger: 'daily', time: '02:00', nextRun: null, lastRun: null, daysOfWeek: null });
  });

  it('treats no task, empty output and garbage as no task', () => {
    expect(parseTaskInfo('{"exists":false}')).toEqual({ exists: false });
    expect(parseTaskInfo('')).toEqual({ exists: false });
    expect(parseTaskInfo(undefined)).toEqual({ exists: false });
    expect(parseTaskInfo('not json')).toEqual({ exists: false });
    expect(parseTaskInfo('null')).toEqual({ exists: false });
  });
});

describe('the read script', () => {
  it('is fixed text with no double quotes, so no value can be spliced into it', () => {
    expect(READ_SCRIPT).not.toContain('"');
    expect(READ_SCRIPT).not.toContain('${');
    expect(READ_SCRIPT).toContain("-TaskPath '\\Prune\\' -TaskName 'Scheduled clean'");
  });
});

describe('isInSync', () => {
  const schedule = scheduleOf(WEEKLY);
  const expected = expectedTask({ cliPath: CLI, schedule });
  const actual = { execute: CLI, arguments: TASK_ARGUMENTS, trigger: 'weekly', time: '23:30', daysOfWeek: 8 };

  it('is true for the task these settings produce', () => {
    expect(expected).toEqual({ execute: CLI, arguments: TASK_ARGUMENTS, trigger: 'weekly', time: '23:30', daysOfWeek: 8 });
    expect(isInSync(actual, expected)).toBe(true);
    expect(isInSync({ ...actual, execute: CLI.toUpperCase() }, expected)).toBe(true);
    expect(isInSync({ ...actual, execute: `"${CLI}"` }, expected)).toBe(true);
  });

  it('is false when anything differs: program, arguments, trigger, time, day', () => {
    expect(isInSync({ ...actual, execute: 'C:\\Other\\prune-cli.cmd' }, expected)).toBe(false);
    expect(isInSync({ ...actual, arguments: `${TASK_ARGUMENTS} --delete-now` }, expected)).toBe(false);
    expect(isInSync({ ...actual, trigger: 'daily' }, expected)).toBe(false);
    expect(isInSync({ ...actual, time: '23:31' }, expected)).toBe(false);
    expect(isInSync({ ...actual, daysOfWeek: 2 }, expected)).toBe(false);
    expect(isInSync(null, expected)).toBe(false);
  });
});

/** A fake Task Scheduler behind a fake schtasks.exe / powershell.exe. It keeps
 * the XML it was given and answers the read the way the real script would. */
function fakeScheduler({ exists = null, failCreate = false, failDelete = false } = {}) {
  const state = { xml: exists, calls: [], files: new Map(), removed: [] };
  const answer = () => {
    if (!state.xml) return JSON.stringify({ exists: false });
    const x = state.xml;
    const pick = (re) => re.exec(x)?.[1] ?? null;
    const weekly = x.includes('<ScheduleByWeek>');
    const dayName = pick(/<DaysOfWeek><(\w+) \/>/);
    const bit = dayName ? 1 << ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName) : null;
    return JSON.stringify({
      exists: true, state: 'Ready', execute: pick(/<Command>(.*?)<\/Command>/), arguments: pick(/<Arguments>(.*?)<\/Arguments>/),
      trigger: weekly ? 'MSFT_TaskWeeklyTrigger' : 'MSFT_TaskDailyTrigger', start: pick(/<StartBoundary>(.*?)<\/StartBoundary>/),
      days: bit, next: 1790000000000, last: null, result: 267011
    });
  };
  const exec = vi.fn(async (file, args, options) => {
    state.calls.push({ file, args, options });
    if (/schtasks\.exe$/i.test(file) && args[0] === '/Create') {
      if (failCreate) throw Object.assign(new Error('ERROR: Access is denied.'), { code: 1 });
      state.xml = state.files.get(args[args.indexOf('/XML') + 1]);
      return { stdout: 'SUCCESS', stderr: '' };
    }
    if (/schtasks\.exe$/i.test(file) && args[0] === '/Delete') {
      if (failDelete) throw Object.assign(new Error('ERROR: Access is denied.'), { code: 1 });
      if (!state.xml) throw Object.assign(new Error('ERROR: The system cannot find the file specified.'), { code: 1 });
      state.xml = null;
      return { stdout: 'SUCCESS', stderr: '' };
    }
    if (/powershell\.exe$/i.test(file)) return { stdout: `${answer()}\r\n`, stderr: '' };
    throw new Error(`unexpected command ${file}`);
  });
  const write = vi.fn(async (path, buffer) => { state.files.set(path, Buffer.from(buffer).subarray(2).toString('utf16le')); });
  const remove = vi.fn(async (path) => { state.removed.push(path); state.files.delete(path); });
  return { state, exec, write, remove, creates: () => state.calls.filter((c) => c.args[0] === '/Create'), deletes: () => state.calls.filter((c) => c.args[0] === '/Delete') };
}

const make = (scheduler, over = {}) => createScheduledCleanTask({
  exec: scheduler.exec, execPath: EXE, platform: 'win32', systemRoot: 'C:\\Windows',
  fileExists: () => true, write: scheduler.write, remove: scheduler.remove, makeDir: async () => {},
  workDir: () => 'C:\\Users\\me\\AppData\\Roaming\\Prune', user: 'PC\\me', now: () => new Date(2026, 9, 3, 12, 0, 0), ...over
});

describe('where it is offered', () => {
  it('is unsupported, and runs nothing at all, in a development build', async () => {
    for (const [over, reason] of [
      [{ execPath: 'C:\\dev\\prune\\electron\\node_modules\\electron\\dist\\electron.exe' }, 'unpackaged'],
      [{ execPath: 'C:\\Program Files\\nodejs\\node.exe' }, 'unpackaged'],
      [{ execPath: 'C:\\x\\NotPrune.exe' }, 'unpackaged'],
      [{ platform: 'linux' }, 'platform'],
      [{ platform: 'darwin' }, 'platform']
    ]) {
      const scheduler = fakeScheduler({ exists: '<x/>' });
      const service = make(scheduler, over);
      expect(await service.status(null)).toMatchObject({ supported: false, reason, exists: false });
      await expect(service.enable(scheduleOf(DAILY))).rejects.toMatchObject({ unsupported: true });
      expect(await service.disable()).toMatchObject({ supported: false });
      expect(await service.reconcile({ ...DAILY, enabled: false })).toEqual({ action: 'none' });
      expect(await service.delegates()).toBe(false);
      expect(scheduler.exec).not.toHaveBeenCalled();
      expect(scheduler.write).not.toHaveBeenCalled();
    }
  });

  it('is unsupported when prune-cli.cmd is not beside Prune.exe', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler, { fileExists: () => false });
    expect(await service.status(null)).toMatchObject({ supported: false, reason: 'cli-missing' });
    await expect(service.enable(scheduleOf(DAILY))).rejects.toMatchObject({ unsupported: true, reason: 'cli-missing' });
    expect(scheduler.exec).not.toHaveBeenCalled();
  });

  it('looks for the launcher in the running exe\'s own folder, and only there', async () => {
    const asked = [];
    const scheduler = fakeScheduler();
    await make(scheduler, { fileExists: (p) => { asked.push(p); return true; } }).status(null);
    expect(asked).toEqual([CLI]);
    expect(CLI.endsWith(CLI_WRAPPER)).toBe(true);
  });
});

describe('enable', () => {
  it('registers one per-user task from an XML file, by schtasks.exe with an argv array', async () => {
    const scheduler = fakeScheduler();
    const status = await make(scheduler).enable(scheduleOf(WEEKLY));
    const [create] = scheduler.creates();
    expect(create.file).toBe('C:\\Windows\\System32\\schtasks.exe');
    expect(create.args).toEqual(['/Create', '/TN', TASK_FULL_NAME, '/XML', 'C:\\Users\\me\\AppData\\Roaming\\Prune\\prune-scheduled-clean-task.xml', '/F']);
    expect(TASK_FULL_NAME).toBe('Prune\\Scheduled clean');
    expect(Array.isArray(create.args)).toBe(true);
    expect(create.options.shell).toBeUndefined();
    expect(status).toMatchObject({ supported: true, exists: true, inSync: true, nextRun: 1790000000000 });
  });

  it('writes a task for this exe\'s own prune-cli.cmd and nothing else', async () => {
    const scheduler = fakeScheduler();
    await make(scheduler).enable(scheduleOf(DAILY));
    expect(scheduler.state.xml).toContain(`<Command>${CLI}</Command>`);
    expect(scheduler.state.xml).toContain('<Arguments>clean --preset recommended --report</Arguments>');
    expect(scheduler.state.xml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
  });

  it('deletes its temporary XML file afterwards, success or failure', async () => {
    const ok = fakeScheduler();
    await make(ok).enable(scheduleOf(DAILY));
    expect(ok.state.removed).toHaveLength(1);
    expect(ok.state.files.size).toBe(0);

    const bad = fakeScheduler({ failCreate: true });
    await expect(make(bad).enable(scheduleOf(DAILY))).rejects.toThrow(/Access is denied/);
    expect(bad.state.removed).toHaveLength(1);
    expect(bad.state.xml).toBeNull();
  });

  it('refuses without a cleaning schedule, and creates nothing', async () => {
    const scheduler = fakeScheduler();
    await expect(make(scheduler).enable(scheduleOf({ ...DAILY, task: 'scan' }))).rejects.toMatchObject({ needsSchedule: true });
    await expect(make(scheduler).enable(null)).rejects.toMatchObject({ needsSchedule: true });
    expect(scheduler.creates()).toEqual([]);
  });

  it('updating replaces the task rather than adding a second', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    await service.enable(scheduleOf(DAILY));
    await service.enable(scheduleOf(WEEKLY));
    expect(scheduler.creates()).toHaveLength(2);
    expect(scheduler.creates().every((c) => c.args.includes('/F') && c.args.includes(TASK_FULL_NAME))).toBe(true);
    expect(scheduler.state.xml).toContain('<Wednesday />');
  });

  it('two changes at once run one after the other', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    await Promise.all([service.enable(scheduleOf(DAILY)), service.disable(), service.enable(scheduleOf(WEEKLY))]);
    expect(scheduler.state.xml).toContain('<Wednesday />');
  });
});

describe('status: the switch reads the real task', () => {
  it('off when there is no task', async () => {
    const status = await make(fakeScheduler()).status(scheduleOf(DAILY));
    expect(status).toMatchObject({ supported: true, exists: false, inSync: null, nextRun: null });
  });

  it('on, in sync, when the task matches the schedule', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    await service.enable(scheduleOf(DAILY));
    expect(await service.status(scheduleOf(DAILY))).toMatchObject({ exists: true, inSync: true });
  });

  it('on but out of sync when the schedule moved on and the task did not', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    await service.enable(scheduleOf(DAILY));
    expect(await service.status(scheduleOf({ ...DAILY, hour: 4 }))).toMatchObject({ exists: true, inSync: false });
    expect(await service.status(null)).toMatchObject({ exists: true, inSync: false });
  });

  it('reads PowerShell by full path with a fixed script and no shell', async () => {
    const scheduler = fakeScheduler();
    await make(scheduler).status(null);
    const call = scheduler.state.calls[0];
    expect(call.file).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(call.args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
    expect(call.args[3]).toContain("Get-ScheduledTask -TaskPath '\\Prune\\' -TaskName 'Scheduled clean'");
    expect(call.options.shell).toBeUndefined();
  });

  it('a task that cannot be read is an error, not a silent "off"', async () => {
    const scheduler = fakeScheduler();
    scheduler.exec.mockRejectedValueOnce(new Error('powershell timed out'));
    await expect(make(scheduler).status(null)).rejects.toThrow(/timed out/);
  });
});

describe('disable', () => {
  it('deletes the task by name, forced, with an argv array', async () => {
    const scheduler = fakeScheduler({ exists: '<x/>' });
    const status = await make(scheduler).disable();
    expect(scheduler.deletes()).toHaveLength(1);
    expect(scheduler.deletes()[0].args).toEqual(['/Delete', '/TN', TASK_FULL_NAME, '/F']);
    expect(scheduler.deletes()[0].file).toBe('C:\\Windows\\System32\\schtasks.exe');
    expect(status.exists).toBe(false);
  });

  it('is not an error when there was no task', async () => {
    const scheduler = fakeScheduler();
    expect((await make(scheduler).disable()).exists).toBe(false);
  });

  it('is an error when Windows refused and the task is still there', async () => {
    const scheduler = fakeScheduler({ exists: '<x/>', failDelete: true });
    await expect(make(scheduler).disable()).rejects.toThrow(/Access is denied/);
  });
});

describe('reconcile: an existing task follows the settings, and is never created here', () => {
  it('does nothing when there is no task, whatever the settings say', async () => {
    const scheduler = fakeScheduler();
    expect(await make(scheduler).reconcile(DAILY)).toEqual({ action: 'none' });
    expect(scheduler.creates()).toEqual([]);
    expect(scheduler.deletes()).toEqual([]);
  });

  it('does nothing when the task already matches', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    await service.enable(scheduleOf(DAILY));
    expect(await service.reconcile(DAILY)).toEqual({ action: 'none' });
    expect(scheduler.creates()).toHaveLength(1);
  });

  it('updates the task when the time or day changes', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    await service.enable(scheduleOf(DAILY));
    expect(await service.reconcile({ ...DAILY, hour: 5 })).toEqual({ action: 'updated' });
    expect(scheduler.state.xml).toContain('T05:05:00');
    expect(await service.reconcile(WEEKLY)).toEqual({ action: 'updated' });
    expect(scheduler.state.xml).toContain('<Wednesday />');
  });

  it('removes the task when the schedule is switched off, or stops cleaning', async () => {
    for (const automation of [{ ...DAILY, enabled: false }, { ...DAILY, task: 'scan' }, null]) {
      const scheduler = fakeScheduler();
      const service = make(scheduler);
      await service.enable(scheduleOf(DAILY));
      expect(await service.reconcile(automation)).toEqual({ action: 'removed' });
      expect(scheduler.state.xml).toBeNull();
    }
  });

  it('puts a task that points at a moved install folder back to the current one', async () => {
    const scheduler = fakeScheduler();
    await make(scheduler, { execPath: 'D:\\Old\\Prune\\Prune.exe' }).enable(scheduleOf(DAILY));
    const moved = make(scheduler);
    expect(await moved.reconcile(DAILY)).toEqual({ action: 'updated' });
    expect(scheduler.state.xml).toContain(`<Command>${CLI}</Command>`);
  });
});

describe('delegates: the in-app scheduler asks whether a task owns the schedule', () => {
  it('is true while the task exists, false when it does not', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler, { presenceTtlMs: 0 });
    expect(await service.delegates()).toBe(false);
    await service.enable(scheduleOf(DAILY));
    expect(await service.delegates()).toBe(true);
    await service.disable();
    expect(await service.delegates()).toBe(false);
  });

  it('reads Task Scheduler once per few minutes, not once per question', async () => {
    const scheduler = fakeScheduler({ exists: '<x/>' });
    const service = make(scheduler);
    await service.delegates();
    await service.delegates();
    await service.delegates();
    expect(scheduler.state.calls.filter((c) => /powershell/i.test(c.file))).toHaveLength(1);
  });

  it('forgets the answer the moment the task changes', async () => {
    const scheduler = fakeScheduler();
    const service = make(scheduler);
    expect(await service.delegates()).toBe(false);
    await service.enable(scheduleOf(DAILY));
    expect(await service.delegates()).toBe(true);
    await service.disable();
    expect(await service.delegates()).toBe(false);
  });

  it('does not delegate when Task Scheduler cannot be read: the in-app schedule keeps working', async () => {
    const scheduler = fakeScheduler();
    scheduler.exec.mockRejectedValue(new Error('no powershell'));
    expect(await make(scheduler).delegates()).toBe(false);
  });
});
