import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { matchLanguage } from './languages.js';

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
 *   of a 74-rule list is for software the user does not have, so it is
 *   on by default: listed and pre-ticked, Slack or Vivaldi on a PC that
 *   never had them reads as Prune making things up. */
const DEFAULT_SETTINGS = {
  excludeFolders: [],
  /* File types the cleaner and the disk scanner both skip, stored as
     '.iso'. Separate from excludeFolders because they are matched
     differently -- a suffix on the name versus a prefix on the path --
     and a single list would have to guess which at match time, on every
     file of every scan. See lib/exclusionInput.js. */
  excludeExtensions: [],
  /** Cookie domains a `cookie` action must NEVER delete rows for -- an
   * exact-domain-or-any-subdomain match against each entry (so keeping
   * "example.com" also keeps "sub.example.com", matching BleachBit's own
   * predicate). Empty by default, and an empty list is a fully working,
   * intentional state: it means every `cookie` action deletes the whole
   * cookie database file outright, exactly like BleachBit's own behavior
   * when nothing is configured to survive. See cleanerActions/cookie.js.
   * Populated via Settings -> Cleanup's "Cookies to preserve" panel
   * (CookieKeepListSettings.jsx), which scans real cookie databases and
   * ticks domains into this array. Empty is still the documented default
   * behavior of the list itself, not a sign the UI is missing. */
  cookieKeepList: [],
  autoQuarantine: true,
  theme: 'dark',
  minimizeToTray: false,
  skipRecentHours: 24,
  createRestorePoint: true,
  hideUnavailableRules: true,
  /* Deep Clean rules whose "this loses data" warning the user has ticked
     "remember my choice" on, by rule id. Sixteen rules are marked risky
     -- history, cookies, sessions, autofill and site data across three
     browsers, plus the Recycle Bin -- and ticking one opens a dialog
     naming the consequence. This is the list of the ones that no longer
     ask. Per rule, never per category: agreeing to lose cookies is not
     agreeing to lose browsing history. See lib/cleanWarning.js. */
  acknowledgedCleanWarnings: [],
  /* Deep Clean's own checkbox selection, by rule id -- so reopening the
     tab (or relaunching the app) shows the same rules ticked, instead of
     always resetting to defaultSelection(). Not read by cleanGuardsFrom:
     this is pure frontend selection state, never consulted by the
     cleaning engine itself during a real scan or clean, exactly like
     acknowledgedCleanWarnings above it. */
  deepCleanSelection: [],
  /* Days before a quarantine batch is deleted for good, or null for
     never. Off by default and off for every ambiguous value -- see
     quarantineRetention.js. Quarantine is this app's undo, and a
     retention that runs when it should not destroys the only copy of
     something the user removed by accident. */
  quarantineRetentionDays: null,
  /* The most the quarantine may hold, in GB, or null for no limit. Off
     by default and off for every ambiguous value, same as the retention
     window -- see quarantineSizeCap.js. A second, independent limit
     rather than a replacement: a weekly user with a 30-day window can
     still fill a drive in an afternoon by uninstalling four games, and a
     machine used twice a year keeps its undo for exactly as long as it
     should and never approaches any cap.
     1024-based, so it agrees with the figure the Quarantine screen
     prints above it. */
  quarantineMaxSizeGb: null,
  /* Whether Prune may ask GitHub, once a day, if a newer release exists.
     Off by default, because "nothing leaves the machine" is a promise the
     README makes and this is the one thing that would break it. Only an
     explicit true turns it on -- see routes/updateCheck.js. A check that
     finds something downloads nothing: installing is the side-nav
     button's job, or autoInstallUpdates' below. The installer asks this
     question too; see services/installerChoices.js. */
  updateCheck: false,
  /* Where an uninstall's leftover FILES go: 'quarantine' (restorable in
     Prune), 'recycle' or 'permanent' -- Revo's three. Registry keys are
     exported before deletion whichever it is. The dialog reads this and
     says it; the backend acts on what the dialog sent, never on this
     directly. See services/leftoverRemoval.js. */
  leftoverDestination: 'quarantine',
  /* Whether the leftover review starts with everything ticked, as it
     always has. Revo ships this off; Prune keeps its behaviour and lets
     the user choose, which matters more once 'permanent' exists. */
  preselectLeftovers: true,
  // Revo's "Only run the built-in uninstaller", the other way round.
  scanLeftoversAfterUninstall: true,
  // Revo's "Disable Uninstall History", the other way round.
  keepUninstallHistory: true,
  /* Before the program's own uninstaller runs, as Revo does. Off: a
     restore point needs admin and Windows allows one a day, and a full
     registry backup is about 140 MB (measured). See preUninstall.js. */
  restorePointBeforeUninstall: false,
  registryBackupBeforeUninstall: false,
  /* Revo's own "force deletion" cousin -- a file quarantine/removal
     couldn't move because something has it open gets scheduled for
     deletion at the next restart (MOVEFILE_DELAY_UNTIL_REBOOT's own
     mechanism -- see services/pendingReboot.js) instead of just being
     reported as skipped. Off by default, same posture as the two
     settings above: this writes to HKLM\SYSTEM, a machine-wide key,
     and needs admin -- never something to turn on silently. */
  deleteLockedFilesOnRestart: false,
  /* Whether a newer release downloads by itself and installs the next
     time Prune closes. Off by default: without it an update is one click
     on the side-nav button, and nothing is downloaded before that click.
     Only matters with updateCheck on -- nothing is found to install
     otherwise. See electron/updater.cjs and components/UpdateButton.jsx. */
  autoInstallUpdates: false,
  /* WizTree's "Show Free Space on Treemap": a block for the drive's free
     space beside what the scan found. Off by default, as WizTree ships it. */
  showFreeSpaceOnMap: false,
  /* What Prune's own screens are shown in -- one of languages.js's 40, or
     'en'. This default is only ever what a brand-new settings file gets;
     see detectDefaultLanguage() below for where a first-ever run actually
     gets its starting value, and services/installerChoices.js for the
     installer's own answer to the same question. Change it from
     Settings -> General, same as every other choice here. */
  language: 'en',
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
    cookieKeepList: Array.isArray(settings?.cookieKeepList) ? settings.cookieKeepList : [],
    skipRecentHours: Number.isFinite(hours) && hours > 0 ? hours : 0,
    // Only an explicit false turns quarantining off. A settings file
    // written before this key existed must keep the safer behaviour.
    autoQuarantine: settings?.autoQuarantine !== false
  };
}

