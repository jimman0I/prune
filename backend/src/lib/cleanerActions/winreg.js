import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { quarantineAndDelete } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

/** Whether a registry key exists at all -- `reg query` throws (non-zero
 * exit) when it doesn't, which this treats as the answer rather than an
 * error. No byte size is reported: a registry key doesn't have one worth
 * showing, and `0` would read as "measured and empty" rather than "not
 * the kind of thing this is measured in." */
export async function scan(action) {
  try {
    await execFileAsync('reg', ['query', action.expandedKey]);
    return { present: true };
  } catch {
    return { present: false };
  }
}

/** Deletes one registry key -- through quarantineAndDelete, NOT a raw
 * `reg delete` call. That function already exports the key to a .reg file
 * in the quarantine batch BEFORE deleting it, and restoreQuarantineBatch
 * already re-imports it -- the same path an uninstall's own leftover
 * registry removal already uses. This is not new registry code; it's the
 * same primitive called from a second place.
 *
 * registryKeysRemoved is read off how many keys quarantineAndDelete
 * actually recorded as removed (0 if the key was already gone or was
 * refused as protected -- either way not an error, same "nothing to
 * clean" posture an absent cache folder gets from the delete action).
 *
 * No `guards` parameter, unlike delete's/sqlite.vacuum's execute --
 * excludeFolders/excludeExtensions and skipRecentHours are filesystem
 * concepts a registry key has no equivalent of (no path extension, no
 * mtime), and autoQuarantine doesn't apply either: this action is always
 * quarantined via quarantineAndDelete, the same as sqlite.vacuum is never
 * quarantined because VACUUM rewrites the file in place. Not an
 * oversight -- there is nothing here for a guards object to guard. */
export async function execute(action, ruleName) {
  const { present } = await scan(action);
  if (!present) return { freedBytes: 0, registryKeysRemoved: 0, skipped: [] };

  const manifest = await quarantineAndDelete({
    programName: `Deep Clean: ${ruleName}`,
    files: [],
    registryKeys: [action.expandedKey]
  });

  return {
    freedBytes: 0,
    registryKeysRemoved: manifest.registryKeys.length,
    quarantineBatch: manifest.batchDir,
    skipped: manifest.failedRegistryKeys.map((key) => ({ path: key, reason: 'protected or could not be removed' }))
  };
}
