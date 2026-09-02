import { scanForLeftovers } from './leftoverScan.js';
import { quarantineAndDelete } from './quarantine.js';

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

/** Quarantines exactly what the caller selected -- moved and exported, not
 * deleted, so a wrong match is recoverable from the Quarantine screen the
 * same way a normal uninstall's leftover removal already is.
 *
 * `failedRegistryKeys` is the part that matters for honesty.
 * quarantineAndDelete deliberately swallows a failed `reg delete` so one
 * bad key can't abort a whole batch, which means a key needing admin comes
 * back simply missing from the manifest. Diffing what was asked for
 * against what the manifest actually confirms is the only way the UI can
 * tell the user their Add/Remove entry is still there -- reporting a clean
 * removal that didn't happen is the same class of lie as inventing a
 * number for a directory we couldn't read. */
export async function executeForcedUninstall({ name, files = [], registryKeys = [] }) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new Error('A program name is required.');
  if (files.length === 0 && registryKeys.length === 0) {
    throw new Error('Nothing was selected to remove.');
  }

  const manifest = await quarantineAndDelete({ programName: trimmed, files, registryKeys });

  const removed = new Set((manifest.registryKeys || []).map((k) => k.toLowerCase()));
  const failedRegistryKeys = registryKeys.filter((k) => !removed.has(k.toLowerCase()));

  return {
    freedBytes: manifest.totalSizeBytes,
    quarantineBatch: manifest.batchDir,
    removedFiles: manifest.files?.length ?? 0,
    removedRegistryKeys: manifest.registryKeys ?? [],
    failedRegistryKeys
  };
}
