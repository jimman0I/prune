import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import { previewShred, streamShred } from '../lib/api.js';
import { useSettings } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Windows' "Copy as path" wraps a path in quotes; a pasted list often has
 * them. Stripped so the same file typed either way is one entry. */
function cleanLine(line) {
  return line.trim().replace(/^"(.*)"$/, '$1').trim();
}

const bridge = () => (typeof window !== 'undefined' ? window.pruneWindow : undefined);

/** BleachBit's "Shred files / folders".
 *
 * Four steps in one dialog: choose, confirm, shred, report. The confirm
 * step is not decoration -- the backend counts what would be destroyed and
 * lists what it will refuse (Windows, drives, profiles, Quarantine, the
 * cleaner's protected folders, the user's exclusions), and nothing is
 * shredded until the person has read that and pressed the red button.
 * There is no "remember my choice" and no default selection.
 *
 * Paths come from three places, all ending in the same list: the native
 * chooser (Electron only, see electron/pathPicker.cjs), files dropped on
 * the dialog (their real path read through the preload bridge), and plain
 * text -- which is also the only way in when the page is opened in a
 * browser, where none of the other two exist.
 *
 * A fourth way in is File Explorer's right-click "Shred with Prune":
 * `requestedPaths` (with a `requestNonce` that changes with every request) puts
 * the path in the list and nothing more. It never starts a check or a shred; the
 * steps below stand exactly as for a path chosen here. A request that arrives
 * while the person is reading the confirmation sends them back to choose (the
 * list no longer matches what was read), and one that arrives mid-shred waits
 * for it to finish -- a running shred is about the list it started with. */