/** The language Prune opens in before anyone -- the installer included --
 * has chosen one: Windows' own display language, when Prune has that
 * language, else English.
 *
 * Read only the moment settings.json does not exist yet, from
 * getSettings() below. Once it exists, this is never asked again; a
 * language typed into Settings, or a Windows display language that
 * changes later, does not silently override a real choice.
 *
 * Same "not running inside Electron" guard as trayManager.js's own
 * initTray() -- 'electron' is not even an installed package for
 * standalone `node src/index.js` or this test suite, only for the
 * separate electron/ project, so the dynamic import genuinely throws
 * there rather than needing a mock. That also means this function's own
 * two real-Electron branches (a locale Prune has, and app.getLocale()
 * answering one it doesn't) are untestable here for the same structural
 * reason trayManager.test.js's real branch is -- getSettings()'s own
 * `detectLanguage` parameter below is what settings.test.js actually
 * exercises, by injecting a stand-in for this whole function. */
async function detectDefaultLanguage() {
  try {
    const { app } = await import('electron');
    if (!app) return 'en';
    return matchLanguage(app.getLocale()) ?? 'en';
  } catch {
    return 'en';
  }
}

/** Persisted app settings, or the default shape if nothing has ever been
 * saved. Never throws on a missing file -- "never configured" is a normal,
 * expected state, not an error.
 *
 * `detectLanguage` is injectable so a test can prove the DETECTED value
 * actually reaches the returned settings, rather than merely matching
 * `detectDefaultLanguage()`'s own real-environment answer by coincidence
 * -- the default parameter is what every real caller gets. */
export async function getSettings({ detectLanguage = detectDefaultLanguage } = {}) {
  const path = settingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS, language: await detectLanguage() };
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
