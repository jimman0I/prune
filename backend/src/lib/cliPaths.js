import { win32 } from 'node:path';

/** Where an INSTALLED copy of the command line finds Prune's data.
 *
 * The app is told these by electron/main.cjs through UNREVO_SETTINGS_PATH,
 * UNREVO_QUARANTINE_ROOT and UNREVO_SQLITE3_PATH, all from `userData`
 * (%APPDATA%\Prune) and the resources folder. The command line is started by
 * Windows (Task Scheduler) or from a console and is told nothing, so it would
 * read %LOCALAPPDATA%\Prune\settings.json -- not the app's file -- and clean
 * with default guards. This hands it the same three answers the app has.
 *
 * Applies only to the copy that ships at `<install>\resources\backend\src\cli.js`.
 * A checkout, a test, or a run with the paths already set (flags or
 * environment) is not touched: the caller only fills in what is missing. */
export function packagedDefaults({ cliPath, env = process.env } = {}) {
  if (typeof cliPath !== 'string' || !env.APPDATA) return null;
  const match = /^(.*?)[\\/]resources[\\/]backend[\\/]src[\\/]cli\.js$/i.exec(cliPath);
  if (!match) return null;
  const install = win32.normalize(match[1]);
  const userData = win32.join(env.APPDATA, 'Prune');
  return {
    settings: win32.join(userData, 'settings.json'),
    quarantine: win32.join(userData, 'quarantine'),
    sqlite: win32.join(install, 'resources', 'sqlite3.exe')
  };
}
