import { useLanguage } from '../i18n/LanguageContext.jsx';

/** "Restart Prune as administrator", and how it went.
 *
 * Takes the result of useAdminAccess(), so it appears only inside the desktop
 * app and only once the status has been read and says Prune is not elevated
 * -- never beside a Prune that is already running as administrator. A declined
 * prompt is an answer, not an error: nothing changed, and it says so. The
 * words are the Disk Map's, which asks the same question. */
export default function AdminRestartButton({ admin }) {
  const { t } = useLanguage();
  if (!admin.canRestart && !admin.outcome) return null;
  return (
    <>
      {admin.canRestart && (
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
          onClick={admin.restart}
          disabled={admin.restarting}
        >
          {admin.restarting ? t('diskMapV3.elevation.restarting') : t('diskMapV3.elevation.restartButton')}
        </button>
      )}
      {admin.outcome?.kind === 'declined' && (
        <p role="status" className="text-[12.5px] text-[color:var(--warning)] mt-2">{t('diskMapV3.elevation.restartDeclined')}</p>
      )}
      {admin.outcome?.kind === 'failed' && (
        <p role="status" className="text-[12.5px] text-[color:var(--warning)] mt-2 select-text">
          {t('diskMapV3.elevation.restartFailed', admin.outcome.error)}
        </p>
      )}
    </>
  );
}
