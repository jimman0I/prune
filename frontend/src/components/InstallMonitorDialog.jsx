import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  pickPath, startInstallMonitor, fetchInstallMonitor, finishInstallMonitor, cancelInstallMonitor, deleteInstallTrace,
  exportInstallTraces, importInstallTraces
} from '../lib/api.js';
import { useInstallTraces } from '../hooks/useSystemQueries.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { keys } from '../lib/queryClient.js';
import { saveBlob } from '../lib/download.js';
import { traceFileName, traceInstalledHere, TRACE_FILE_EXTENSION } from '../lib/installTraces.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const POLL_MS = 1500;
/** The same cap the backend enforces (services/installTraceFile.js), checked
 * here first so a huge file is never read into the window to be refused. */
const MAX_TRACE_FILE_BYTES = 16 * 1024 * 1024;
const IMPORT_CODES = new Set(['tooLarge', 'notJson', 'notTraceFile', 'newerVersion', 'tooMany']);
const SMALL_BUTTON = 'btn-ghost px-2.5 py-1 rounded-md text-[11.5px] font-medium shrink-0 disabled:opacity-40';

function readText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Install with monitoring.
 *
 * The dialog is a window onto a monitor that lives in the backend, so it can
 * be closed while an installer runs and reopened to find it where it was: on
 * open it asks where the monitor is rather than assuming it is idle. While
 * the installer runs the dialog polls; it never blocks on it.
 *
 * "Done installing" is always there. A bootstrapper that hands off to another
 * process closes within seconds while the real installation carries on, so a
 * quick exit waits for the person instead of snapshotting too early.
 *
 * The recorded installs can be exported, one or all, to a `.prunetraces` file
 * and imported back -- after reinstalling Windows, or on another PC with the
 * same programs. `programs` is the Applications list, so a record whose
 * program is not on this PC says so. */
