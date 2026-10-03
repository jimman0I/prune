import { useEffect, useRef, useState } from 'react';
import { programFileFromDrop } from '../lib/openRequests.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const hasFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

/** A drop target around the Applications screen: drop a program (.exe) or a
 * shortcut (.lnk) on it and Prune finds the installed program it belongs to.
 *
 * It does not find anything itself. A drop becomes the same "find it" request
 * File Explorer's right-click entry makes (`onProgramFile(path)`), so both doors
 * end in one flow: the ordinary uninstall dialog for a match, Forced uninstall
 * for none. Dropping starts no removal.
 *
 * The overlay is feedback and nothing else: it takes no pointer events, so the
 * drag keeps reaching this element (dragenter/dragleave fire for every inner
 * element, hence the depth counter), and it is announced as a status for anyone
 * not watching the pointer. A file that is not a program or shortcut, or whose
 * real path the desktop bridge cannot read, is declined with a reason that
 * clears itself.
 *
 * A limit worth knowing, and not something this can fix: Windows blocks
 * drag-and-drop from a non-elevated File Explorer into an elevated program
 * (UIPI), so when Prune runs as administrator a drop from Explorer simply never
 * arrives. The right-click entry has no such limit. */
export default function ProgramDropZone({ onProgramFile, children, className = '' }) {
  const { t } = useLanguage();
  const [over, setOver] = useState(false);
  const [refusal, setRefusal] = useState(null); // 'notProgram' | 'unreadable'
  const depth = useRef(0);

  useEffect(() => {
    if (!refusal) return undefined;
    const timer = setTimeout(() => setRefusal(null), 8000);
    return () => clearTimeout(timer);
  }, [refusal]);

  const onDragEnter = (event) => {
    if (!hasFiles(event)) return;
    depth.current += 1;
    setOver(true);
  };
  const onDragOver = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (event) => {
    if (!hasFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const onDrop = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    const dropped = programFileFromDrop(Array.from(event.dataTransfer.files ?? []));
    if (dropped.path) {
      setRefusal(null);
      onProgramFile?.(dropped.path);
    } else {
      setRefusal(dropped.error);
    }
  };

  return (
    <div
      data-testid="program-drop-zone"
      className={`relative ${className}`.trim()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}

      {refusal && (
        <p role="alert" className="absolute left-12 right-12 top-3 z-10 px-3.5 py-2.5 rounded-xl text-[12.5px] text-[color:var(--danger)] bg-[color:var(--bg-panel)] border border-[color:var(--danger)]/25 select-text">
          {t(refusal === 'notProgram' ? 'explorerV3.drop.notProgram' : 'explorerV3.drop.unreadable')}
        </p>
      )}

      {over && (
        <div
          role="status"
          className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--accent-primary)] bg-[color:var(--accent-primary-soft)] text-center px-6"
        >
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" />
          </svg>
          <p className="text-[15px] font-medium text-[color:var(--text-primary)]">{t('explorerV3.drop.overlay')}</p>
          <p className="text-[12.5px] text-[color:var(--text-secondary)]">{t('explorerV3.drop.overlayHint')}</p>
        </div>
      )}
    </div>
  );
}
