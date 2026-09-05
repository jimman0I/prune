import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Path to the settings file. A function, not a constant -- read at call
 * time, not import time -- so tests can point it at a scratch temp file
 * via UNREVO_SETTINGS_PATH without touching the real
 * %LOCALAPPDATA%\Prune\settings.json on the dev machine. Same
 * env-var-override pattern quarantine.js's quarantineRoot() uses. This
 * fallback only matters running standalone (`node src/index.js`) --
 * packaged mode always sets UNREVO_SETTINGS_PATH from electron/main.cjs's
 * own app.getPath('userData'), which already resolves to %APPDATA%\Prune
 * now that electron/package.json's productName is "Prune". Env var names
 * themselves (UNREVO_*) are internal-only and were deliberately left
 * unrenamed in the "unrevo" -> "Prune" rebrand -- no user ever sees them. */
export function settingsPath() {
  return process.env.UNREVO_SETTINGS_PATH
    || join(process.env.LOCALAPPDATA || process.cwd(), 'Prune', 'settings.json');
}

/** Every setting, and what it does when nobody has touched it.
 *
 * Two of these used to be written by the Settings screen and read by
 * nothing at all -- `excludeFolders` and `autoQuarantine` were saved to
 * disk, shown back to the user, and had no effect on a single line of
 * behaviour. A control that does nothing is worse than a missing one,
 * because the user stops checking whether any of the others work either.
 * Both are wired now, and nothing goes in this object that isn't.
 *
 * The three new ones are lifted from what Revo and BleachBit ship enabled
 * rather than from what they merely offer:
 *
 *   skipRecentHours -- Revo's "ignore the last 24 hours", on by default
 *   there and worth copying: in a temp folder, a file being written right
 *   now is indistinguishable from one abandoned two years ago.
 *
 *   createRestorePoint -- Revo's SRInCP, also on. Prune already made one
 *   before every forced removal; it just made one unconditionally, which
 *   is wrong on a machine where System Protection is off and the attempt
 *   is a slow no-op.
 *
 *   hideUnavailableRules -- BleachBit's "hide irrelevant cleaners". Most
 *   of a 74-rule list is for software the user does not have. */
const DEFAULT_SETTINGS = {
  excludeFolders: [],
  /* File types the cleaner and the disk scanner both skip, stored as
     '.iso'. Separate from excludeFolders because they are matched
     differently -- a suffix on the name versus a prefix on the path --
     and a single list would have to guess which at match time, on every
     file of every scan. See lib/exclusionInput.js. */
  excludeExtensions: [],
  autoQuarantine: true,
  theme: 'dark',
  accentColor: null,
  minimizeToTray: true,
  skipRecentHours: 24,
  createRestorePoint: true,
  hideUnavailableRules: false,
  /* Days before a quarantine batch is deleted for good, or null for
     never. Off by default and off for every ambiguous value -- see
     quarantineRetention.js. Quarantine is this app's undo, and a
     retention that runs when it should not destroys the only copy of
     something the user removed by accident. */
  quarantineRetentionDays: null,
  /* The scheduled run. IN-APP: it catches up when Prune is running rather
     than firing with the app closed, because there is no headless entry
     point for a Windows task to invoke. lastRunAt and lastResult live here
     rather than in a second file so one write persists both the schedule
     and its history. */
  automation: {
    enabled: false,
    frequency: 'weekly',
    weekday: 0,
    hour: 2,
    minute: 0,
    task: 'scan',
    lastRunAt: null,
    lastResult: null
  }
};

/** The subset of settings the cleaner needs, in the shape it takes.
 *
 * A named translation rather than passing the whole settings object down:
 * the guards should not have to know that a field is called
 * `skipRecentHours`, and a typo in that name would otherwise silently mean
 * "no guard" rather than failing anywhere visible. */
export function cleanGuardsFrom(settings) {
  const hours = Number(settings?.skipRecentHours);
  return {
    excludeFolders: Array.isArray(settings?.excludeFolders) ? settings.excludeFolders : [],
    excludeExtensions: Array.isArray(settings?.excludeExtensions) ? settings.excludeExtensions : [],
    skipRecentHours: Number.isFinite(hours) && hours > 0 ? hours : 0,
    // Only an explicit false turns quarantining off. A settings file
    // written before this key existed must keep the safer behaviour.
    autoQuarantine: settings?.autoQuarantine !== false
  };
}

/** Persisted app settings, or the default shape if nothing has ever been
 * saved. Never throws on a missing file -- "never configured" is a normal,
 * expected state, not an error. */
export async function getSettings() {
  const path = settingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(await readFile(path, 'utf8')) };
  } catch {
    // A corrupted settings file must not crash every screen that reads
    // settings -- fall back to defaults, same as "never configured".
    return { ...DEFAULT_SETTINGS };
  }
}

/** Merges `partial` into the current settings and persists the result --
 * a field not mentioned in `partial` keeps its existing value, it is never
 * silently reset to the default. Returns the full updated settings object,
 * not just what was passed in, so a caller never has to guess what the
 * merge produced. */
export async function updateSettings(partial) {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  const path = settingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
