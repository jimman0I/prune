import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { lowDiskMessage } from './lowDisk.js';

/** The native "your drive is nearly full" notification, at most once per drive
 * per day.
 *
 * Only ever started from the tray (see lib/trayManager.js), because that is the
 * one place Prune runs with nobody looking at it -- the Dashboard banner covers
 * everyone who is. It stays quiet while the Prune window is the one in front.
 *
 * The rules, all of which exist to keep a warning from becoming noise:
 *   - one per drive per local calendar day, remembered across restarts (a small
 *     file), and not used up by a notification that could not be shown or that
 *     was held back because you were looking at Prune;
 *   - nothing at all when the warning is off in Settings;
 *   - a look every few minutes, which costs one statfs per drive (see
 *     services/lowDisk.js), never a process;
 *   - a failure anywhere is swallowed. A warning that cannot be raised must
 *     not take the app down with it.
 *
 * Everything it touches is injected, so the rules are tested without Electron,
 * a clock or a disk. */

const FIVE_MINUTES = 5 * 60 * 1000;
const FIRST_LOOK_MS = 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' on the local clock: a day is the person's day, not UTC's. */
export function localDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Which days each drive was last told about, in a file beside settings.json.
 * Written atomically; anything unrecognised reads as "not told yet". */
export function fileNotifiedStore(path) {
  return {
    async load() {
      let raw;
      try {
        raw = JSON.parse(await readFile(path, 'utf8'));
      } catch {
        return {};
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const kept = {};
      for (const [drive, day] of Object.entries(raw)) {
        if (/^[A-Z]:$/.test(drive) && typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)) kept[drive] = day;
      }
      return kept;
    },
    async save(data) {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.tmp`;
      try {
        await writeFile(tmp, JSON.stringify(data), 'utf8');
        await rename(tmp, path);
      } catch (err) {
        await rm(tmp, { force: true }).catch(() => {});
        throw err;
      }
    }
  };
}

/** Where the told-about file lives: beside the settings. */
export function notifiedPath() {
  const settings = process.env.UNREVO_SETTINGS_PATH
    || join(process.env.LOCALAPPDATA || process.cwd(), 'Prune', 'settings.json');
  return join(dirname(settings), 'lowDiskNotified.json');
}

export function createLowDiskWatcher({ getPercent, findLow, notify, canNotify, store, now = () => new Date() }) {
  let first = null;
  let timer = null;
  let running = false;
  // Set by stop(): a look already under way ends at its next step instead of
  // finishing after it was told to stop.
  let stopped = false;
  // What this run knows even if the file cannot be read or written.
  const told = {};

  async function tick() {
    if (running) return;
    running = true;
    try {
      const percent = await getPercent();
      if (!percent || stopped) return;
      const lowDrives = await findLow(percent);
      if (lowDrives.length === 0 || stopped) return;
      const today = localDay(now());
      const stored = await store.load().catch(() => ({}));
      const notified = { ...stored, ...told };
      let changed = false;
      for (const row of lowDrives) {
        if (notified[row.drive] === today) continue;
        // Looking at Prune already: the Dashboard says it. Not marked as told.
        if (!canNotify()) continue;
        try {
          await notify(row);
        } catch {
          continue;
        }
        notified[row.drive] = today;
        told[row.drive] = today;
        changed = true;
      }
      if (changed) await store.save(notified).catch(() => {});
    } catch {
      /* nothing here may reach the rest of the app */
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start({ firstDelayMs = FIRST_LOOK_MS, intervalMs = FIVE_MINUTES } = {}) {
      if (first || timer) return;
      stopped = false;
      first = setTimeout(() => {
        first = null;
        tick();
        timer = setInterval(tick, intervalMs);
        timer.unref?.();
      }, firstDelayMs);
      first.unref?.();
    },
    stop() {
      stopped = true;
      if (first) clearTimeout(first);
      if (timer) clearInterval(timer);
      first = null;
      timer = null;
    }
  };
}

/** Electron's Notification wrapped as the `notify` the watcher wants. Takes the
 * pieces rather than importing 'electron', which does not exist outside it.
 * Rejects where notifications are unsupported, so that is not counted as told. */
export function makeNotifier({ Notification, showWindow }) {
  return async (row) => {
    if (!Notification.isSupported()) throw new Error('Notifications are not supported here.');
    const { title, body } = lowDiskMessage(row);
    const notification = new Notification({ title, body, silent: false });
    notification.on('click', showWindow);
    notification.show();
  };
}
