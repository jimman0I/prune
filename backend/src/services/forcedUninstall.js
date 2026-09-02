import { scanForLeftovers } from './leftoverScan.js';

/** Forced uninstall: removing software whose own uninstaller can no longer
 * do it.
 *
 * The normal path (routes/uninstall.js) runs the program's registered
 * UninstallString and only then sweeps up what it left behind. That path
 * has nothing to run when the uninstaller is missing, the entry was
 * orphaned by a half-finished install, or the program was "uninstalled"
 * by deleting its folder -- exactly the cases programHealth.js flags.
 * This is the fallback for those: search by name, show everything that
 * matches, remove only what the user picks.
 *
 * It reuses the EXISTING leftover scanner rather than introducing a second
 * definition of "what belongs to this program", so a forced removal finds
 * the same things a normal uninstall's own cleanup step would have. The
 * one addition is the Add/Remove Programs entry itself, which the normal
 * path never has to remove (a working uninstaller removes its own key) and
 * which is the whole reason a dead entry lingers in the list. */
export async function scanForcedUninstall({ name, publisher, registryKey }) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  // An empty pattern makes the scanner's regex match every directory under
  // Program Files and every key under HKLM\Software -- it would present
  // the entire machine as removable leftovers.
  if (!trimmed) throw new Error('A program name is required to scan for leftovers.');

  const scan = await scanForLeftovers({ name: trimmed, publisher });

  const items = scan.registryKeys.items.map((item) => ({ ...item }));
  if (registryKey) {
    const existing = items.find((i) => i.path?.toLowerCase() === registryKey.toLowerCase());
    if (existing) existing.isUninstallEntry = true;
    else items.unshift({ path: registryKey, isUninstallEntry: true });
  }

  return { ...scan, registryKeys: { ...scan.registryKeys, items } };
}

/* There is deliberately no execute function here. Removal goes through the
 * EXISTING POST /api/quarantine/remove, which already quarantines files and
 * registry keys and creates a system restore point first -- a forced
 * uninstall is the case that most needs that restore point, so routing
 * around it to save an import would have been strictly worse. What was
 * missing was honest reporting of keys that couldn't be removed, and that
 * now lives in quarantineAndDelete itself (manifest.failedRegistryKeys),
 * where the failure actually happens, so the ordinary uninstall flow gets
 * it too rather than only this one. */
