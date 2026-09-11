import { useState } from 'react';
import { removeStoreApp, appendHistoryEntry } from '../lib/api.js';

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
export default function StoreRemoveDialog({ app, onClose, onRemoved }) {
  const [state, setState] = useState('asking');
  const [error, setError] = useState(null);

  const confirm = async () => {
    // Guarded rather than relying on the button disappearing: a second
    // Enter on a focused button is faster than a re-render.
    if (state === 'removing') return;
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
  };

  return (
    <div className="glass-panel w-full max-w-[520px] p-6 rounded-xl">
      <h2 className="display-heading text-[19px] mb-1">Remove {app.name}?</h2>

      <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed mb-3">
        This removes the app for your account, along with its settings and
        saved data. Unlike everything else Prune removes, it does not go to
        Quarantine and cannot be restored from here — getting it back means
        installing it again from the Microsoft Store.
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
        <button type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px]" onClick={onClose}>
          {state === 'done' ? 'Close' : 'Cancel'}
        </button>
        {state !== 'done' && (
          <button
            type="button"
            className="btn-danger px-3 py-1.5 rounded-md text-[12.5px] font-medium"
            aria-busy={state === 'removing' || undefined}
            onClick={confirm}
          >
            {state === 'removing' ? 'Removing…' : 'Remove app'}
          </button>
        )}
      </div>
    </div>
  );
}
