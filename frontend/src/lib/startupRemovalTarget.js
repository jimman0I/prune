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
  return entryAddress(item);
}

/** The same address for an entry that is switched OFF, whatever its file
 * check said -- what "Remove N disabled" sends.
 *
 * The one place a live entry is deleted, and the reason it is not the
 * one-way door the comment above refuses: it is never a row's own control,
 * only the screen's bulk command, and it goes to Quarantine as one batch
 * whose single Undo puts every value and shortcut back. Switched off is the
 * person's own earlier "I don't want this at sign-in"; removing those
 * entries is tidying up after that decision, not making it for them.
 *
 * The StartupApproved value that records the "off" is left where it is, on
 * purpose. It is what makes Undo exact: the Run value or shortcut comes
 * back and Windows still reads it as switched off, rather than an entry
 * the person had disabled quietly starting again at the next sign-in. A
 * StartupApproved value with nothing to describe is ignored by Windows.
 *
 * Only an exact `false`: an entry whose state could not be read is not
 * "disabled", and tasks, services and Store apps stay switches for the
 * reason above -- nothing here can delete one. */
export function disabledRemovalTarget(item) {
  if (!item || item.enabled !== false) return null;
  return entryAddress(item);
}

/** Where a registry or Startup-folder entry lives, in removeQuarantined's
 * shape, or null for a source this app cannot write. For a folder entry the
 * command IS the shortcut (startupItems.js lists the .lnk itself), so the
 * file removed is the shortcut and never the program it points at. */
function entryAddress(item) {
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