export default function ShredDialog({ onClose, requestedPaths = null, requestNonce = null }) {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [stage, setStage] = useState('choose'); // choose | checking | confirm | running | done
  const [paths, setPaths] = useState([]);
  const [typed, setTyped] = useState('');
  const [chosenPasses, setChosenPasses] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState({ filesDone: 0, bytesDone: 0, currentPath: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [fromExplorer, setFromExplorer] = useState(false);
  const abortRef = useRef(null);
  const latestProgress = useRef(progress);

  // The setting names the starting point; a choice made here wins.
  const passes = chosenPasses ?? (settings?.overwritePasses === 3 ? 3 : 1);

  const addPaths = (incoming, { replace = false } = {}) => {
    setPaths((current) => {
      const base = replace ? [] : current;
      const seen = new Set(base.map((p) => p.toLowerCase()));
      const next = [...base];
      for (const raw of incoming) {
        const path = cleanLine(String(raw ?? ''));
        if (!path || seen.has(path.toLowerCase())) continue;
        seen.add(path.toLowerCase());
        next.push(path);
      }
      return next;
    });
  };

  // A new request from File Explorer (a new nonce) waits here until it is safe
  // to show: not while a check or a shred is in flight.
  useEffect(() => {
    if (requestNonce === null || !Array.isArray(requestedPaths)) return;
    const usable = requestedPaths.map((raw) => cleanLine(String(raw ?? ''))).filter(Boolean);
    if (usable.length > 0) setPendingRequest(usable);
    // Only a new request matters, not a re-render with the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestNonce]);

  useEffect(() => {
    if (!pendingRequest || stage === 'checking' || stage === 'running') return;
    // After a finished shred the list is the old one's: start a new list.
    addPaths(pendingRequest, { replace: stage === 'done' });
    setPreview(null);
    setResult(null);
    setError(null);
    setStage('choose');
    setFromExplorer(true);
    setPendingRequest(null);
    // addPaths only calls setState; it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest, stage]);

  const addTyped = () => {
    addPaths(typed.split(/\r?\n/));
    setTyped('');
  };

  const choose = async (kind) => {
    const picked = await bridge()?.pickPaths?.(kind);
    if (Array.isArray(picked)) addPaths(picked);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    addPaths(files.map((file) => bridge()?.pathForFile?.(file)));
  };

  const goToConfirm = async () => {
    setError(null);
    setStage('checking');
    try {
      setPreview(await previewShred(paths));
      setStage('confirm');
    } catch (err) {
      setError(err.message);
      setStage('choose');
    }
  };

  const shred = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    latestProgress.current = { filesDone: 0, bytesDone: 0, currentPath: '' };
    setProgress(latestProgress.current);
    setError(null);
    setStage('running');
    let done = null;
    let streamError = null;
    try {
      await streamShred(paths, passes, (type, data) => {
        if (type === 'progress') {
          latestProgress.current = data;
          setProgress(data);
        } else if (type === 'done') {
          done = data;
        } else if (type === 'error') {
          streamError = data.message;
        }
      }, controller.signal);
    } catch (err) {
      if (err.name === 'AbortError' || /abort/i.test(err.message || '')) {
        // Stop: report what was shredded before the click -- which is real.
        const { filesDone, bytesDone } = latestProgress.current;
        setResult({ aborted: true, shreddedFiles: filesDone, bytes: bytesDone, failed: [], failedCount: 0, held: [], heldCount: 0 });
        setStage('done');
        return;
      }
      streamError = err.message;
    } finally {
      abortRef.current = null;
    }
    if (streamError) {
      setError(streamError);
      setStage('done');
      setResult(null);
      return;
    }
    setResult(done ?? { aborted: true, shreddedFiles: latestProgress.current.filesDone, bytes: latestProgress.current.bytesDone, failed: [], failedCount: 0, held: [], heldCount: 0 });
    setStage('done');
  };

  const title = t('deepCleanV3.shred.title');
  const running = stage === 'running';
  const canRemove = stage === 'choose';

  return (
    <ModalOverlay label={title} onClose={onClose} dismissible={!running}>
      <div className="glass-panel w-[560px] max-w-full max-h-[85vh] overflow-y-auto p-6">
        <h2 className="text-[15px] font-medium text-[color:var(--text-primary)]">{title}</h2>

        {(stage === 'choose' || stage === 'checking') && (
          <>
            <p className="text-[13px] text-[color:var(--text-secondary)] mt-3">{t('deepCleanV3.shred.intro')}</p>
            {fromExplorer && (
              <p role="status" className="text-[12.5px] text-[color:var(--text-secondary)] mt-2">{t('explorerV3.shred.fromExplorer')}</p>
            )}

            {/* A drop target, not just a hint: the whole box takes files and
                folders. Plain borders and a tint -- nothing animates, so
                there is no motion to reduce. */}
            <div
              data-testid="shred-dropzone"
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-4 rounded-xl border border-dashed p-4 ${
                dragging
                  ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-primary-soft)]'
                  : 'border-[color:var(--control-border)]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {bridge()?.pickPaths && (
                  <>
                    <button type="button" className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium" onClick={() => choose('files')}>
                      {t('deepCleanV3.shred.chooseFiles')}
                    </button>
                    <button type="button" className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium" onClick={() => choose('folders')}>
                      {t('deepCleanV3.shred.chooseFolders')}
                    </button>
                  </>
                )}
                <span className="text-[12px] text-[color:var(--text-muted)]">{t('deepCleanV3.shred.dropHint')}</span>
              </div>

              <label className="block mt-3">
                <span className="sr-only">{t('deepCleanV3.shred.typeLabel')}</span>
                <textarea
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  aria-label={t('deepCleanV3.shred.typeLabel')}
                  placeholder={'D:\\Old\\secrets.docx'}
                  rows={2}
                  spellCheck={false}
                  className="w-full resize-y font-mono text-[12.5px] px-3 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)]/50"
                />
              </label>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
                  onClick={addTyped}
                  disabled={typed.trim() === ''}
                >
                  {t('deepCleanV3.shred.add')}
                </button>
              </div>
            </div>

            {paths.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-[color:var(--text-muted)]">{t('deepCleanV3.shred.empty')}</p>
            ) : (
              <ul className="mt-3 max-h-40 overflow-y-auto divide-y divide-[color:var(--border-subtle)] rounded-lg border border-[color:var(--border-subtle)]">
                {paths.map((path) => (
                  <li key={path} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="flex-1 min-w-0 font-mono text-[12px] text-[color:var(--text-primary)] break-all select-text">{path}</span>
                    <button
                      type="button"
                      aria-label={t('deepCleanV3.shred.remove', path)}
                      disabled={!canRemove}
                      onClick={() => setPaths((current) => current.filter((p) => p !== path))}
                      className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]"
                    >
                      <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <PassesChoice passes={passes} onChange={setChosenPasses} disabled={stage === 'checking'} t={t} />
            <p className="text-[12.5px] text-[color:var(--warning)] mt-3">{t('deepCleanV3.shred.ssdNote')}</p>
            {error && <p className="mt-3 text-[12.5px] text-[color:var(--danger)] select-text">{t('deepCleanV3.shred.error', error)}</p>}

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onClose}>
                {t('deepClean.confirm.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
                disabled={paths.length === 0 || stage === 'checking'}
                onClick={goToConfirm}
              >
                {t('deepCleanV3.shred.continue')}
              </button>
            </div>
          </>
        )}

        {stage === 'confirm' && preview && (
          <>
            <p className="text-[13.5px] font-medium text-[color:var(--text-primary)] mt-3">{t('deepCleanV3.shred.confirmTitle')}</p>
            <p className="text-[13px] text-[color:var(--text-secondary)] mt-2">
              {t('deepCleanV3.shred.confirmBody', preview.files.toLocaleString(), formatBytes(preview.bytes))}
            </p>
            {preview.truncated && <p className="text-[12.5px] text-[color:var(--warning)] mt-2">{t('deepCleanV3.shred.truncated')}</p>}
            <p className="text-[12.5px] text-[color:var(--warning)] mt-2">{t('deepCleanV3.shred.ssdNote')}</p>
            <PathProblems heading={t('deepCleanV3.shred.refusedHeading', (preview.refusedCount ?? preview.refused.length).toLocaleString())} items={preview.refused} />
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={() => setStage('choose')}>
                {t('deepClean.confirm.cancel')}
              </button>
              <button
                type="button"
                className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
                disabled={preview.files === 0}
                onClick={shred}
              >
                {t('deepCleanV3.shred.confirmButton')}
              </button>
            </div>
          </>
        )}

        {running && (
          <>
            <div className="mt-4 text-[13px] text-[color:var(--text-primary)]" aria-live="polite">
              <p>{t('deepCleanV3.shred.running')}</p>
              <p className="mt-1 font-mono text-[12.5px]">
                {t('deepCleanV3.shred.progress', progress.filesDone.toLocaleString(), formatBytes(progress.bytesDone))}
              </p>
              {progress.currentPath && (
                <p className="mt-1 font-mono text-[11.5px] text-[color:var(--text-muted)] truncate">{progress.currentPath}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium flex items-center gap-2"
                onClick={() => abortRef.current?.abort()}
              >
                <span aria-hidden="true" className="w-2 h-2 rounded-[2px] bg-[color:var(--danger)]" />
                {t('deepClean.stop')}
              </button>
            </div>
          </>
        )}

        {stage === 'done' && (
          <>
            {error ? (
              <p className="mt-4 text-[12.5px] text-[color:var(--danger)] select-text">{t('deepCleanV3.shred.error', error)}</p>
            ) : result && (
              <>
                <p className="mt-4 text-[13px] text-[color:var(--text-primary)]" aria-live="polite">
                  {t(result.aborted ? 'deepCleanV3.shred.resultStopped' : 'deepCleanV3.shred.resultDone', result.shreddedFiles.toLocaleString(), formatBytes(result.bytes))}
                </p>
                <PathProblems heading={t('deepCleanV3.shred.failedHeading', (result.failedCount ?? result.failed.length).toLocaleString())} items={result.failed} />
                <PathProblems heading={t('deepCleanV3.shred.refusedHeading', (result.heldCount ?? result.held.length).toLocaleString())} items={result.held} />
              </>
            )}
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button type="button" className="btn-primary px-4 py-2 text-[12.5px] font-medium" onClick={onClose}>
                {t('deepCleanV3.shred.done')}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

/** 1 or 3 passes, as radios: a labelled group, keyboard-operable for free. */
function PassesChoice({ passes, onChange, disabled, t }) {
  return (
    <div role="radiogroup" aria-label={t('deepCleanV3.overwrite.passes')} className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      {[1, 3].map((count) => (
        <label key={count} className="flex items-center gap-2 cursor-pointer text-[12.5px] text-[color:var(--text-primary)]">
          <input
            type="radio"
            name="shred-passes"
            checked={passes === count}
            disabled={disabled}
            onChange={() => onChange(count)}
            className="accent-[color:var(--accent-primary)]"
          />
          {t(`deepCleanV3.overwrite.pass${count}`)}
        </label>
      ))}
    </div>
  );
}

/** A heading and its paths with the reason each is listed. Nothing at all
 * when the list is empty -- an empty "Could not be shredded: 0" is noise. */
function PathProblems({ heading, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[12.5px] font-medium text-[color:var(--text-primary)]">{heading}</p>
      <ul className="mt-1.5 max-h-36 overflow-y-auto space-y-1.5">
        {items.map((item) => (
          <li key={item.path} className="text-[12px]">
            <span className="block font-mono text-[color:var(--text-primary)] break-all select-text">{item.path}</span>
            <span className="block text-[color:var(--text-muted)] select-text">{item.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
