import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { storageBarColor } from '../lib/usageTone.js';

/** The Dashboard's one question -- "where is my space going?" -- and its
 * answer as a single stacked bar: programs, everything else, free.
 *
 * Neutral on purpose. The accent is for actions, and this is a reading, so the
 * segments are a ramp of the theme's own neutrals (bright for what the program
 * list accounts for, mid for what it does not, an empty outline for free) and
 * the legend carries every value as text rather than leaving it to colour.
 *
 * Loading is part of the design, not a spinner. Until the disk AND the program
 * sizes have both answered, the bar is two segments (used, free) and the
 * legend says the program figure is being measured -- no number appears and
 * then moves. `breakdown` is spaceBreakdown()'s answer; see lib/. */
const FILL = {
  programs: 'var(--text-secondary)',
  other: 'var(--control-border)'
};

function Swatch({ kind, lowSpace }) {
  // Free is an outline, matching the empty part of the bar. Under 10% free
  // its edge turns the warning amber, the one place this bar uses a hue --
  // the figure beside it still says the number, so the colour never carries
  // the meaning alone.
  const style = kind === 'free'
    ? { border: `1px solid ${lowSpace ? 'var(--warning)' : 'var(--control-border)'}` }
    : { background: FILL[kind] };
  return <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-[3px] shrink-0" style={style} />;
}

function LegendItem({ kind, label, children, lowSpace }) {
  return (
    <li className="flex items-center gap-2 min-w-0">
      <Swatch kind={kind} lowSpace={lowSpace} />
      <span className="text-[13px] text-[color:var(--text-secondary)]">{label}</span>
      <span className="text-[13px] font-mono text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {children}
      </span>
    </li>
  );
}

export default function SpaceQuestion({ diskSpaceError, breakdown, driveLetter }) {
  const { t } = useLanguage();
  const hasDisk = breakdown.totalBytes != null;
  const lowSpace = hasDisk && storageBarColor(breakdown.freeBytes, breakdown.totalBytes) !== 'var(--text-secondary)';
  const { segments } = breakdown;

  const ariaLabel = !hasDisk
    ? t('dashboard.space.loading')
    : breakdown.ready
      ? t('dashboard.space.barLabel', formatBytes(breakdown.programsBytes), formatBytes(breakdown.otherBytes), formatBytes(breakdown.freeBytes))
      : t('dashboard.space.barLabelMeasuring', formatBytes(breakdown.usedBytes), formatBytes(breakdown.freeBytes));

  return (
    <section aria-labelledby="space-heading" className="mb-10">
      <div className="text-[13px] text-[color:var(--text-muted)] mb-1">{t('dashboard.space.drive', driveLetter)}</div>
      <h2 id="space-heading" className="display-heading text-[26px] leading-tight">{t('dashboard.space.heading')}</h2>

      <p className="mt-2 text-[15px] text-[color:var(--text-secondary)] min-h-[22px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {hasDisk
          ? t('dashboard.space.summary', formatBytes(breakdown.usedBytes), formatBytes(breakdown.totalBytes), formatBytes(breakdown.freeBytes))
          : (diskSpaceError || t('dashboard.space.loading'))}
      </p>

      {/* One bar. Segment widths are percentages of the whole drive, so they
          add up to 100 by construction. The bar is an image to assistive
          tech, with all three values in its label; the legend below repeats
          them as text for everyone else. */}
      <div
        role="img"
        aria-label={ariaLabel}
        className={`space-bar mt-5 flex h-3 rounded-full overflow-hidden border border-[color:var(--control-border)] ${hasDisk ? '' : 'skeleton-row'}`}
      >
        {hasDisk && (
          <>
            {segments.programs > 0 && (
              <div data-segment="programs" className="space-bar-programs h-full shrink-0"
                style={{ width: `${segments.programs}%`, background: FILL.programs }} />
            )}
            {segments.other > 0 && (
              <div data-segment="other" className="space-bar-other h-full shrink-0"
                style={{ width: `${segments.other}%`, background: FILL.other }} />
            )}
            <div data-segment="free" className="h-full shrink-0" style={{ width: `${segments.free}%` }} />
          </>
        )}
      </div>

      {hasDisk && (
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
          {breakdown.ready ? (
            <>
              <LegendItem kind="programs" label={t('dashboard.space.legendPrograms')}>{formatBytes(breakdown.programsBytes)}</LegendItem>
              <LegendItem kind="other" label={t('dashboard.space.legendOther')}>{formatBytes(breakdown.otherBytes)}</LegendItem>
            </>
          ) : (
            <>
              <LegendItem kind="other" label={t('dashboard.space.legendUsed')}>{formatBytes(breakdown.usedBytes)}</LegendItem>
              <li className="flex items-center gap-2 min-w-0">
                <Swatch kind="programs" />
                <span className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboard.space.legendPrograms')}:</span>
                <span className="text-[13px] text-[color:var(--text-muted)]">{t('dashboard.measuring')}</span>
              </li>
            </>
          )}
          <LegendItem kind="free" label={t('dashboard.space.legendFree')} lowSpace={lowSpace}>{formatBytes(breakdown.freeBytes)}</LegendItem>
          {breakdown.ready && breakdown.unsizedCount > 0 && (
            <li className="text-[13px] text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('dashboard.space.unsized', breakdown.unsizedCount)}
            </li>
          )}
          {breakdown.ready && breakdown.exceedsUsed && (
            <li className="text-[13px] text-[color:var(--text-muted)]">{t('dashboard.space.exceedsUsed')}</li>
          )}
        </ul>
      )}
    </section>
  );
}
