import { useEffect, useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import ForcedUninstallDialog from './ForcedUninstallDialog.jsx';
import InstallMonitorDialog from './InstallMonitorDialog.jsx';
import HunterDialog from './HunterDialog.jsx';
import FindProgramDialog from './FindProgramDialog.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The tools beside the Applications heading: the things that act on software
 * Windows does not (or no longer) list, that watch an install so a later
 * uninstall can be exact, or that find a program by pointing at its window.
 * Each opens its own dialog in the same overlay the uninstall dialogs use,
 * and tells the page when it closes so the list is read again.
 *
 * Hunter hands off: its "Uninstall" closes it and opens the ordinary
 * uninstall dialog for that program, and its "Forced uninstall" opens the
 * forced dialog with the name and folder it found.
 *
 * "Find in Prune" does the same from a file instead of a window. A
 * `findRequest` ({ path, nonce }) -- File Explorer's right-click entry, or a
 * program dropped on the screen -- opens its dialog, which looks the file up and
 * hands a match to the ordinary uninstall dialog or offers Forced uninstall. A
 * request never replaces a tools dialog that is in the middle of a scan or a
 * removal: it waits for that to finish. */
export default function ApplicationsTools({ programs = [], onChanged, onUninstall, findRequest = null }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(null);
  const [seed, setSeed] = useState({ name: '', folder: '' });
  const [findPath, setFindPath] = useState('');
  const [heldFind, setHeldFind] = useState(null);
  // A dialog in the middle of a scan or a removal must not be closed by Escape.
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(null);
    setBusy(false);
    onChanged?.();
  };
  // Looking a file up changes nothing, so closing it does not re-read the list.
  const closeFind = () => {
    setOpen(null);
    setBusy(false);
  };

  useEffect(() => {
    if (findRequest) setHeldFind(findRequest);
  }, [findRequest]);
  useEffect(() => {
    if (!heldFind || busy) return;
    setFindPath(heldFind.path);
    setOpen('find');
    setHeldFind(null);
  }, [heldFind, busy]);

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen('hunter')}>{t('uninstallerV3.hunter.button')}</button>
      <button className="btn-ghost" onClick={() => setOpen('monitor')}>{t('uninstallerV3.monitor.button')}</button>
      <button className="btn-ghost" onClick={() => { setSeed({ name: '', folder: '' }); setOpen('forced'); }}>{t('uninstallerV3.forced.button')}</button>

      {open === 'forced' && (
        <ModalOverlay label={t('uninstallerV3.forced.title')} onClose={close} dismissible={!busy}>
          <ForcedUninstallDialog onClose={close} onBusyChange={setBusy} initialName={seed.name} initialFolder={seed.folder} />
        </ModalOverlay>
      )}
      {open === 'monitor' && (
        <ModalOverlay label={t('uninstallerV3.monitor.title')} onClose={close} dismissible={!busy}>
          <InstallMonitorDialog onClose={close} onBusyChange={setBusy} />
        </ModalOverlay>
      )}
      {open === 'find' && (
        <ModalOverlay label={t('explorerV3.find.title')} onClose={closeFind} dismissible={!busy}>
          <FindProgramDialog
            path={findPath}
            programs={programs}
            onClose={closeFind}
            onBusyChange={setBusy}
            onUninstall={(program) => { setOpen(null); setBusy(false); onUninstall?.(program); }}
            onForced={(found) => { setSeed(found); setOpen('forced'); }}
          />
        </ModalOverlay>
      )}
      {open === 'hunter' && (
        <ModalOverlay label={t('uninstallerV3.hunter.title')} onClose={close} dismissible={!busy}>
          <HunterDialog
            programs={programs}
            onClose={close}
            onBusyChange={setBusy}
            onUninstall={(program) => { setOpen(null); setBusy(false); onUninstall?.(program); }}
            onForced={(found) => { setSeed(found); setOpen('forced'); }}
          />
        </ModalOverlay>
      )}
    </>
  );
}
