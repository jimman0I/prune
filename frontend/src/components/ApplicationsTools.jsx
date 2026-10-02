import { useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import ForcedUninstallDialog from './ForcedUninstallDialog.jsx';
import InstallMonitorDialog from './InstallMonitorDialog.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The tools beside the Applications heading: the things that act on software
 * Windows does not (or no longer) list, or that watch an install so a later
 * uninstall can be exact. Each opens its own dialog in the same overlay the
 * uninstall dialogs use, and tells the page when it closes so the list is
 * read again. */
export default function ApplicationsTools({ onChanged }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(null);
  // A dialog in the middle of a scan or a removal must not be closed by Escape.
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(null);
    setBusy(false);
    onChanged?.();
  };

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen('monitor')}>{t('uninstallerV3.monitor.button')}</button>
      <button className="btn-ghost" onClick={() => setOpen('forced')}>{t('uninstallerV3.forced.button')}</button>

      {open === 'forced' && (
        <ModalOverlay label={t('uninstallerV3.forced.title')} onClose={close} dismissible={!busy}>
          <ForcedUninstallDialog onClose={close} onBusyChange={setBusy} />
        </ModalOverlay>
      )}
      {open === 'monitor' && (
        <ModalOverlay label={t('uninstallerV3.monitor.title')} onClose={close} dismissible={!busy}>
          <InstallMonitorDialog onClose={close} onBusyChange={setBusy} />
        </ModalOverlay>
      )}
    </>
  );
}
