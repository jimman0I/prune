import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { DASHBOARD_TOP_COUNT } from '../lib/spaceBreakdown.js';

/** The five biggest programs, and the honest remainder.
 *
 * Each row is a button into Applications: the point of seeing that something
 * is large is to do something about it, and the row is the shortest path.
 * Bars are relative to the largest of the five, not a share of the drive --
 * five programs each a few percent of a terabyte would all be slivers.
 *
 * Nothing here is drawn before the sizes are in. While they are not, the rows
 * are skeleton blocks with no figures on them; a placeholder size would be
 * exactly the plausible-but-invented number this app refuses to show.
 *
 * The full name stays in the DOM (truncated visually with an ellipsis), so a
 * screen reader gets "Microsoft Visual Studio Community 2022", not a stub.
 * No native title= tooltip: the row opens Applications, where it is in full. */
export default function LargestPrograms({ top, measured, installedCount, otherBytes, onOpenApplications, onOpenDiskMap }) {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="largest-heading" className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h3 id="largest-heading" className="text-[15px] font-medium text-[color:var(--text-primary)]">{t('dashboard.largest.heading')}</h3>
        <div className="flex items-baseline gap-3 shrink-0">
          {measured && (
            <span className="text-[12px] font-mono text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('dashboard.largest.installedCount', installedCount)}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenApplications}
            className="text-[13px] text-[color:var(--text-secondary)] underline underline-offset-4 decoration-[color:var(--border-hover)] hover:text-[color:var(--text-primary)] rounded-sm"
          >
            {t('dashboard.largest.openApplications')}
          </button>
        </div>
      </div>

      {!measured ? (
        <div aria-busy="true" className="divide-y divide-[color:var(--border-subtle)] border-y border-[color:var(--border-subtle)]">
          <span className="sr-only">{t('dashboard.largest.measuring')}</span>
          {Array.from({ length: DASHBOARD_TOP_COUNT }, (_, row) => (
            <div key={row} className="flex items-center gap-4 min-h-[40px] px-2 skeleton-row" style={{ animationDelay: `${row * 45}ms` }} aria-hidden="true">
              <div className="h-2.5 rounded bg-[color:var(--surface-strong)]" style={{ width: `${34 - row * 4}%` }} />
              <div className="h-1.5 flex-1 rounded-full bg-[color:var(--surface-subtle)]" />
              <div className="h-2.5 w-14 rounded bg-[color:var(--surface-strong)]" />
            </div>
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="text-[13px] text-[color:var(--text-secondary)] py-3">{t('dashboard.largest.none')}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border-subtle)] border-y border-[color:var(--border-subtle)]">
          {top.map((program) => (
            <li key={program.id ?? program.name}>
              <button
                type="button"
                onClick={onOpenApplications}
                className="group w-full min-h-[40px] px-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5.5rem] items-center gap-4 text-left hover:bg-[color:var(--surface-hover)] transition-colors"
              >
                <span className="truncate text-[13px] text-[color:var(--text-primary)]">{program.name}</span>
                <span aria-hidden="true" className="block h-1.5 rounded-full bg-[color:var(--surface-strong)] overflow-hidden">
                  <span
                    data-bar="program"
                    className="block h-full rounded-full"
                    style={{ width: `${program.ratio * 100}%`, background: 'var(--text-secondary)' }}
                  />
                </span>
                <span className="text-[13px] font-mono text-right text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatBytes(program.sizeBytes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {measured && otherBytes > 0 && (
        <p className="mt-3 text-[13px] text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('dashboard.largest.notInList', formatBytes(otherBytes))}{' '}
          <button
            type="button"
            onClick={onOpenDiskMap}
            className="underline underline-offset-4 decoration-[color:var(--border-hover)] text-[color:var(--text-primary)] rounded-sm"
          >
            {t('dashboard.largest.seeDiskMap')}
          </button>
        </p>
      )}
    </section>
  );
}
