import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { driveUsage } from '../lib/driveRoot.js';

/** The drive chooser: one button per local drive, showing what is on it.
 *
 * WizTree opens with a drive list; this app opened straight onto C:\ with no
 * way to look at anything else. A chip carries the three facts that decide
 * which drive is worth opening (how full it is, what it is called, whether
 * it is the one Windows lives on) and nothing that needs a tooltip.
 *
 * Switching is instant: choosing a drive only changes which root the Disk Map
 * is showing. If that drive already has a scan in memory it is on screen at
 * once; if not, the drive-root chooser offers the scan.
 *
 * Hidden when there is nothing to choose between -- a single drive, or a
 * drive list that could not be read. A one-button "chooser" is just noise. */
export function DrivePicker({ drives, current, scanned, onSelect }) {
  const { t } = useLanguage();
  if (!Array.isArray(drives) || drives.length < 2) return null;

  return (
    <div role="group" aria-label={t('diskMapV3.drives.label')} className="flex flex-wrap gap-2 mb-5">
      {drives.map((drive) => {
        const usage = driveUsage(drive);
        const active = drive.letter === current;
        return (
          <button
            key={drive.letter}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(drive.letter)}
            className={`flex flex-col items-stretch gap-1.5 min-w-[168px] max-w-[240px] px-3 py-2 rounded-xl border text-left transition-colors ${
              active
                ? 'border-[color:var(--accent-primary)] bg-[color:var(--surface-hover)]'
                : 'border-[color:var(--border-subtle)] hover:bg-[color:var(--surface-hover)]'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[13px] font-semibold text-[color:var(--text-primary)] shrink-0">{drive.letter}:</span>
              <span className="text-[12px] text-[color:var(--text-secondary)] truncate min-w-0">{drive.label}</span>
              {drive.system && <Badge>{t('diskMapV3.drives.system')}</Badge>}
              {drive.removable && <Badge>{t('diskMapV3.drives.removable')}</Badge>}
              {scanned?.has(drive.letter) && <Badge tone="accent">{t('diskMapV3.drives.scanned')}</Badge>}
            </span>
            {usage && (
              <>
                <span aria-hidden="true" className="block h-[5px] rounded-full bg-[color:var(--surface-strong)] overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-[color:var(--accent-primary)]"
                    style={{ width: `${Math.max(2, usage.percent)}%` }}
                  />
                </span>
                <span className="text-[11px] font-mono text-[color:var(--text-muted)]">
                  {t('diskMapV3.drives.usage', formatBytes(usage.usedBytes), formatBytes(drive.totalBytes))}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Badge({ children, tone }) {
  return (
    <span
      className={`shrink-0 text-[11px] font-medium px-1.5 py-px rounded-full border ${
        tone === 'accent'
          ? 'border-[color:var(--accent-primary)] text-[color:var(--accent-primary)]'
          : 'border-[color:var(--control-border)] text-[color:var(--text-secondary)]'
      }`}
    >
      {children}
    </span>
  );
}
