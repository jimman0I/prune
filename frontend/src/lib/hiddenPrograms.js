/** Programs the person has hidden from the Applications list, by a key that
 * survives the next read of the registry.
 *
 * The row's `id` is not that key. For a registry program it is the
 * Uninstall subkey's bare name, which is not unique across the three hives
 * -- programs.js's dedupeIds() suffixes the second "7-Zip" as "7-Zip#2", and
 * which one gets the suffix depends on the order the hives were read. A
 * hidden "7-Zip#2" could come back as the OTHER 7-Zip after an update. And a
 * Store app's id carries the package's full name, version included, so every
 * update would quietly unhide it.
 *
 * So, in order of what is genuinely stable:
 *   - a registry entry's full key path (`HKLM:\...\Uninstall\{GUID}`), which
 *     is where the entry lives and is unique by construction;
 *   - a Store app's package name without its version;
 *   - anything else's own id, which already is a full identity for those
 *     sources (an extension's browser, profile and extension id; an
 *     unregistered folder's path; another account's SID and key), with the
 *     dedupe suffix taken off in case one ever reaches them.
 *
 * Lowercased: registry paths and package names are case-insensitive, and a
 * key written as "HKLM:\SOFTWARE\Foo" one day and "...\foo" the next must not
 * be two different programs. Stored as an array of these strings in the
 * `hiddenPrograms` setting (normalized in backend/src/services/settings.js). */
export function programHideKey(program) {
  if (!program) return null;
  if (typeof program.registryKey === 'string' && program.registryKey.trim()) {
    return `reg:${program.registryKey.trim().toLowerCase()}`;
  }
  if (program.source === 'store' && typeof program.packageName === 'string' && program.packageName.trim()) {
    return `store:${program.packageName.trim().toLowerCase()}`;
  }
  if (typeof program.id === 'string' && program.id) {
    return `id:${program.id.replace(/#\d+$/, '').toLowerCase()}`;
  }
  return null;
}

/** Whether `program` is in `hidden` (a Set of keys). */
export function isProgramHidden(program, hidden) {
  const key = programHideKey(program);
  return key !== null && hidden.has(key);
}

/** The stored list with `program` added (once) or taken out. Returns the
 * list unchanged for a program with no key -- there is nothing to store. */
export function withProgramHidden(list, program, hide) {
  const current = Array.isArray(list) ? list : [];
  const key = programHideKey(program);
  if (key === null) return current;
  const rest = current.filter((entry) => entry !== key);
  return hide ? [...rest, key] : rest;
}
