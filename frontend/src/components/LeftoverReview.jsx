import { useState } from 'react';

const GROUPS = [
  { key: 'files', label: 'Files & folders' },
  { key: 'registryKeys', label: 'Registry keys' },
  // Reported, never removed. Quarantine works by moving files and
  // exporting registry keys, both of which a restore can put back; a
  // scheduled task has no equivalent reversible operation, so offering a
  // checkbox here would promise something the removal can't deliver.
  { key: 'scheduledTasks', label: 'Scheduled tasks', removable: false }
];

function formatBytes(bytes) {
  if (!bytes) return null;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** The one line a leftover needs beyond its path, or nothing.
 *
 * Both cases are about a row whose path does not say what removing it
 * actually does. Everything else is exactly what it looks like. */
export function leftoverItemNote(item) {
  if (item?.valueName) {
    return `Only the value "${item.valueName}" — the key it sits in is shared and stays`;
  }
  if (item?.isUninstallEntry) return 'Add/Remove Programs entry';
  return null;
}

/** What the review says will happen to the ticked leftovers, by where the
 * dialog is sending them -- beside the button, because "Remove selected"
 * alone stopped saying whether a removal can be undone once the Recycle
 * Bin and permanent deletion became possible. */
const DESTINATION_COPY = {
  quarantine: {
    text: 'Selected items go to Quarantine, where you can restore them.',
    button: 'Remove selected',
    danger: false
  },
  recycle: {
    text: 'Selected files go to the Recycle Bin. Registry keys are backed up before they are removed.',
    button: 'Remove selected',
    danger: false
  },
  permanent: {
    text: "Selected files will be deleted permanently and can't be restored. Registry keys are backed up before they are removed.",
    button: 'Delete permanently',
    danger: true
  }
};

/** `scanResult` is { files, registryKeys, scheduledTasks }, each
 * { ok, items }. `selected` is a Set of "group:index" keys — all checked
 * by default is the caller's job (UninstallModal seeds it), not this
 * component's. */
export default function LeftoverReview({ scanResult, selected, onToggle, onConfirm, onSkip, destination = 'quarantine' }) {
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(GROUPS.map(g => [g.key, true]))
  );

  const groupsWithItems = GROUPS
    .map(g => ({ ...g, group: scanResult[g.key] }))
    .filter(g => g.group?.ok && g.group.items.length > 0);
  const failedGroups = GROUPS.filter(g => scanResult[g.key] && !scanResult[g.key].ok);

  const totalItems = groupsWithItems.reduce((sum, g) => sum + g.group.items.length, 0);
  const selectedCount = selected.size;
  const copy = DESTINATION_COPY[destination] || DESTINATION_COPY.quarantine;
  // Folders the scan found and held back because they are in the user's
  // exclusions (routes/leftovers.js). Said, so a leftover the user expected
  // to see is not simply missing.
  const excluded = Number(scanResult?.files?.excluded) || 0;
  const selectedSize = groupsWithItems.reduce((sum, g) =>
    sum + g.group.items.reduce((s, item, i) =>
      selected.has(`${g.key}:${i}`) ? s + (item.sizeBytes || 0) : s, 0), 0);

  if (totalItems === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-4">No leftovers found — clean uninstall.</p>
        <button className="btn-primary" onClick={onSkip}>Done</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[color:var(--warning)] mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div className="text-[12.5px] text-[color:var(--warning)] leading-relaxed">
          Found <span className="font-semibold text-[color:var(--text-primary)]">{totalItems} leftover items</span> the
          native uninstaller missed. Review before purging.
        </div>
      </div>

      {failedGroups.map(({ key, label }) => (
        <p key={key} className="text-[12px] text-[color:var(--text-muted)] mb-2">Couldn't check {label.toLowerCase()}.</p>
      ))}

      <div className="space-y-3">
        {groupsWithItems.map(({ key, label, group, removable = true }) => {
          const open = openGroups[key];
          return (
            <div key={key} className="rounded-xl border border-[color:var(--border-subtle)] overflow-hidden bg-[color:var(--bg-panel)]">
              <button
                onClick={() => setOpenGroups(o => ({ ...o, [key]: !o[key] }))}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[color:var(--surface-subtle)] transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[color:var(--text-muted)] transition-transform ${open ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span className="text-[13px] font-medium">{label}</span>
                <span className="text-[11px] text-[color:var(--text-muted)] font-mono">({group.items.length})</span>
                {!removable && (
                  <span className="text-[10.5px] text-[color:var(--text-muted)] ml-auto">found, not removed</span>
                )}
              </button>
              {open && (
                <div className="divide-y divide-[color:var(--border-subtle)] border-t border-[color:var(--border-subtle)]">
                  {group.items.map((item, i) => {
                    const itemKey = `${key}:${i}`;
                    const size = formatBytes(item.sizeBytes);
                    return (
                      <label
                        key={itemKey}
                        className={`flex items-center gap-3 px-4 py-2.5 transition ${removable ? 'cursor-pointer hover:bg-[color:var(--surface-subtle)]' : 'opacity-60'}`}
                      >
                        {/* The same square every other tickable
                            control in this app uses. This was the one
                            screen still on the native `.sleek` checkbox,
                            which is cyan -- so the review that decides
                            what gets deleted looked like a different
                            product from the list that selected it. */}
                        <input
                          type="checkbox"
                          className="prune-check"
                          checked={removable && selected.has(itemKey)}
                          disabled={!removable}
                          onChange={() => onToggle(itemKey)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[11.5px] text-[color:var(--text-primary)] truncate">
                            {item.path || item.name}
                          </div>
                          {leftoverItemNote(item) && (
                            // A path alone doesn't say what removing this
                            // does: an uninstall entry is the key that
                            // makes Windows list the program at all, and a
                            // value's path is a key shared with every
                            // other program that starts with Windows.
                            <div className="text-[10.5px] text-[color:var(--accent-primary)] mt-0.5">
                              {leftoverItemNote(item)}
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-[color:var(--text-muted)] shrink-0">
                          {size || label.toUpperCase()}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {excluded > 0 && (
        <p className="text-[12px] text-[color:var(--text-muted)] mt-4">
          {`${excluded} folder${excluded === 1 ? '' : 's'} left out because ${excluded === 1 ? "it's" : "they're"} in your exclusions.`}
        </p>
      )}
      <p className={`text-[12px] mt-4 ${copy.danger ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-secondary)]'}`}>
        {copy.text}
      </p>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[color:var(--border-subtle)]">
        <div className="text-[12px] text-[color:var(--text-secondary)]">
          <span className="text-[color:var(--text-primary)] font-medium">{selectedCount}</span> items selected
          {selectedSize > 0 && (
            <> · <span className="text-[color:var(--accent-primary)] font-medium">{formatBytes(selectedSize)}</span> reclaimable</>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onSkip}>Skip</button>
          <button className={`${copy.danger ? 'btn-danger' : 'btn-primary'} px-4 py-2 rounded-lg text-[12.5px] font-medium`} onClick={onConfirm}>
            {copy.button}
          </button>
        </div>
      </div>
    </div>
  );
}
