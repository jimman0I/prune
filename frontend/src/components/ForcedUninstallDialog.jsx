import { useState } from 'react';
import { pickPath } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import UninstallModal from './UninstallModal.jsx';

/** Forced uninstall of software that is not listed: Revo's "Forced
 * Uninstall".
 *
 * For a program that was never registered, whose uninstaller is gone, or
 * that was removed by deleting its folder. The person gives a name, a folder
 * or both; this builds a stand-in program from that and hands it to the same
 * dialog every other uninstall uses, in its standalone mode: an Advanced
 * leftover scan with nothing assumed from the registry, a review of every
 * result by confidence, and the usual quarantine and backup protections on
 * the way out. */
export default function ForcedUninstallDialog({ onClose, onBusyChange, initialName = '', initialFolder = '' }) {
  const { t } = useLanguage();
  // Hunter hands over what it identified; everything stays editable.
  const [name, setName] = useState(initialName);
  const [folder, setFolder] = useState(initialFolder);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState(null);
  const [target, setTarget] = useState(null);

  const trimmedName = name.trim();
  const trimmedFolder = folder.trim().replace(/[\\/]+$/, '');
  const ready = trimmedName !== '' || trimmedFolder !== '';

  const browse = async () => {
    setError(null);
    setPicking(true);
    try {
      const { path } = await pickPath('folder');
      if (path) setFolder(path);
    } catch (err) {
      setError(t('uninstallerV3.forced.pickFailed', err.message));
    } finally {
      setPicking(false);
    }
  };

  const start = (event) => {
    event?.preventDefault();
    if (!ready) return;
    setTarget({
      id: null,
      name: trimmedName || trimmedFolder.split(/[\\/]/).pop(),
      publisher: '',
      installLocation: trimmedFolder || null,
      standalone: true,
      health: { orphaned: true, reason: '' }
    });
  };

  if (target) return <UninstallModal program={target} running={false} onClose={onClose} onBusyChange={onBusyChange} />;

  return (
    <form
      onSubmit={start}
      data-modal-panel
      className="glass-panel rounded-2xl overflow-hidden max-w-[560px] w-full flex flex-col max-h-[85vh]"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">{t('uninstallerV3.forced.title')}</h2>
        <button type="button" onClick={onClose} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium">
          {t('uninstallModal.close')}
        </button>
      </div>
      <div data-modal-body className="px-6 py-5 overflow-y-auto min-h-0">
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">{t('uninstallerV3.forced.intro')}</p>

        <label htmlFor="forced-name" className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">
          {t('uninstallerV3.forced.nameLabel')}
        </label>
        <input
          id="forced-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('uninstallerV3.forced.namePlaceholder')}
          className="w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[13px] mb-5 placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)] focus:ring-4 focus:ring-[color:var(--accent-primary)]/10 transition"
        />

        <label htmlFor="forced-folder" className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">
          {t('uninstallerV3.forced.folderLabel')}
        </label>
        <div className="flex items-center gap-2 mb-5">
          <input
            id="forced-folder"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            placeholder={t('uninstallerV3.forced.folderPlaceholder')}
            className="flex-1 min-w-0 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[13px] font-mono placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)] focus:ring-4 focus:ring-[color:var(--accent-primary)]/10 transition"
          />
          <button type="button" onClick={browse} disabled={picking} className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50">
            {t('uninstallerV3.forced.browse')}
          </button>
        </div>

        {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={!ready}>{t('uninstallerV3.forced.continue')}</button>
          {!ready && <span className="text-[12px] text-[color:var(--text-muted)]">{t('uninstallerV3.forced.needOne')}</span>}
        </div>
      </div>
    </form>
  );
}
