/** What `removeQuarantined` needs to delete one dead startup entry, or
 * null when this entry cannot be removed from here.
 *
 * Scoped to exactly the two sources startupToggle.js already knows how to
 * write -- a registry Run value or a Startup-folder shortcut -- and only
 * once the entry is confirmed gone (`exists === false`). A live entry
 * stays a toggle, never a delete: disabling is reversible because the Run
 * value and the shortcut stay exactly where they are, and offering delete
 * on a live entry would be the "one-way door dressed up as a switch" that
 * module's own doc comment already refuses. A task, service or Store app
 * is read-only here for the same reason toggleRefusal() gives them their
 * own sentence instead of a switch: none of them are things this app
 * knows how to write. */
export function startupRemovalTarget(item) {
  if (!item || item.exists !== false) return null;

  if (item.source === 'registry') {
    if (!item.registryKey || !item.approvedName) return null;
    return { files: [], registryKeys: [{ path: item.registryKey, valueName: item.approvedName }] };
  }

  if (item.source === 'folder') {
    if (!item.command) return null;
    return { files: [item.command], registryKeys: [] };
  }

  return null;
}
