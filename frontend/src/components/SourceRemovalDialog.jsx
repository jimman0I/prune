import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { appendHistoryEntry } from '../lib/api.js';
import { removeSourceItem } from '../lib/programSourcesApi.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The question in front of removing a Chocolatey package, turning off a
 * Windows feature or uninstalling a Windows update.
 *
 * The last two change Windows itself rather than a program on it, so the
 * dialog says so in those words and says what Prune does first: a restore
 * point. When none could be made (System Protection off, say) the backend
 * changes nothing and answers needsConsent; the dialog then asks a second,
 * separate question, and only a yes to that sends the removal again without
 * one. A cancelled UAC prompt is not an error -- nothing changed, and the
 * dialog says that and stays open.
 *
 * Sits in the parent's ModalOverlay like every other dialog here. */

const kindOf = (item) => (item.source === 'feature' || item.source === 'update' ? item.source : 'chocolatey');

export default function SourceRemovalDialog({ item, onClose, onRemoved, onBusyChange }) {
  const { t } = useLanguage();
  // asking -> working -> (consent -> working) -> done
  const [state, setState] = useState('asking');
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const [consentReason, setConsentReason] = useState('');
  const [restartNeeded, setRestartNeeded] = useState(false);
  const kind = kindOf(item);
  const cancelRef = useRef(null);

  const busy = state === 'working';
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => { onBusyChangeRef.current?.(busy); }, [busy]);
  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  // The button just pressed now reads 'Continue without a restore point'. Left
  // focused, a second Enter would skip the restore point without the question
  // ever being read, so focus moves to the safe choice.
  useEffect(() => { if (state === 'consent') cancelRef.current?.focus(); }, [state]);

  const run = useSingleFlight(async (allowWithoutRestorePoint) => {
    const from = state;
    setState('working');
    setError(null);
    setNote(null);
    try {
      const result = await removeSourceItem(item, { allowWithoutRestorePoint });
      if (result.needsConsent) {
        setConsentReason(result.reason || '');
        setState('consent');
        return;
      }
      if (result.cancelled) {
        setNote(t('sourcesV4.dialog.cancelledByUser'));
        setState(from);
        return;
      }
      setRestartNeeded(Boolean(result.restartNeeded));
      setState('done');
      appendHistoryEntry({
        kind, programName: item.name, publisher: item.publisher, version: item.version,
        sizeBytes: item.sizeBytes ?? undefined, outcome: 'uninstalled',
        ...(result.restorePoint ? { restorePoint: result.restorePoint } : {})
      }).catch(() => {});
      onRemoved?.(item);
    } catch (err) {
      setState(from);
      setError(err.message);
    }
  });

  const heading = kind === 'feature' ? t('sourcesV4.dialog.featureHeading', item.name)
    : kind === 'update' ? t('sourcesV4.dialog.updateHeading', item.name)
      : t('sourcesV4.dialog.chocoHeading', item.name);
  const body = kind === 'feature' ? t('sourcesV4.dialog.featureBody')
    : kind === 'update' ? t('sourcesV4.dialog.updateBody')
      : t('sourcesV4.dialog.chocoBody');
  const confirmLabel = kind === 'feature' ? t('sourcesV4.dialog.confirmFeature')
    : kind === 'update' ? t('sourcesV4.dialog.confirmUpdate')
      : t('sourcesV4.dialog.confirmChoco');

  return (
    <div className="glass-panel w-full max-w-[520px] p-6 rounded-xl">
      <h2 className="display-heading text-[19px] mb-1">{heading}</h2>

      {state === 'done' ? (
        <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed mb-5" role="status">
          {restartNeeded ? t('sourcesV4.dialog.doneRestart') : t('sourcesV4.dialog.done')}
        </p>
      ) : state === 'consent' ? (
        <div className="mb-5" role="alert">
          <p className="text-[13px] text-[color:var(--warning)] leading-relaxed mb-2 select-text">
            {t('sourcesV4.dialog.noRestorePoint', consentReason)}
          </p>
          <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed">
            {t('sourcesV4.dialog.noRestorePointAsk')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed mb-2">{body}</p>
          <p className="text-[12px] text-[color:var(--text-muted)] leading-relaxed mb-5">{t('sourcesV4.dialog.adminNote')}</p>
        </>
      )}

      {note && <p className="text-[12px] text-[color:var(--text-secondary)] leading-snug mb-4" role="status">{note}</p>}
      {error && <div className="text-[12px] text-[color:var(--danger)] leading-snug mb-4 select-text" role="alert">{error}</div>}

      <div className="flex justify-end gap-2">
        <button ref={cancelRef} type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] disabled:opacity-40" onClick={onClose} disabled={busy}>
          {state === 'done' ? t('sourcesV4.dialog.close') : t('sourcesV4.dialog.cancel')}
        </button>
        {state !== 'done' && (
          <button
            type="button"
            className="btn-danger px-3 py-1.5 rounded-md text-[12.5px] font-medium"
            aria-busy={busy || undefined}
            onClick={() => run(state === 'consent')}
          >
            {busy ? t('sourcesV4.dialog.working')
              : state === 'consent' ? t('sourcesV4.dialog.continueWithout')
                : confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}
