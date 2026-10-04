/** What the "What's new" notice shows, and when it is shown.
 *
 * Data-driven: an entry per major.minor, so a patch release (3.0.1) never
 * repeats the notice and the next feature release adds one entry and one
 * i18n namespace, with no change to the dialog or to App.
 *
 * Each card is a way into something that is otherwise buried (a Settings
 * switch, a button behind a menu), not a changelog line. `target` is the
 * optional "Show me": a screen id from screenOrder.js and, for Settings, which
 * tab to open on. A card without one is information only.
 *
 * `icon` names a glyph in components/WhatsNewDialog.jsx, drawn from the nav
 * rail's own icons where a card is about a screen. Text is looked up by
 * `${namespace}.cards.${id}.title` / `.description` in the i18n catalog
 * (i18n/extras/whatsNew.js), never kept here. */
export const WHATS_NEW = {
  '3.0': {
    namespace: 'whatsNewV3',
    cards: [
      { id: 'rail', icon: 'rail' },
      { id: 'diskMap', icon: 'diskmap', target: { screen: 'diskmap' } },
      { id: 'deepClean', icon: 'deepclean', target: { screen: 'deepclean' } },
      { id: 'uninstaller', icon: 'applications', target: { screen: 'applications' } },
      { id: 'dashboard', icon: 'dashboard', target: { screen: 'dashboard' } },
      { id: 'settings', icon: 'settings', target: { screen: 'settings', settingsTab: 'general' } }
    ]
  }
};

const VERSION = /^(\d+)\.(\d+)\.(\d+)/;

/** [major, minor] of "3.0.1" (or "3.1.0-beta.2"), or null for anything that is
 * not a version -- 'dev', an empty string, a number. */
function parse(version) {
  const match = typeof version === 'string' ? VERSION.exec(version) : null;
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** '3.0' for "3.0.1", else null. The key an entry is filed under. */
export function majorMinor(version) {
  const parsed = parse(version);
  return parsed ? `${parsed[0]}.${parsed[1]}` : null;
}

/** The entry for a running version, or null when that release has none. */
export function entryFor(version, entries = WHATS_NEW) {
  const key = majorMinor(version);
  return key && Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
}

/** Whether the notice should be put in front of someone on `current`, who last
 * saw `lastSeen`.
 *
 * - `undefined` is "settings did not say" (not loaded, or an older backend):
 *   never show, since guessing wrong would pop a dialog at someone who is
 *   mid-task. `null` is "no version ever recorded", which for an existing
 *   install is everyone updating from before this existed: an update.
 * - A brand-new install never reaches here as null: the backend stamps it with
 *   the running version (services/settings.js), which is "same version".
 * - Only a step up in major.minor counts. A patch bump (3.0.0 -> 3.0.1), the
 *   same version, and a downgrade show nothing.
 * - And only where `current` has an entry. 'dev' and a release with nothing to
 *   announce have none. */
export function shouldShowWhatsNew({ current, lastSeen, entries = WHATS_NEW }) {
  if (lastSeen === undefined) return false;
  const now = parse(current);
  if (!now || !entryFor(current, entries)) return false;
  const before = parse(lastSeen);
  if (!before) return true;
  return now[0] > before[0] || (now[0] === before[0] && now[1] > before[1]);
}
