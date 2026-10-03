import { useEffect, useRef, useState } from 'react';
import { endHuntedProcess, revealInExplorer, setStartupItemEnabled } from '../lib/api.js';
import { startHunter, cancelHunter, onHunterResult } from '../lib/hunterBridge.js';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import AdminRestartButton from './AdminRestartButton.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** A window Windows would not describe: usually one running as administrator
 * while Prune is not. The restart offer is the useAdminAccess() rule -- only
 * once the status was read and says Prune is not elevated. */
function UnreadableResult() {
  const { t } = useLanguage();
  const admin = useAdminAccess();
  return (
    <>
      <p role="status" className="text-[13px] text-[color:var(--text-secondary)] mb-4">{t('uninstallerV3.hunter.unreadable')}</p>
      <div className="mb-5"><AdminRestartButton admin={admin} /></div>
    </>
  );
}

/** Hunter: drag a crosshair onto any window and Prune says which program it
 * belongs to.
 *
 * Starting a hunt asks the desktop app to minimise Prune and open a small
 * always-on-top crosshair (electron/hunterWidget.cjs). The person drags it
 * onto a window and lets go; Prune comes back with the answer: the process,
 * the installed program it belongs to if there is one, and what can be done
 * with it. Esc or the crosshair's cross cancels. Nothing is clicked in the
 * window underneath, so hunting for a program cannot press that program's
 * buttons. The answer arrives as an event from the main process, so this
 * dialog only starts, waits, and shows. */
