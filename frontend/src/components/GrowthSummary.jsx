import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { compareSavedScans } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';
import {
  GROWTH_ROWS, growthRows, growthCaveats, drillPathFor, signedBytes, readGrowthCollapsed, writeGrowthCollapsed
} from '../lib/growthSummary.js';

/** localStorage, or null where even touching it throws (site data blocked). */
function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

/** "What grew since the last scan": the drive's total change and the few
 * folders that grew most, between its latest two automatic scans.
 *
 * The comparison is the Saved scans one (backend lib/compareScans.js), asked
 * of those two scans for a handful of rows; this only chooses what to say. It
 * says nothing at all until the comparison has come back, and nothing when it
 * fails -- a summary that cannot be computed is not worth an error. Each row
 * opens that folder in the map. Folded away, it stays folded. */
export function GrowthSummary({ older, newer, onDrill }) {
  const { t, language } = useLanguage();
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(() => readGrowthCollapsed(safeStorage()));
  const query = useQuery({
    queryKey: keys.autoScanGrowth(older.id, newer.id),
    queryFn: () => compareSavedScans(older.id, newer.id, GROWTH_ROWS),
    staleTime: Infinity,
    retry: false
  });
  const comparison = query.data;
  if (!comparison) return null;

  const rows = growthRows(comparison);
  const caveats = growthCaveats(comparison.older, comparison.newer);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeGrowthCollapsed(safeStorage(), next);
  };

  return (
    <section aria-label={t('diskMapQolV3.growth.title')} className="glass-panel mb-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <h2 className="text-[13px] font-medium text-[color:var(--text-primary)] min-w-0">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            className="flex items-center gap-2 min-h-7 -ml-1 px-1 rounded-md text-left hover:text-[color:var(--accent-primary)] transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className={`shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
            <span>{t('diskMapQolV3.growth.title')}</span>
          </button>
        </h2>
        <span className="ml-auto font-mono text-[12.5px] text-[color:var(--text-secondary)] shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('diskMapV3.compare.total', signedBytes(comparison.delta))}
        </span>
      </div>

      {!collapsed && (
        <div id={bodyId} className="mt-1">
          <p className="text-[11.5px] text-[color:var(--text-muted)] mb-2">
            {t('diskMapQolV3.growth.comparedWith', formatRelativeTime(comparison.older.savedAt, language))}
          </p>

          {rows.length === 0 ? (
            <p className="text-[12.5px] text-[color:var(--text-secondary)]">{t('diskMapQolV3.growth.nothing')}</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li key={row.path}>
                  <button
                    type="button"
                    onClick={() => onDrill(drillPathFor(row.path))}
                    className="w-full flex items-baseline gap-3 min-h-7 py-1 px-1 -mx-1 rounded-md text-left hover:bg-[color:var(--surface-hover)] transition-colors"
                  >
                    <span className="font-mono text-[12px] text-[color:var(--text-primary)] w-[92px] text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {signedBytes(row.delta)}
                    </span>
                    <span className="font-mono text-[11.5px] text-[color:var(--text-secondary)] truncate min-w-0">{row.path}</span>
                    {row.isNew && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-[color:var(--control-border)] text-[color:var(--text-secondary)] shrink-0">
                        {t('diskMapQolV3.growth.newFolder')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-col gap-0.5 text-[11.5px] text-[color:var(--text-muted)]">
            {caveats.map((key) => (
              <p key={key} className="text-[color:var(--warning)]">{t(`diskMapQolV3.growth.${key}`)}</p>
            ))}
            <p>{t('diskMapQolV3.growth.foldedNote')}</p>
          </div>
        </div>
      )}
    </section>
  );
}
