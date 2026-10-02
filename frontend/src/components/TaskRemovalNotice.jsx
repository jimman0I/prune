import { useLanguage } from '../i18n/LanguageContext.jsx';

/** What happened to the scheduled tasks in a removal, said under the summary
 * of the files and keys. Renders nothing when no task was part of it.
 *
 * Removed tasks are reassured about where their definitions went (the
 * Backups tab), and a task that could not go is named with the reason --
 * one that needed administrator approval and did not get it is the common
 * case, and the sentence says so rather than leaving a quiet failure. */
export default function TaskRemovalNotice({ result }) {
  const { t } = useLanguage();
  if (!result) return null;
  const removed = result.removed?.length ?? 0;
  const failed = result.failed ?? [];
  if (removed === 0 && failed.length === 0) return null;

  return (
    <>
      {removed > 0 && (
        <p className="text-[12px] text-[color:var(--text-secondary)] mb-5" data-task-removed>
          {t('uninstallerV3.tasks.removed', removed)}
        </p>
      )}
      {failed.length > 0 && (
        <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25 text-[12.5px] text-[color:var(--warning)]">
          <p>{t('uninstallerV3.tasks.failedHeading', failed.length)}</p>
          {failed.map((task) => (
            <p key={`${task.path}${task.name}`} className="mt-1 font-mono text-[11px] text-[color:var(--text-secondary)] break-all select-text">
              {`${task.path || ''}${task.name || ''} — ${task.reason}`}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
