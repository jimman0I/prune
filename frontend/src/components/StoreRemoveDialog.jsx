import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { removeStoreApp, appendHistoryEntry } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The question in front of removing a Store app.
 *
 * Every other removal in this app is reversible: files go to Quarantine
 * and registry keys are exported before deletion, so a wrong match can be
 * put back. This one is not. Remove-AppxPackage takes the package and its
 * local app data with it, and the way back is reinstalling from the Store
 * and signing in again.
 *
 * So the dialog says that, rather than asking a generic "are you sure".
 * The one thing the user cannot work out for themselves is which of the
 * two kinds of removal this is, and it is the thing that decides whether
 * they should click.
 *
 * Sits in the parent's ModalOverlay like every other dialog here, which
 * is what gives it role="dialog", a focus trap, Escape, and focus handed
 * back to the row that opened it.
 */
export default function StoreRemoveDialog({ app, onClose, onRemoved, onBusyChange }) {
  const { t } = useLanguage();
  const [state, setState] = useState('asking');
  const [error, setError] = useState(null);

  /* While Remove-AppxPackage runs this dialog is the only thing that knows
   * it is running, so the parent is told (Escape then does not close it) and
   * Cancel refuses below. */
  const busy = state === 'removing';
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => { onBusyChangeRef.current?.(busy); }, [busy]);
  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  // Single-flight, not a read of `state`: a second Enter on a focused button
  // lands before the re-render that would have shown 'removing'.
  const confirm = useSingleFlight(async () => {
    setState('removing');
    setError(null);
    try {
      await removeStoreApp(app.packageFullName);
      // Logged like every other removal, so the dashboard's record of what
      // past removals freed does not depend on which dialog was used. And
      // like every other removal, a logging failure never turns a removal
      // that worked into an error -- the app is gone either way.
      appendHistoryEntry({ programName: app.name, publisher: app.publisher, sizeBytes: app.sizeBytes })
        .catch(() => {});
      setState('done');
      onRemoved?.(app);
    } catch (err) {
      setState('asking');
      setError(err.message);
    }
  });

  return (
    <div className="glass-panel w-full max-w-[520px] p-6 rounded-xl">
      <h2 className="display-heading text-[19px] mb-1">{t('applications.storeRemoveDialog.heading', app.name)}</h2>

      <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed mb-3">
        {t('applications.storeRemoveDialog.body')}
      </p>

      <p className="text-[11.5px] font-mono text-[color:var(--text-muted)] break-all mb-5 select-text">
        {app.packageFullName}
      </p>

      {error && (
        <div className="text-[12px] text-[color:var(--danger)] leading-snug mb-4 select-text">
          {/* Windows' own words. It refuses for ordinary reasons — the app
              is running, the package was provisioned for every user — and
              which one it was is the only useful thing to show. */}
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] disabled:opacity-40" onClick={onClose} disabled={busy}>
          {state === 'done' ? t('applications.storeRemoveDialog.close') : t('applications.storeRemoveDialog.cancel')}
        </button>
        {state !== 'done' && (
          <button
            type="button"
            className="btn-danger px-3 py-1.5 rounded-md text-[12.5px] font-medium"
            aria-busy={state === 'removing' || undefined}
            onClick={confirm}
          >
            {state === 'removing' ? t('applications.storeRemoveDialog.removing') : t('applications.storeRemoveDialog.removeApp')}
          </button>
        )}
      </div>
    </div>
  );
}
