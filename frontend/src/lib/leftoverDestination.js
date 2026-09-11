/** Where an uninstall's leftover files go -- the three the backend accepts
 * (services/leftoverRemoval.js). */
export const LEFTOVER_DESTINATIONS = ['quarantine', 'recycle', 'permanent'];

/** The destination a dialog will send: the setting, or Quarantine whenever
 * the setting is missing, unknown or could not be read at all.
 *
 * The one fact that decides whether a removal can be undone never falls
 * back in the direction that cannot. A settings request that failed means
 * Quarantine, not "whatever was chosen last time". */
export function leftoverDestinationFrom(settings) {
  return LEFTOVER_DESTINATIONS.includes(settings?.leftoverDestination) ? settings.leftoverDestination : 'quarantine';
}
