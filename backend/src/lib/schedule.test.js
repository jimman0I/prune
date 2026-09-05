import { describe, it, expect } from 'vitest';
import { nextRunAfter, dueRun, describeSchedule } from './schedule.js';

/** Local time throughout: someone who types 2:00 AM means 2:00 AM where
 * they are, not UTC. These build local Dates for the same reason. */
const local = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

const daily = { enabled: true, frequency: 'daily', hour: 2, minute: 0, task: 'scan' };
// 2026-09-06 is a Sunday.
const weekly = { enabled: true, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' };

describe('nextRunAfter', () => {
  it('finds today for a daily run still ahead', () => {
    expect(nextRunAfter(daily, local(2026, 9, 5, 1, 0))).toEqual(local(2026, 9, 5, 2, 0));
  });

  it('rolls to tomorrow once today has passed', () => {
    expect(nextRunAfter(daily, local(2026, 9, 5, 3, 0))).toEqual(local(2026, 9, 6, 2, 0));
  });

  it('treats the exact minute as already run rather than due again', () => {
    // Otherwise a run finishing at 02:00:00.000 computes its own start as
    // the next one and fires forever.
    expect(nextRunAfter(daily, local(2026, 9, 5, 2, 0))).toEqual(local(2026, 9, 6, 2, 0));
  });

  it('finds the next matching weekday', () => {
    // Saturday the 5th -> Sunday the 6th.
    expect(nextRunAfter(weekly, local(2026, 9, 5, 12, 0))).toEqual(local(2026, 9, 6, 2, 0));
  });

  it('rolls a whole week when today is the day but the time has gone', () => {
    expect(nextRunAfter(weekly, local(2026, 9, 6, 3, 0))).toEqual(local(2026, 9, 13, 2, 0));
  });

  it('keeps today when today is the day and the time is still ahead', () => {
    expect(nextRunAfter(weekly, local(2026, 9, 6, 1, 0))).toEqual(local(2026, 9, 6, 2, 0));
  });

  it('has no next run when it is switched off', () => {
    expect(nextRunAfter({ ...daily, enabled: false }, local(2026, 9, 5, 1, 0))).toBeNull();
    expect(nextRunAfter(null, local(2026, 9, 5, 1, 0))).toBeNull();
  });

  it('refuses a nonsense time rather than guessing one', () => {
    // A corrupt settings file must not produce a schedule that fires at a
    // time nobody chose.
    expect(nextRunAfter({ ...daily, hour: 27 }, local(2026, 9, 5))).toBeNull();
    expect(nextRunAfter({ ...daily, minute: -1 }, local(2026, 9, 5))).toBeNull();
    expect(nextRunAfter({ ...daily, frequency: 'hourly' }, local(2026, 9, 5))).toBeNull();
  });
});

describe('dueRun', () => {
  it('is not due before its first scheduled time', () => {
    const status = dueRun(daily, null, local(2026, 9, 5, 1, 0));
    expect(status.due).toBe(false);
    expect(status.missed).toBe(0);
  });

  it('is due once the time has passed and it has never run', () => {
    const status = dueRun(daily, null, local(2026, 9, 5, 3, 0));
    expect(status.due).toBe(true);
  });

  it('is not due again in the same window', () => {
    const lastRun = local(2026, 9, 5, 2, 0).getTime();
    expect(dueRun(daily, lastRun, local(2026, 9, 5, 6, 0)).due).toBe(false);
  });

  it('is due again the next day', () => {
    const lastRun = local(2026, 9, 5, 2, 0).getTime();
    expect(dueRun(daily, lastRun, local(2026, 9, 6, 2, 30)).due).toBe(true);
  });

  it('counts the runs a machine that was off went through', () => {
    // The reason the brief wants a "skipped" badge at all. A desktop that
    // is asleep at 2 AM misses the window entirely, and saying "3 runs
    // missed" is the difference between the feature being broken and the
    // machine having been off.
    const lastRun = local(2026, 9, 1, 2, 0).getTime();
    const status = dueRun(daily, lastRun, local(2026, 9, 5, 3, 0));
    expect(status.due).toBe(true);
    expect(status.missed).toBe(3);
  });

  it('never reports a negative or absurd miss count', () => {
    // A clock moved backwards, or a lastRun in the future.
    const future = local(2027, 1, 1).getTime();
    const status = dueRun(daily, future, local(2026, 9, 5, 3, 0));
    expect(status.missed).toBe(0);
    expect(status.due).toBe(false);
  });

  it('caps the miss count rather than reporting a thousand', () => {
    // A machine off for three years should say "a lot", not compute and
    // render 1,095 individual missed runs.
    const ancient = local(2023, 1, 1).getTime();
    const status = dueRun(daily, ancient, local(2026, 9, 5, 3, 0));
    expect(status.missed).toBeLessThanOrEqual(99);
  });

  it('is never due when switched off', () => {
    const status = dueRun({ ...daily, enabled: false }, null, local(2030, 1, 1));
    expect(status.due).toBe(false);
    expect(status.missed).toBe(0);
  });
});

describe('describeSchedule', () => {
  it('says when it runs, in words', () => {
    expect(describeSchedule(daily)).toBe('Every day at 02:00');
    expect(describeSchedule(weekly)).toBe('Every Sunday at 02:00');
  });

  it('says when it does not run', () => {
    expect(describeSchedule({ ...daily, enabled: false })).toBe('Off');
    expect(describeSchedule(null)).toBe('Off');
  });
});
