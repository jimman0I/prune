import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';

/** What the Disk Map says when it is showing the drive's last remembered scan
 * rather than a scan made now: which drive, when, that it is not live, and the
 * two ways to scan again -- the same two the drive chooser offers, the one the
 * person used last leading.
 *
 * It is a status, not a warning: the picture is right for the moment it was
 * made, and the only thing it cannot do is act on files, which the note says.
 * Nothing here starts a scan by itself; the buttons do. */
export function LastScanBanner({ drive, savedAt, onFastScan, onCrawl, fastScanning, fastUnavailable, lastMode }) {
  const { t, language } = useLanguage();
  const crawlFirst = lastMode === 'crawl';
  const primary = 'btn-primary px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50';
  const secondary = 'btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50';
  const fast = (
    <button key="fast" type="button" className={crawlFirst ? secondary : primary} onClick={onFastScan} disabled={fastScanning || fastUnavailable}>
      {fastScanning ? t('diskMap.scanningDrive') : t('diskMap.fastScanButton')}
    </button>
  );
  const crawl = (
    <button key="crawl" type="button" className={crawlFirst ? primary : secondary} onClick={onCrawl} disabled={fastScanning}>
      {t('diskMap.driveRootPrompt.crawlButton')}
    </button>
  );

  return (
    <div role="status" className="flex items-center gap-x-5 gap-y-3 flex-wrap mb-5 px-4 py-3 rounded-xl bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)]">
      <div className="flex-1 min-w-[260px]">
        <p className="text-[13px] font-medium text-[color:var(--text-primary)]">
          {t('diskMapQolV3.lastScan.title', `${drive}:`)}
          <span className="font-normal text-[color:var(--text-secondary)]">
            {' · '}
            <time dateTime={new Date(savedAt).toISOString()}>{t('diskMapQolV3.lastScan.scanned', formatRelativeTime(savedAt, language))}</time>
          </span>
        </p>
        <p className="text-[12px] text-[color:var(--text-secondary)] mt-0.5 max-w-[80ch]">{t('diskMapQolV3.lastScan.note')}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {crawlFirst ? [crawl, fast] : [fast, crawl]}
      </div>
    </div>
  );
}
