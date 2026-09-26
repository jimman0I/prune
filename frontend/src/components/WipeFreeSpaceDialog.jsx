import { useEffect, useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import { fetchWipeEstimate } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** The question in front of the free-space wipe.
 *
 * Same shape as CleanWarningDialog -- it is that dialog's pattern -- with
 * two differences that come from what the wipe is. It loses nothing, so
 * there is no "loses data" line; what it costs is hours of writing and, on
 * an SSD, wear, so those are the facts on screen, with real numbers: the
 * drive, how much will be written, and a time from a one-second write test
 * the backend just ran. And there is no "remember my choice": it is asked
 * every time, by design.
 *
 * Nothing runs when this is confirmed. It only adds the wipe to the next
 * Clean, which has its own confirmation. */
export default function WipeFreeSpaceDialog({ onCancel, onConfirm }) {
  const { t } = useLanguage();
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    fetchWipeEstimate()
      .then((data) => { if (live) setEstimate(data); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, []);

  const minutesTotal = estimate ? Math.max(1, Math.round(estimate.seconds / 60)) : 0;
  const duration = t('deepClean.wipe.duration', Math.floor(minutesTotal / 60), minutesTotal % 60);
  const title = t('deepClean.wipe.title');

  return (
    <ModalOverlay label={title} onClose={onCancel}>
      <div className="glass-panel w-[460px] max-w-full p-6">
        <h2 className="text-[15px] font-medium text-[color:var(--text-primary)]">{title}</h2>

        <p className="text-[13px] text-[color:var(--text-secondary)] mt-3">{t('deepClean.wipe.body')}</p>
        {/* The SSD line is the one most likely to change the decision, so it
            is set apart and in the warning colour rather than folded into
            the paragraph above. */}
        <p className="text-[13px] text-[color:var(--warning)] mt-3">{t('deepClean.wipe.ssdWarning')}</p>

        <div className="mt-4 space-y-1 text-[12.5px] text-[color:var(--text-primary)]" aria-live="polite">
          {!estimate && !error && <p className="text-[color:var(--text-muted)]">{t('deepClean.wipe.measuring')}</p>}
          {error && <p className="text-[color:var(--danger)] select-text">{t('deepClean.wipe.estimateFailed', error)}</p>}
          {estimate && (
            <>
              <p className="font-mono">{t('deepClean.wipe.driveLine', estimate.drive)}</p>
              <p>{t('deepClean.wipe.writeLine', formatBytes(estimate.bytesToWrite))}</p>
              {estimate.bytesToWrite > 0 && (
                <p>{t('deepClean.wipe.timeLine', duration, `${formatBytes(estimate.bytesPerSecond)}/s`)}</p>
              )}
              <p className="text-[color:var(--text-secondary)]">{t('deepClean.wipe.reserveLine', formatBytes(estimate.reserveBytes))}</p>
            </>
          )}
        </div>

        <p className="text-[12.5px] text-[color:var(--text-muted)] mt-3">{t('deepClean.wipe.stopNote')}</p>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onCancel}>
            {t('deepClean.wipe.cancel')}
          </button>
          <button className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={() => onConfirm(false)}>
            {t('deepClean.wipe.confirm')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
