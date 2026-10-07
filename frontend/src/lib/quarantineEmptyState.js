import { removalModeFrom } from './cleanOutcome.js';
import { leftoverDestinationFrom } from './leftoverDestination.js';

/** Which translated body the Quarantine screen's empty state shows.
 *
 * The old text was one fixed sentence: "Anything an uninstall or a Deep
 * Clean removes lands here first... always recoverable." That was true only
 * while both of the settings that feed this screen were on their reversible
 * default. Turn on Delete now, or turn Auto-Quarantine off, or set an
 * uninstall's leftover destination to the Recycle Bin or permanent delete,
 * and the sentence kept making a promise Prune was no longer keeping --
 * right where trust in "it's always recoverable" matters most, a confirm
 * dialog someone is about to click through.
 *
 * Four cases, from what actually still lands here:
 *  - both:        the original sentence, unchanged.
 *  - deepCleanOnly / uninstallOnly: name the one mechanism that does, and
 *    say plainly that the other does not.
 *  - neither: nothing lands here at all right now, said as a fact rather
 *    than left to be discovered from an empty screen that still claims
 *    everything is recoverable.
 *
 * Deliberately not UI: a pure function of settings, so it is tested without
 * mounting a screen, and the component just picks the key it names. */
export function quarantineEmptyBodyKey(settings) {
  const deepCleanLands = removalModeFrom(settings) === 'quarantine';
  const uninstallLands = leftoverDestinationFrom(settings) === 'quarantine';
  if (deepCleanLands && uninstallLands) return 'quarantine.empty.bodyBoth';
  if (deepCleanLands) return 'quarantine.empty.bodyDeepCleanOnly';
  if (uninstallLands) return 'quarantine.empty.bodyUninstallOnly';
  return 'quarantine.empty.bodyNeither';
}