export default function InstallMonitorDialog({ onClose, onBusyChange, programs = [] }) {
  const { t } = useLanguage();
  const toasts = useToasts();
  const queryClient = useQueryClient();
  const { traces } = useInstallTraces();
  const [transferring, setTransferring] = useState(false);
  const [fileError, setFileError] = useState(null);
  const importRef = useRef(null);
  const [installerPath, setInstallerPath] = useState('');
  const [session, setSession] = useState({ state: 'idle' });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // While the first snapshot is being taken Escape should not close the
  // dialog: the request is in flight and the monitor is about to start.
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => { onBusyChangeRef.current?.(starting); }, [starting]);
  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchInstallMonitor();
      if (alive.current) setSession(next);
      if (next.state === 'done') queryClient.invalidateQueries({ queryKey: keys.installTraces });
    } catch {
      // A missed poll is not worth a message; the next one will do.
    }
  }, [queryClient]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!['installing', 'exited', 'analyzing'].includes(session.state)) return undefined;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [session.state, refresh]);

  const browse = async () => {
    setError(null);
    try {
      const { path } = await pickPath('installer');
      if (path) setInstallerPath(path);
    } catch (err) {
      setError(t('uninstallerV3.monitor.pickFailed', err.message));
    }
  };

  const start = async (event) => {
    event?.preventDefault();
    if (!installerPath.trim() || starting) return;
    setError(null);
    setStarting(true);
    try {
      const next = await startInstallMonitor(installerPath.trim());
      if (alive.current) setSession(next);
    } catch (err) {
      if (alive.current) setError(t('uninstallerV3.monitor.startFailed', err.message));
    } finally {
      if (alive.current) setStarting(false);
    }
  };

  const finish = async () => {
    setError(null);
    try { setSession(await finishInstallMonitor()); } catch (err) { setError(err.message); }
  };
  const cancel = async () => {
    setError(null);
    try { setSession(await cancelInstallMonitor()); } catch (err) { setError(err.message); }
  };
  const removeTrace = async (trace) => {
    setError(null);
    try {
      await deleteInstallTrace(trace.id);
    } catch (err) {
      setError(err.message);
    }
    queryClient.invalidateQueries({ queryKey: keys.installTraces });
  };

  /** One trace (`trace`) or all of them. The backend builds the file and the
   * window saves it, the way Startup's and Disk Map's exports do. */
  const exportTraces = async (trace) => {
    setFileError(null);
    setTransferring(true);
    try {
      const file = await exportInstallTraces(trace?.id);
      const name = trace ? traceFileName(trace.programName ?? null) : traceFileName(undefined);
      // Compact, not indented: the import's size cap is on the text, and an
      // export should always fit back through it.
      saveBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), name);
    } catch (err) {
      if (alive.current) setFileError(t('uninstallerV3.monitor.traceFile.exportFailed', err.message));
    } finally {
      if (alive.current) setTransferring(false);
    }
  };

  const importTraces = async (event) => {
    const file = event.target.files?.[0];
    // So choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_TRACE_FILE_BYTES) {
      setFileError(t('uninstallerV3.monitor.traceFile.error.tooLarge'));
      return;
    }
    setTransferring(true);
    try {
      const { imported, skipped, rejected } = await importInstallTraces(await readText(file));
      const message = t('uninstallerV3.monitor.traceFile.importedToast', imported, skipped, rejected);
      if (rejected > 0) toasts.warn(message);
      else if (imported > 0) toasts.success(message);
      else toasts.info(message);
    } catch (err) {
      if (alive.current) {
        setFileError(IMPORT_CODES.has(err.code)
          ? t(`uninstallerV3.monitor.traceFile.error.${err.code}`)
          : t('uninstallerV3.monitor.traceFile.importFailed', err.message));
      }
    } finally {
      if (alive.current) setTransferring(false);
      queryClient.invalidateQueries({ queryKey: keys.installTraces });
    }
  };

  const state = session.state;
  const running = ['installing', 'exited', 'analyzing'].includes(state);
  const result = state === 'done' ? session.trace : null;

  return (
    <form
      onSubmit={start}
      data-modal-panel
      className="glass-panel rounded-2xl overflow-hidden max-w-[600px] w-full flex flex-col max-h-[85vh]"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">{t('uninstallerV3.monitor.title')}</h2>
        <button type="button" onClick={onClose} disabled={starting} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40">
          {t('uninstallModal.close')}
        </button>
      </div>

      <div data-modal-body className="px-6 py-5 overflow-y-auto min-h-0">
        {!running && !starting && (
          <>
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">{t('uninstallerV3.monitor.intro')}</p>

            {state === 'done' && result && (
              <div role="status" className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25 text-[12.5px] text-[color:var(--success)] leading-relaxed">
                <p>{result.programName ? t('uninstallerV3.monitor.doneLinked', result.programName) : t('uninstallerV3.monitor.doneUnlinked')}</p>
                <p className="mt-1">{t('uninstallerV3.monitor.doneCounts', result.fileCount, result.registryCount, result.taskCount, result.serviceCount)}</p>
                {result.partial && <p className="mt-1">{t('uninstallerV3.monitor.partialNote')}</p>}
              </div>
            )}
            {state === 'failed' && (
              <p role="alert" className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('uninstallerV3.monitor.failed', session.error || '')}</p>
            )}

            <label htmlFor="monitor-installer" className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">
              {t('uninstallerV3.monitor.installerLabel')}
            </label>
            <div className="flex items-center gap-2 mb-4">
              <input
                id="monitor-installer"
                value={installerPath}
                onChange={(event) => setInstallerPath(event.target.value)}
                placeholder={t('uninstallerV3.monitor.installerPlaceholder')}
                className="flex-1 min-w-0 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[13px] font-mono placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)] focus:ring-4 focus:ring-[color:var(--accent-primary)]/10 transition"
              />
              <button type="button" onClick={browse} className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0">
                {t('uninstallerV3.forced.browse')}
              </button>
            </div>
            {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{error}</p>}
            <button type="submit" className="btn-primary" disabled={!installerPath.trim()}>{t('uninstallerV3.monitor.start')}</button>

            <section className="mt-7" aria-labelledby="monitor-traces-heading">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 id="monitor-traces-heading" className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                  {t('uninstallerV3.monitor.tracesHeading')}
                </h3>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={importRef}
                    type="file"
                    accept={`${TRACE_FILE_EXTENSION},.json,application/json`}
                    data-testid="import-traces-input"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={importTraces}
                  />
                  <button type="button" className={SMALL_BUTTON} onClick={() => importRef.current?.click()} disabled={transferring}>
                    {t('uninstallerV3.monitor.traceFile.import')}
                  </button>
                  {traces.length > 0 && (
                    <button type="button" className={SMALL_BUTTON} onClick={() => exportTraces(null)} disabled={transferring}>
                      {t('uninstallerV3.monitor.traceFile.exportAll')}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11.5px] text-[color:var(--text-muted)] mb-2.5">{t('uninstallerV3.monitor.traceFile.hint')}</p>
              <div aria-live="polite">
                {fileError && <p className="text-[12.5px] text-[color:var(--danger)] mb-2.5 select-text">{fileError}</p>}
              </div>
              {traces.length === 0 ? (
                <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('uninstallerV3.monitor.traceFile.empty')}</p>
              ) : (
                <ul className="divide-y divide-[color:var(--border-subtle)] rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-panel)]">
                  {traces.map((trace) => {
                    const name = trace.programName || t('uninstallerV3.monitor.unlinked');
                    const notHere = traceInstalledHere(trace, programs) === false;
                    return (
                      <li key={trace.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[13px] truncate">{name}</span>
                            {notHere && (
                              <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] shrink-0">
                                {t('uninstallerV3.monitor.traceFile.notInstalled')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-[color:var(--text-muted)] truncate">
                            {t('uninstallerV3.monitor.traceCounts', trace.fileCount, trace.registryCount)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => exportTraces(trace)}
                          disabled={transferring}
                          aria-label={t('uninstallerV3.monitor.traceFile.exportFor', name)}
                          className={SMALL_BUTTON}
                        >
                          {t('uninstallerV3.monitor.traceFile.export')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTrace(trace)}
                          aria-label={t('uninstallerV3.monitor.deleteTraceFor', name)}
                          className="btn-ghost px-2.5 py-1 rounded-md text-[11.5px] font-medium shrink-0"
                        >
                          {t('uninstallerV3.monitor.deleteTrace')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {starting && (
          <div role="status" className="flex flex-col items-center py-10">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[13px] text-[color:var(--text-secondary)] text-center">{t('uninstallerV3.monitor.starting')}</p>
          </div>
        )}

        {running && !starting && (
          <div role="status" className="py-4">
            <p className="text-[13px] text-[color:var(--text-primary)] mb-1.5 font-medium">
              {state === 'analyzing' ? t('uninstallerV3.monitor.analyzing') : t('uninstallerV3.monitor.title')}
            </p>
            {session.installerPath && (
              <p className="text-[11.5px] text-[color:var(--text-muted)] font-mono mb-4 break-all select-text">{session.installerPath}</p>
            )}
            {state === 'installing' && <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">{t('uninstallerV3.monitor.installing')}</p>}
            {state === 'exited' && <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">{t('uninstallerV3.monitor.exited')}</p>}
            {state === 'analyzing' && (
              <div className="flex items-center gap-3 mb-5">
                <div className="w-5 h-5 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{error}</p>}
            <div className="flex items-center gap-2.5">
              <button type="button" className="btn-primary" onClick={finish} disabled={state === 'analyzing'}>{t('uninstallerV3.monitor.doneInstalling')}</button>
              <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={cancel} disabled={state === 'analyzing'}>
                {t('uninstallerV3.monitor.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
