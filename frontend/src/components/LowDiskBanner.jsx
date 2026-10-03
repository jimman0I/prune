import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useLowDisk } from '../hooks/useLowDisk.js';
import { formatBytes } from '../lib/formatBytes.js';

const ACTION = 'btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[28px]';

/** "Drive C: is running low on space: 12.4 GB free (5%)." -- at the top of the
 * Dashboard, with the two places that help.
 *
 * A banner, not an alert: it is a standing fact about the machine rather than
 * something that just happened, so it is announced politely (role="status") and
 * never takes focus or interrupts anything. It is there while a drive is low and
 * gone the moment it is not; there is nothing to dismiss because there is
 * nothing to acknowledge -- the way to make it go is the thing it points at.
 *
 * The state is carried in words and in the mark beside them, never by colour
 * alone: the text is the primary colour on the soft warning tint, and the
 * warning colour is only the accent bar and the icon.
 *
 * Each low drive gets a line; the actions are offered once. */
export default function LowDiskBanner({ active = true, onNavigate = () => {} }) {
  const { t } = useLanguage();
  const { drives } = useLowDisk({ active });
  if (drives.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="low-disk-banner"
      className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl px-4 py-3 bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1 basis-[280px]">
        <svg
          xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--warning)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="shrink-0 mt-0.5"
        >
          <path d="M12 3 2.5 20h19L12 3z" />
          <path d="M12 10v5" />
          <path d="M12 18h.01" />
        </svg>
        <div className="min-w-0 space-y-0.5">
          {drives.map((row) => (
            <p key={row.drive} className="text-[13px] text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('dashboardQolV3.lowDisk.banner', row.drive, formatBytes(row.freeBytes), row.percentFree)}
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button type="button" className={ACTION} onClick={() => onNavigate('deepclean')}>
          {t('dashboard.quiet.openDeepClean')}
        </button>
        <button type="button" className={ACTION} onClick={() => onNavigate('diskmap')}>
          {t('dashboardQolV3.lowDisk.openDiskMap')}
        </button>
      </div>
    </div>
  );
}
