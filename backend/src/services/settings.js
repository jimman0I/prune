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

const DEFAULT_SETTINGS = { excludeFolders: [], autoQuarantine: true, theme: 'dark', accentColor: null, minimizeToTray: true };

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
