import { getStoreApps } from './storeApps.js';
import { getProgramIcons } from './programIcons.js';
import { getPackageIcons } from './packageIcons.js';

/** Makes (or refreshes) the Store list and the two icon maps, and so saves them.
 *
 * Each is a slow lookup that the Applications screen decorates its rows with,
 * kept on disk between launches (see lib/snapshotStore.js) so the next launch
 * shows them at once. Without this, the first launch ever and any launch that
 * never opens Applications would leave the snapshots to be made on demand,
 * which is the wait this exists to remove.
 *
 * Run from the delayed start-up housekeeping, never at the moment the server
 * starts listening: the first seconds belong to the window loading. One at a
 * time, because each is a PowerShell pass of its own and running them together
 * is the CPU spike the first minute used to have. A failure of one does not stop
 * the next; that one is simply made on demand later, as it always was. */
export async function warmDecorations({
  lookups = [getStoreApps, getProgramIcons, getPackageIcons]
} = {}) {
  for (const lookup of lookups) {
    try { await lookup(); } catch { /* made on demand instead */ }
  }
}