export default function HunterDialog({ programs = [], onClose, onUninstall, onForced, onBusyChange }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState('intro'); // intro | hunting | result
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const alive = useRef(true);
  const hunting = useRef(false);

  useEffect(() => {
    alive.current = true;
    // One subscription for the life of the dialog: the main process sends the
    // answer to the window, whenever the crosshair is dropped.
    const stopListening = onHunterResult((outcome) => {
      if (!alive.current) return;
      hunting.current = false;
      setResult(outcome);
      setPhase('result');
    });
    return () => {
      alive.current = false;
      stopListening();
      // Closing the dialog must not leave a crosshair on the screen.
      if (hunting.current) cancelHunter();
    };
  }, []);

  const busy = phase === 'hunting';
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => { onBusyChangeRef.current?.(busy); }, [busy]);
  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  const hunt = async () => {
    setError(null); setNotice(null); setConfirmEnd(false); setResult(null);
    setPhase('hunting');
    hunting.current = true;
    const outcome = await startHunter({
      hint: t('uninstallerV3.hunter.widgetHint'),
      cancel: t('uninstallerV3.hunter.widgetCancel')
    });
    if (!alive.current || outcome.ok) return;
    hunting.current = false;
    setError(outcome.unsupported ? t('uninstallerV3.hunter.needsApp') : t('uninstallerV3.hunter.failed', outcome.error || ''));
    setPhase((current) => (current === 'hunting' ? 'intro' : current));
  };

  const cancelHunt = async () => {
    await cancelHunter();
    if (!alive.current) return;
    hunting.current = false;
    setResult({ status: 'cancelled' });
    setPhase('result');
  };
  const picked = result?.status === 'picked' ? result : null;
  const program = picked?.program ? (programs.find((p) => p.id === picked.program.id) ?? picked.program) : null;
  const isPrune = picked?.endRefusal && /Prune itself/i.test(picked.endRefusal);
  const folder = picked?.exePath ? picked.exePath.replace(/[\\/][^\\/]*$/, '') : '';
  const enabledStartup = (picked?.startupItems || []).filter((item) => item.enabled);

  const disableStartup = async (item) => {
    setError(null); setNotice(null);
    const outcome = await setStartupItemEnabled(item.id, false);
    if (outcome?.ok) setNotice(t('uninstallerV3.hunter.startupDisabled', item.name));
    else if (!outcome?.cancelled) setError(t('uninstallerV3.hunter.startupFailed', outcome?.error || ''));
    setResult((current) => current && ({
      ...current,
      startupItems: current.startupItems.map((s) => (s.id === item.id && outcome?.ok ? { ...s, enabled: false } : s))
    }));
  };

  const endProcess = async () => {
    setError(null); setNotice(null);
    const outcome = await endHuntedProcess(picked.pid, picked.exePath);
    setConfirmEnd(false);
    if (outcome.ok) setNotice(t('uninstallerV3.hunter.ended', picked.name || ''));
    else setError(t('uninstallerV3.hunter.endFailed', outcome.error || ''));
  };

  const openFolder = async () => {
    setError(null);
    try { await revealInExplorer(picked.exePath); } catch (err) { setError(err.message); }
  };

  return (
    <div data-modal-panel className="glass-panel rounded-2xl overflow-hidden max-w-[560px] w-full flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">{t('uninstallerV3.hunter.title')}</h2>
        <button type="button" onClick={onClose} disabled={busy} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40">
          {t('uninstallModal.close')}
        </button>
      </div>

      <div data-modal-body className="px-6 py-5 overflow-y-auto min-h-0">
        {phase === 'intro' && (
          <>
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">{t('uninstallerV3.hunter.intro')}</p>
            {error && <p role="alert" className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{error}</p>}
            <button type="button" className="btn-primary" onClick={hunt}>{t('uninstallerV3.hunter.start')}</button>
          </>
        )}

        {phase === 'hunting' && (
          <div role="status" className="flex flex-col items-center py-8">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[13px] text-[color:var(--text-secondary)] text-center mb-4">{t('uninstallerV3.hunter.hunting')}</p>
            <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={cancelHunt}>
              {t('uninstallerV3.hunter.cancel')}
            </button>
          </div>
        )}

        {phase === 'result' && result && (
          <>
            {result.status === 'unreadable' && <UnreadableResult />}

            {!picked && result.status !== 'unreadable' && (
              <p role="status" className="text-[13px] text-[color:var(--text-secondary)] mb-5">
                {result.status === 'nothing' ? t('uninstallerV3.hunter.nothing')
                  : result.status === 'cancelled' ? t('uninstallerV3.hunter.cancelled')
                    : t('uninstallerV3.hunter.noWindow')}
              </p>
            )}

            {picked && (
              <>
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-panel)] px-4 py-3 mb-5">
                  <div className="text-[13px] font-medium truncate">{picked.title || picked.name || '—'}</div>
                  <div className="text-[11.5px] text-[color:var(--text-muted)] font-mono break-all select-text mt-0.5">{picked.exePath || picked.name}</div>
                </div>

                <p className="text-[13px] text-[color:var(--text-primary)] mb-4">
                  {isPrune ? t('uninstallerV3.hunter.isPrune')
                    : program ? t('uninstallerV3.hunter.belongsTo', program.name)
                      : t('uninstallerV3.hunter.notInstalled')}
                </p>

                {notice && <p role="status" className="text-[12.5px] text-[color:var(--success)] mb-3">{notice}</p>}
                {error && <p role="alert" className="text-[12.5px] text-[color:var(--danger)] mb-3 select-text">{error}</p>}

                {!isPrune && (
                  <div className="flex flex-wrap gap-2">
                    {program && (
                      <button type="button" className="btn-remove" onClick={() => onUninstall?.(program)}>{t('applications.uninstall')}</button>
                    )}
                    {folder && (
                      <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => onForced?.({ name: program?.name || '', folder: program?.installLocation || folder })}>
                        {t('uninstallerV3.forced.button')}
                      </button>
                    )}
                    {enabledStartup.map((item) => (
                      <button key={item.id} type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => disableStartup(item)}>
                        {t('uninstallerV3.hunter.disableStartup', item.name)}
                      </button>
                    ))}
                    {picked.exePath && (
                      <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={openFolder}>{t('applications.openFolder')}</button>
                    )}
                    {!picked.endRefusal && (
                      confirmEnd ? (
                        <span className="flex items-center gap-2">
                          <span className="text-[12px] text-[color:var(--danger)]">{t('uninstallerV3.hunter.endConfirm')}</span>
                          <button type="button" className="btn-danger px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={endProcess}>{t('uninstallerV3.hunter.endNow')}</button>
                          <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirmEnd(false)}>{t('uninstallerV3.hunter.keep')}</button>
                        </span>
                      ) : (
                        <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirmEnd(true)}>{t('uninstallerV3.hunter.endProcess')}</button>
                      )
                    )}
                  </div>
                )}
              </>
            )}

            <div className="mt-6">
              <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={hunt}>{t('uninstallerV3.hunter.again')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
