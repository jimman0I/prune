import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import { fetchWipeEstimate, fetchWipeDrives } from '../lib/api.js';
import { useSettings } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** The question in front of the free-space wipe.
 *
 * Same shape as CleanWarningDialog -- it is that dialog's pattern -- with
 * two differences that come from what the wipe is. It loses nothing, so
 * there is no "loses data" line; what it costs is hours of writing and, on
 * an SSD, wear, so those are the facts on screen, with real numbers: the
 * drive, how much will be written, and a time from a one-second write test
 * the backend just ran. And there is no "remember my choice": it is asked
 * every time, by design.
 *
 * Which local drive and how many passes (1 = zeros, 3 = random data) are
 * chosen here. They are saved as settings when this is confirmed, not
 * before: the wipe runs inside an ordinary Clean, which carries only rule
 * ids, and the backend reads the choice from settings. Changing the drive
 * measures that drive; changing the passes only rescales the numbers, since
 * the drive's speed has not changed.
 *
 * Nothing runs when this is confirmed. It only adds the wipe to the next
 * Clean, which has its own confirmation. */
export default function WipeFreeSpaceDialog({ onCancel, onConfirm }) {
  const { t } = useLanguage();
  const { settings, save } = useSettings();
  const [drivesInfo, setDrivesInfo] = useState(null);
  const [drivesDone, setDrivesDone] = useState(false);
  const [chosenDrive, setChosenDrive] = useState(null);
  const [chosenPasses, setChosenPasses] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let live = true;
    fetchWipeDrives()
      .then((data) => { if (live) setDrivesInfo(data); })
      .catch(() => { /* the profile drive still works, without a picker */ })
      .finally(() => { if (live) setDrivesDone(true); });
    return () => { live = false; };
  }, []);

  const profileDrive = drivesInfo?.profileDrive ?? null;
  const drives = drivesInfo?.drives ?? [];
  // null means "the profile's own drive", which is also what the backend
  // does with no choice at all.
  const selectedDrive = chosenDrive ?? settings?.wipeDrive ?? profileDrive;
  const passes = chosenPasses ?? (settings?.wipePasses === 3 ? 3 : 1);
  const passesRef = useRef(passes);
  passesRef.current = passes;

  const ready = drivesDone && Boolean(settings);
  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    setEstimate(null);
    setError(null);
    fetchWipeEstimate({ drive: selectedDrive, passes: passesRef.current })
      .then((data) => { if (live) setEstimate(data); })
      .catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [ready, selectedDrive]);

  const totalBytes = estimate ? estimate.bytesToWrite * passes : 0;
  // The backend's time is for the passes it was asked about; one pass's
  // worth, times the passes chosen now.
  const seconds =estimate && totalBytes > 0 ? Math.ceil((estimate.seconds / (estimate.passes || 1)) * passes) : 0;
  const minutesTotal = Math.max(1, Math.round(seconds / 60));
  const duration = t('deepClean.wipe.duration', Math.floor(minutesTotal / 60), minutesTotal % 60);
  const title = t('deepClean.wipe.title');
  const driveTouched = chosenDrive !== null;
  // Unmeasurable (the write test failed), or a drive just picked and not
  // yet measured: adding it would be wiping blind.
  const blocked = Boolean(error) || (driveTouched && !estimate);

  const confirm = async () => {
    setSaveError(null);
    try {
      await save.mutateAsync({
        wipeDrive: !selectedDrive || selectedDrive === profileDrive ? null : selectedDrive,
        wipePasses: passes
      });
    } catch (err) {
      // Not saved means the wipe would run on whatever was saved before --
      // possibly another drive. So it does not go ahead.
      setSaveError(err.message);
      return;
    }
    onConfirm(false);
  };

  const driveLabel = (d) => `${d.drive}${d.label ? ` (${d.label})` : ''}`;

  return (
    <ModalOverlay label={title} onClose={onCancel}>
      <div className="glass-panel w-[460px] max-w-full p-6">
        <h2 className="text-[15px] font-medium text-[color:var(--text-primary)]">{title}</h2>

        <p className="text-[13px] text-[color:var(--text-secondary)] mt-3">{t('deepCleanV3.wipe.body')}</p>
        {/* The SSD line is the one most likely to change the decision, so it
            is set apart and in the warning colour rather than folded into
            the paragraph above. */}
        <p className="text-[13px] text-[color:var(--warning)] mt-3">{t('deepClean.wipe.ssdWarning')}</p>

        {drives.length > 1 && (
          <div role="radiogroup" aria-label={t('deepCleanV3.wipe.driveLabel')} className="mt-4 flex flex-col gap-2">
            {drives.map((d) => (
              <label key={d.drive} className="flex items-center gap-2 cursor-pointer text-[12.5px] text-[color:var(--text-primary)]">
                <input
                  type="radio"
                  name="wipe-drive"
                  checked={selectedDrive === d.drive}
                  onChange={() => setChosenDrive(d.drive)}
                  className="accent-[color:var(--accent-primary)]"
                />
                <span className="font-mono">
                  {t('deepCleanV3.wipe.driveOption', driveLabel(d), formatBytes(d.freeBytes), formatBytes(d.totalBytes))}
                </span>
              </label>
            ))}
          </div>
        )}

        <div role="radiogroup" aria-label={t('deepCleanV3.overwrite.passes')} className="mt-4 flex flex-col gap-2">
          {[1, 3].map((count) => (
            <label key={count} className="flex items-center gap-2 cursor-pointer text-[12.5px] text-[color:var(--text-primary)]">
              <input
                type="radio"
                name="wipe-passes"
                checked={passes === count}
                onChange={() => setChosenPasses(count)}
                className="accent-[color:var(--accent-primary)]"
              />
              {t(`deepCleanV3.overwrite.pass${count}`)}
            </label>
          ))}
        </div>

        <div className="mt-4 space-y-1 text-[12.5px] text-[color:var(--text-primary)]" aria-live="polite">
          {!estimate && !error && <p className="text-[color:var(--text-muted)]">{t('deepClean.wipe.measuring')}</p>}
          {error && <p className="text-[color:var(--danger)] select-text">{t('deepClean.wipe.estimateFailed', error)}</p>}
          {estimate && (
            <>
              <p className="font-mono">{t('deepClean.wipe.driveLine', estimate.drive)}</p>
              <p>{t('deepClean.wipe.writeLine', formatBytes(totalBytes))}</p>
              {totalBytes > 0 && (
                <p>{t('deepClean.wipe.timeLine', duration, `${formatBytes(estimate.bytesPerSecond)}/s`)}</p>
              )}
              <p className="text-[color:var(--text-secondary)]">{t('deepClean.wipe.reserveLine', formatBytes(estimate.reserveBytes))}</p>
            </>
          )}
        </div>

        <p className="text-[12.5px] text-[color:var(--text-muted)] mt-3">{t('deepClean.wipe.stopNote')}</p>
        {saveError && <p className="mt-3 text-[12.5px] text-[color:var(--danger)] select-text">{t('deepClean.cleanErrorPrefix', saveError)}</p>}

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onCancel}>
            {t('deepClean.wipe.cancel')}
          </button>
          <button
            className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
            onClick={confirm}
            disabled={blocked}
          >
            {t('deepClean.wipe.confirm')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
