import { useEffect, useState } from 'react';
import { openUpdatePage } from '../lib/api.js';
import { useSettings, useUpdateCheck } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The update button at the bottom of the side nav.
 *
 * Only there when the update check -- opt-in, off by default -- has found
 * a newer release. One click downloads that release, installs it silently
 * and reopens Prune on it; the electron side is electron/updater.cjs,
 * reached through the bridge in preload.cjs.
 *
 * Nothing downloads before the click unless "Install updates
 * automatically" is on. Then it downloads in the background, installs the
 * next time Prune closes, and the button becomes a restart for anyone who
 * would rather not wait.
 *
 * Without the bridge -- a development build open in a browser -- there is
 * nothing to hand an installer to, so the click opens the release page
 * instead of doing nothing. */

const bridge = () => window.pruneWindow?.updates ?? null;

const RING = 2 * Math.PI * 20;

export default function UpdateButton() {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const enabled = settings?.updateCheck === true;
  const automatic = settings?.autoInstallUpdates === true;
  const { data } = useUpdateCheck(enabled);
  const version = enabled && data?.newer === true && data.latest ? data.latest : null;

  // idle -> downloading -> installing, or -> ready when automatic.
  const [phase, setPhase] = useState('idle');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => bridge()?.onProgress?.((value) => setPercent(value)), []);

  // A second click while this runs finds phase 'downloading' and returns
  // (see click below); updater.cjs shares one download between callers
  // on top of that.
  const download = async () => {
    setError(null);
    setPercent(0);
    setPhase('downloading');
    try {
      await bridge().prepare(version);
      return true;
    } catch (err) {
      setError(err.message);
      setPhase('error');
      return false;
    }
  };

  const install = async () => {
    setPhase('installing');
    try {
      await bridge().install();
    } catch (err) {
      setError(err.message);
      setPhase('error');
    }
  };

  useEffect(() => {
    // Turning the setting off after a background download must stop that
    // download installing when Prune closes.
    if (!automatic) bridge()?.setInstallOnQuit?.(false);
    if (!automatic || !version || !bridge()) return undefined;
    let current = true;
    download().then(async (ok) => {
      if (!ok || !current) return;
      await bridge().setInstallOnQuit(true);
      setPhase('ready');
    });
    return () => { current = false; };
    // download reads `version` itself; re-running on its identity would
    // start a second download on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatic, version]);

  if (!version) return null;

  const openPage = () => {
    openUpdatePage().catch((err) => {
      setError(err.message);
      setPhase('error');
    });
  };

  const click = async () => {
    if (!bridge()) { openPage(); return; }
    if (phase === 'ready') { await install(); return; }
    if (phase === 'downloading' || phase === 'installing') return;
    if (await download()) await install();
  };

  const label = phase === 'ready'
    ? t('updateButton.restartToUpdate', version)
    : t('updateButton.updateTo', version);
  const busy = phase === 'downloading' || phase === 'installing';

  return (
    <div className="relative group flex flex-col items-center">
      <button
        type="button"
        onClick={click}
        aria-label={label}
        className="peer relative w-11 h-11 rounded-xl flex items-center justify-center text-[color:var(--accent-primary)] bg-[color:var(--accent-primary-soft)] hover:bg-[color:var(--accent-primary)]/20 transition-colors motion-reduce:transition-none"
      >
        {phase === 'downloading' && (
          <span
            role="progressbar"
            aria-label={t('updateButton.downloadProgress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="absolute inset-0"
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="20" fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
              <circle
                cx="22" cy="22" r="20" fill="none" stroke="var(--accent-primary)" strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${(RING * percent) / 100} ${RING}`}
                className="transition-[stroke-dasharray] duration-200 motion-reduce:transition-none"
              />
            </svg>
          </span>
        )}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="relative">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </button>

      {/* What is happening, under the icon rather than in a flyout: a
          download the user started should not need a hover to be seen. */}
      {phase === 'downloading' && (
        <span className="mt-1 text-[11px] font-mono text-[color:var(--text-secondary)]">{`${percent}%`}</span>
      )}
      {phase === 'installing' && (
        <span className="mt-1 text-[11px] text-[color:var(--text-secondary)]">{t('updateButton.restarting')}</span>
      )}

      {/* The name, on hover and on keyboard focus, the same way every
          other item on the rail is labelled -- see NavRail.jsx. */}
      {!busy && phase !== 'error' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md whitespace-nowrap text-[11.5px] font-medium bg-[color:var(--bg-panel)] text-[color:var(--text-primary)] border border-[color:var(--border-subtle)] shadow-lg opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-150 z-flyout"
        >
          {phase === 'ready' ? t('updateButton.restartToUpdateShort', version) : t('updateButton.updateToShort', version)}
        </span>
      )}

      {phase === 'error' && (
        <div
          role="alert"
          className="absolute left-full bottom-0 ml-2 w-[280px] p-3.5 rounded-xl bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] shadow-2xl z-flyout"
        >
          <p className="text-[12.5px] font-medium text-[color:var(--text-primary)]">{t('updateButton.couldNotUpdate', version)}</p>
          <p className="text-[12px] text-[color:var(--danger)] mt-1 leading-snug break-words select-text">{error}</p>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12px]" onClick={openPage}>
              {t('updateButton.openDownloadPage')}
            </button>
            <button type="button" className="btn-primary px-3 py-1.5 rounded-md text-[12px] font-medium" onClick={click}>
              {t('updateButton.tryAgain')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
