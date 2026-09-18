/** Which Settings sub-tab reopens by default -- pure UI-navigation
 * memory, stored in localStorage rather than the app's own settings.json
 * for the same reason theme.js's own choice is: nobody needs this
 * synced, backed up, or exposed in the config file, and it's the
 * lightweight place this codebase already keeps exactly this kind of
 * value.
 *
 * `validTabs` is passed in by the caller (SettingsPage.jsx's own real
 * TAB_IDS) rather than duplicated here, so this file stays a
 * dependency-free pure module and the one place that actually knows
 * which tabs exist stays the only place that knows. */
export const SETTINGS_TAB_STORAGE_KEY = 'prune.settingsTab';

/** A stored value not in `validTabs` is treated as absent, not trusted --
 * same defensive rule theme.js already applies to a stored value outside
 * THEMES. Wrapped in try/catch because storage access itself can throw,
 * not just return null (a packaged Electron renderer with site data
 * blocked raises on the getter). */
export function readStoredSettingsTab(storage, validTabs) {
  try {
    const value = storage?.getItem(SETTINGS_TAB_STORAGE_KEY) ?? null;
    return validTabs.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredSettingsTab(storage, tab) {
  try {
    storage?.setItem(SETTINGS_TAB_STORAGE_KEY, tab);
    return true;
  } catch {
    // The tab choice still applies for this session; it just will not
    // be remembered. Worth not crashing over.
    return false;
  }
}
