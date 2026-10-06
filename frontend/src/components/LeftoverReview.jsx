import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { TIERS, tierOf, hasTiers, protectedCount } from '../lib/leftoverTiers.js';

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
export const DEFAULT_LEFTOVER_NOTE_MESSAGES = {
  valueOnly: (valueName) => `Only the value "${valueName}" — the key it sits in is shared and stays`,
  uninstallEntry: 'Add/Remove Programs entry'
};

export function leftoverItemNote(item, messages = DEFAULT_LEFTOVER_NOTE_MESSAGES) {
  if (item?.valueName) return messages.valueOnly(item.valueName);
  if (item?.isUninstallEntry) return messages.uninstallEntry;
  return null;
}

/** `scanResult` is { files, registryKeys, scheduledTasks }, each
 * { ok, items }. `selected` is a Set of "group:index" keys — all checked
 * by default is the caller's job (UninstallModal seeds it), not this
 * component's. */
export default function LeftoverReview({ scanResult, selected, onToggle, onConfirm, onSkip, destination = 'quarantine' }) {
  const { t } = useLanguage();

  const GROUPS = [
    { key: 'files', label: t('leftoverReview.groups.files') },
    { key: 'registryKeys', label: t('leftoverReview.groups.registryKeys') },
    // Removable: the backend saves the task's definition to the Backup
    // Manager before it unregisters it, so it can be put back.
    { key: 'scheduledTasks', label: t('leftoverReview.groups.scheduledTasks') },
    // Advanced scan only, and listed rather than removed: a service is taken
    // out with `sc delete` and administrator rights, and the wrong one can
    // stop Windows starting.
    { key: 'services', label: t('uninstallerV3.review.services'), removable: false }
  ];

  /** What the review says will happen to the ticked leftovers, by where the
   * dialog is sending them -- beside the button, because "Remove selected"
   * alone stopped saying whether a removal can be undone once the Recycle
   * Bin and permanent deletion became possible. */
  const DESTINATION_COPY = {
    quarantine: { text: t('leftoverReview.destinations.quarantine.text'), button: t('leftoverReview.destinations.quarantine.button'), danger: false },
    recycle: { text: t('leftoverReview.destinations.recycle.text'), button: t('leftoverReview.destinations.recycle.button'), danger: false },
    permanent: { text: t('leftoverReview.destinations.permanent.text'), button: t('leftoverReview.destinations.permanent.button'), danger: true }
  };

  /* Tiers: when the scan says how sure it is, the review is laid out by that
     first -- what the program's own folder vouches for, then what its name
     says, then the guesses -- and the type of leftover second. A scan with no
     tiers (an older result) is the flat list it always was. Possible starts
     collapsed: it is the part the person has to think about. */
  const tiered = hasTiers(scanResult);
  const sections = tiered ? TIERS : [null];
  const [openGroups, setOpenGroups] = useState({});
  const isOpen = (section, groupKey) => openGroups[`${section}:${groupKey}`] ?? section !== 'possible';

  const groupsWithItems = GROUPS
    .map(g => ({ ...g, group: scanResult[g.key] }))
    .filter(g => g.group?.ok && g.group.items.length > 0);
  const failedGroups = GROUPS.filter(g => scanResult[g.key] && !scanResult[g.key].ok);
  const withheld = protectedCount(scanResult);
  const searchedPartly = Boolean(scanResult?.files?.truncated);

  const totalItems = groupsWithItems.reduce((sum, g) => sum + g.group.items.length, 0);
  const selectedCount = selected.size;
  const copy = DESTINATION_COPY[destination] || DESTINATION_COPY.quarantine;
  // Folders the scan found and held back because they are in the user's
  // exclusions (routes/leftovers.js). Said, so a leftover the user expected
  // to see is not simply missing.
  const excluded = Number(scanResult?.files?.excluded) || 0;
  const excludedKeys = Number(scanResult?.registryKeys?.excluded) || 0;
  const selectedSize = groupsWithItems.reduce((sum, g) =>
    sum + g.group.items.reduce((s, item, i) =>
      selected.has(`${g.key}:${i}`) ? s + (item.sizeBytes || 0) : s, 0), 0);

  if (totalItems === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-4">{t('leftoverReview.clean')}</p>
        <button className="btn-primary" onClick={onSkip}>{t('leftoverReview.done')}</button>
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
        <div className="text-[12.5px] font-semibold text-[color:var(--warning)] leading-relaxed">
          {t('leftoverReview.foundWarning', totalItems)}
        </div>
      </div>

      {failedGroups.map(({ key, label }) => (
        <p key={key} className="text-[12px] text-[color:var(--text-muted)] mb-2">{t('leftoverReview.checkFailed', label.toLowerCase())}</p>
      ))}

      <div className="space-y-5">
        {sections.map((section) => {
          const rows = groupsWithItems
            .map((g) => ({
              ...g,
              entries: g.group.items.map((item, i) => ({ item, i })).filter(({ item }) => section === null || tierOf(item) === section)
            }))
            .filter((g) => g.entries.length > 0);
          if (rows.length === 0) return null;
          return (
        <section key={section ?? 'all'} data-tier={section ?? undefined}>
          {section && (
            <div className="mb-2 px-1">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-primary)]">
                {t(`uninstallerV3.review.tier.${section}`)}
              </h3>
              <p className="text-[12px] text-[color:var(--text-muted)] mt-0.5">{t(`uninstallerV3.review.tier.${section}Hint`)}</p>
            </div>
          )}
        <div className="space-y-3">
        {rows.map(({ key, label, group, removable = true, entries }) => {
          const open = isOpen(section, key);
          return (
            <div key={key} className="rounded-xl border border-[color:var(--border-subtle)] overflow-hidden bg-[color:var(--bg-panel)]">
              <button
                aria-expanded={open}
                onClick={() => setOpenGroups(o => ({ ...o, [`${section}:${key}`]: !open }))}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[color:var(--surface-subtle)] transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[color:var(--text-muted)] transition-transform ${open ? 'rotate-90' : ''}`}>
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span className="text-[13px] font-medium">{label}</span>
                <span className="text-[11px] text-[color:var(--text-muted)] font-mono">({entries.length})</span>
                {!removable && (
                  <span className="text-[11px] text-[color:var(--text-muted)] ml-auto">{t('leftoverReview.notRemoved')}</span>
                )}
              </button>
              {open && (
                <div className="divide-y divide-[color:var(--border-subtle)] border-t border-[color:var(--border-subtle)]">
                  {entries.map(({ item, i }) => {
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
                          <div className="font-mono text-[11.5px] text-[color:var(--text-primary)] truncate select-text">
                            {item.path || item.name}
                          </div>
                          {leftoverItemNote(item, t('leftoverReview.itemNote')) && (
                            // A path alone doesn't say what removing this
                            // does: an uninstall entry is the key that
                            // makes Windows list the program at all, and a
                            // value's path is a key shared with every
                            // other program that starts with Windows.
                            <div className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
                              {leftoverItemNote(item, t('leftoverReview.itemNote'))}
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
        </section>
          );
        })}
      </div>

      {withheld > 0 && (
        <p className="text-[12px] text-[color:var(--text-muted)] mt-4">{t('uninstallerV3.review.protectedNote', withheld)}</p>
      )}
      {searchedPartly && (
        <p className="text-[12px] text-[color:var(--text-muted)] mt-2">{t('uninstallerV3.review.truncatedNote')}</p>
      )}
      {excluded > 0 && (
        <p className="text-[12px] text-[color:var(--text-muted)] mt-4">
          {t('leftoverReview.excludedNote', excluded)}
        </p>
      )}
      {excludedKeys > 0 && (
        <p className="text-[12px] text-[color:var(--text-muted)] mt-2">
          {t('leftoverReview.registryExcludedNote', excludedKeys)}
        </p>
      )}
      {/* Sticky to the bottom of the dialog body, which is the scroll
          container (both dialogs cap their height and scroll the body). The
          list above can be hundreds of rows long; at 900x600 the buttons used
          to sit below the fold with no hint they existed. The consequence
          sentence travels with them so what a click does is always in view
          next to the click. The negative margins and matching padding are
          the body's own padding: sticky sticks to the scrollport edge, and
          without them list rows would scroll visibly through that gap. The
          background is the opaque panel colour for the same reason. */}
      <div
        data-leftover-actions
        className="sticky bottom-0 -mx-6 -mb-5 mt-4 px-6 pt-4 pb-5 bg-[color:var(--bg-panel)] border-t border-[color:var(--border-subtle)]"
      >
        <p className={`text-[12px] mb-3 ${copy.danger ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-secondary)]'}`}>
          {copy.text}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[12px] text-[color:var(--text-secondary)]">
            <span className="text-[color:var(--text-primary)] font-medium">{selectedCount}</span> {t('leftoverReview.itemsSelected')}
            {selectedSize > 0 && (
              <> · <span className="text-[color:var(--text-primary)] font-medium">{formatBytes(selectedSize)}</span> {t('leftoverReview.reclaimable')}</>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onSkip}>{t('leftoverReview.skip')}</button>
            <button className={`${copy.danger ? 'btn-danger' : 'btn-primary'} px-4 py-2 rounded-lg text-[12.5px] font-medium`} onClick={onConfirm}>
              {copy.button}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
