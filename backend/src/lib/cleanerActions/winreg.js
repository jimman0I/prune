import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { quarantineAndDelete } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

/** `reg query` arguments for a scan: the key alone, or -- when the action
 * names a `value` -- that one value inside it (`/v`), so "is this value
 * here" is answered by reg.exe itself. */
function queryArgs({ expandedKey, value }) {
  return value ? ['query', expandedKey, '/v', value] : ['query', expandedKey];
}

/** Whether a registry key (or, with `value`, one value inside it) exists
 * at all -- `reg query` throws (non-zero exit) when it doesn't, which this
 * treats as the answer rather than an error. No byte size is reported: a
 * registry key doesn't have one worth showing, and `0` would read as
 * "measured and empty" rather than "not the kind of thing this is measured
 * in." */
export async function scan(action) {
  try {
    await execFileAsync('reg', queryArgs(action), { maxBuffer: 64 * 1024 * 1024 });
    return { present: true };
  } catch {
    return { present: false };
  }
}

/** scan(), synchronously -- for scanRule, which is synchronous by design
 * (it runs inside the rule-at-a-time streaming loop). ~45 ms per call; a
 * 5 s timeout bounds a wedged reg.exe (a timeout reads as "absent"). */
export function scanSync(action) {
  try {
    execFileSync('reg', queryArgs(action), { stdio: 'ignore', windowsHide: true, timeout: 5000 });
    return { present: true };
  } catch {
    return { present: false };
  }
}

/** quarantineAndDelete's two target spellings: a bare key string, or
 * { path, valueName } for one value inside a key. */
function toRegistryTarget({ expandedKey, value }) {
  return value ? { path: expandedKey, valueName: value } : expandedKey;
}
/** Drops targets that would be redundant or would break each other:
 * exact duplicates (case-insensitive key + value, as the registry is), and
 * anything at or below a whole-key target in the same list, whatever the
 * order. A whole-key parent's .reg export already contains its
 * descendants, and once the parent is deleted the child's own export fails
 * -- which would be misreported as "protected or could not be removed" and
 * undercount registryKeysRemoved. A value target under a key that is NOT
 * itself a whole-key target is unaffected. A dropped target is not counted
 * as removed: registryKeysRemoved is only what quarantineAndDelete
 * recorded. */
function dropOverlapping(actions) {
  const wholeKeys = actions.filter((a) => !a.value).map((a) => a.expandedKey.toLowerCase());
  const seen = new Set();
  const kept = [];
  for (const action of actions) {
    const key = action.expandedKey.toLowerCase();
    const id = `${key}|${action.value ? action.value.toLowerCase() : ''}|${action.value ? 'v' : 'k'}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (wholeKeys.some((parent) => key.startsWith(parent + '\\'))) continue;
    kept.push(action);
  }
  return kept;
}

function describeTarget(entry) {
  return typeof entry === 'string' ? entry : `${entry.path} [${entry.valueName}]`;
}

/** Removes every registry target of ONE rule -- whole keys and single
 * values alike -- through ONE quarantine batch. Not a raw `reg delete`
 * call: quarantineAndDelete already exports the key to a .reg file in the
 * batch BEFORE deleting it (for a value it exports the whole containing
 * key, then deletes just that value), and restoreQuarantineBatch already
 * re-imports it -- the same path an uninstall's own leftover registry
 * removal already uses. This is not new registry code; it's the same
 * primitive called from a second place.
 *
 * One batch per rule, not per key: batch directories are named
 * `${Date.now()}-${name}`, so two batches created in the same millisecond
 * would overwrite each other's registry-0.reg and manifest.json, and a
 * rule with eleven keys should be one Quarantine entry, like a delete
 * action's files.
 *
 * Targets that aren't present are dropped up front; if none are, no batch
 * is created at all.
 *
 * registryKeysRemoved counts keys and values alike, read off how many
 * targets quarantineAndDelete actually recorded as removed (a target
 * refused as protected lands in `skipped` -- not an error, same "nothing
 * to clean" posture an absent cache folder gets from the delete action).
 *
 * No `guards` parameter, unlike delete's/sqlite.vacuum's execute --
 * excludeFolders/excludeExtensions and skipRecentHours are filesystem
 * concepts a registry key has no equivalent of (no path extension, no
 * mtime), and autoQuarantine doesn't apply either: this action is always
 * quarantined via quarantineAndDelete, the same as sqlite.vacuum is never
 * quarantined because VACUUM rewrites the file in place. Not an
 * oversight -- there is nothing here for a guards object to guard. */
export async function executeAll(actions, ruleName) {
  const found = [];
  for (const action of actions) {
    if ((await scan(action)).present) found.push(action);
  }
  const present = dropOverlapping(found);
  if (present.length === 0) return { freedBytes: 0, registryKeysRemoved: 0, skipped: [] };

  const manifest = await quarantineAndDelete({
    programName: `Deep Clean: ${ruleName}`,
    files: [],
    registryKeys: present.map(toRegistryTarget)
  });
  return {
    freedBytes: 0,
    registryKeysRemoved: manifest.registryKeys.length,
    quarantineBatch: manifest.batchDir,
    skipped: manifest.failedRegistryKeys.map((entry) => ({ path: describeTarget(entry), reason: 'protected or could not be removed' }))
  };
}

/** Removes one registry key or value -- executeAll() for a single action. */
export async function execute(action, ruleName) {
  return executeAll([action], ruleName);
}
