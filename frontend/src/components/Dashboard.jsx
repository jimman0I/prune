import { useEffect, useMemo, useState } from 'react';
import { unlockDiskWear, fetchUninstallHistory } from '../lib/api.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';
import StatCard from './StatCard.jsx';
import { useCountUp } from '../hooks/useCountUp.js';
import ResourceMonitor from './ResourceMonitor.jsx';
import { useQuery } from '@tanstack/react-query';
import { fetchAutomation } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useDiskSpace, useDiskHealth } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { computeHealthScore } from '../lib/healthScore.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}


/** Says something only when there is something to say.
 *
 * Three states, and only two of them render. A schedule that is off, or
 * on and up to date, shows nothing -- a badge reading "next run Sunday"
 * on every visit is furniture. It appears when a run is DUE and the app
 * was not open for it, and when windows went by while the machine was
 * off, which is the case the brief calls "skipped" and the one most
 * likely to look like the feature having failed.
 */
function ScheduleBadge({ onNavigate }) {
  const { t } = useLanguage();
  const { data } = useQuery({
    queryKey: keys.automation,
    queryFn: fetchAutomation,
    refetchInterval: 60_000,
    staleTime: 0,
    retry: 1
  });

  if (!data?.automation?.enabled) return null;
  if (!data.due && data.missed === 0) return null;

  const missed = data.missed;
  return (
    <button
      onClick={() => onNavigate('settings')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25 text-[12px] text-[color:var(--warning)] hover:bg-[color:var(--warning)]/20 transition-colors shrink-0"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--warning)] shrink-0" />
      {missed > 0 ? t('dashboard.scheduleBadge.missed', missed) : t('dashboard.scheduleBadge.due')}
    </button>
  );
}

/** Maps a real drive verdict to a semantic colour. Deliberately NOT the
 * primary accent the old free-space gauge used -- index.css's own token
 * comment reserves it for "primary actions ONLY", and a health readout is
 * status, not an action. */
function toneColor(tone) {
  if (tone === 'danger') return 'var(--danger)';
  if (tone === 'warning') return 'var(--warning)';
  if (tone === 'success') return 'var(--success)';
  return 'var(--text-muted)';
}

/** Shows a real percentage when one exists, and a short status word when
 * it doesn't -- never a stand-in number. An SSD life gauge that invents a
 * figure is worse than one that admits it can't read the drive. */
function HealthGauge({ percent, statusLabel, tone }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = percent != null ? circumference * (1 - percent / 100) : 0;
  const color = toneColor(tone);
  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        {(percent != null || statusLabel) && (
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            // A status-only ring draws full: there's no partial value to
            // represent, and a ring stuck at 0% would read as "failing".
            //
            // Animated, not transitioned. This carried
            // `transition: stroke-dashoffset` for a long time and it could
            // never have fired: the percentage arrives from a fetch, so
            // this circle is not rendered at all until the value is known,
            // and a transition cannot animate an element's first paint.
            // The keyframe reads its start from --ring-empty and its end
            // from the offset already set above.
            style={{
              '--ring-empty': circumference,
              animation: 'ring-fill 900ms var(--ease-out-expo) both',
              opacity: percent != null ? 1 : 0.55
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
        {percent != null ? (
          <span className="display-heading text-[32px]" style={{ color }}>{percent}%</span>
        ) : (
          <span className="text-[15px] font-medium leading-tight" style={{ color }}>
            {statusLabel || '—'}
          </span>
        )}
      </div>
    </div>
  );
}

/** Real drive verdict -> gauge inputs. Wear is the honest signal when the
 * drive gives it up; Windows' own HealthStatus is the fallback, and
 * "unknown" is a legitimate third answer rather than something to paper
 * over with a number. */
function driveVerdict(disk, unknownLabel) {
  if (!disk) return { percent: null, statusLabel: null, tone: 'muted' };
  if (disk.lifeRemainingPercent != null) {
    const pct = disk.lifeRemainingPercent;
    return { percent: pct, statusLabel: null, tone: pct <= 10 ? 'danger' : pct <= 25 ? 'warning' : 'success' };
  }
  // disk.healthStatus is Windows' own word ("Healthy", "Warning") -- left
  // untranslated, the same way any other OS-reported text in this app is.
  // Only the fallback for NO status at all is Prune's own copy.
  const status = disk.healthStatus;
  const tone = status === 'Healthy' ? 'success' : status === 'Warning' ? 'warning' : status ? 'danger' : 'muted';
  return { percent: null, statusLabel: status || unknownLabel, tone };
}

function formatCount(value) {
  return typeof value === 'number' ? value.toLocaleString() : '—';
}

function formatComponent(value) {
  return value === null || value === undefined ? '—' : String(value);
}

/** The drive's own SMART attributes, the set CrystalDiskInfo shows.
 *
 * Read straight from the NVMe SMART log page, which needs no elevation --
 * so unlike the old wear button, this is simply here. Media errors and
 * unsafe shutdowns are called out in colour when non-zero: those are the
 * two an ordinary person should actually act on, and the rest is context
 * for them. */
function SmartAttributes({ smart }) {
  const { t } = useLanguage();
  const tb = (bytes) => (typeof bytes === 'number' ? `${(bytes / 1e12).toFixed(1)} TB` : '—');

  const rows = [
    [t('dashboard.smart.powerOnHours'), formatCount(smart.powerOnHours)],
    [t('dashboard.smart.powerCycles'), formatCount(smart.powerCycles)],
    [t('dashboard.smart.dataWritten'), tb(smart.bytesWritten)],
    [t('dashboard.smart.dataRead'), tb(smart.bytesRead)],
    [t('dashboard.smart.spareBlocks'), smart.availableSparePercent != null ? `${smart.availableSparePercent}%` : '—'],
    [t('dashboard.smart.unsafeShutdowns'), formatCount(smart.unsafeShutdowns), smart.unsafeShutdowns > 0 ? 'warn' : null],
    [t('dashboard.smart.mediaErrors'), formatCount(smart.mediaErrors), smart.mediaErrors > 0 ? 'bad' : 'good'],
    [t('dashboard.smart.errorLogEntries'), formatCount(smart.errorLogEntries)]
  ];

  return (
    <div className="mt-4 pt-4 border-t border-[color:var(--border-subtle)]">
      <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2.5">
        {t('dashboard.smart.header')}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="min-w-0">
            <div className="text-[10.5px] text-[color:var(--text-muted)] truncate">{label}</div>
            <div
              className={`text-[13px] font-mono ${
                tone === 'bad' ? 'text-[color:var(--danger)]'
                  : tone === 'warn' ? 'text-[color:var(--warning)]'
                  : tone === 'good' ? 'text-[color:var(--success)]'
                  : 'text-[color:var(--text-primary)]'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ programs, totalSize, onNavigate = () => {} }) {
  const { t } = useLanguage();
  /* The count settles rather than snapping.
   *
   * It arrives a second or so after the card does, and appearing fully
   * formed gave no sign anything had happened -- on a panel with three
   * figures on it, the one that changed was easy to miss. Counting from
   * the value already on screen, so a poll that moves 210 to 211 ticks by
   * one instead of restarting from zero. `tabular-nums` on the element
   * keeps the digits from reflowing while it runs. */
  const shownPrograms = useCountUp(programs?.length ?? 0);

  // The one fact on the Installed Apps card worth crossing the app for: an
  // entry whose uninstaller is gone, which Windows will list forever.
  const brokenCount = useMemo(
    () => (programs || []).filter((p) => p.health?.orphaned).length,
    [programs]
  );
  /* Through the query layer like every other read in the app.
   *
   * These two used to be local state filled by a bare useEffect + fetch,
   * while useDiskSpace and useDiskHealth sat in hooks/useSystemQueries.js
   * exported and imported by nothing. That cost the cache, the shared
   * retry policy and deduplication -- and the drive-health read is a
   * SMART query, the slowest thing on this screen. */
  const { diskSpace, error: diskSpaceError } = useDiskSpace();
  const { health: diskHealth, error: diskHealthError, setHealth: setDiskHealth } = useDiskHealth();
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchUninstallHistory()
      .then((entries) => { if (!cancelled) setHistory(entries); })
      .catch(() => { /* Recent Activity just shows empty on failure -- not worth a second error banner on a Dashboard already showing a disk-space one if that also failed */ });
    return () => { cancelled = true; };
  }, []);

  const [unlocking, setUnlocking] = useState(false);
  const [unlockNote, setUnlockNote] = useState(null);

  /** Explicit click only. This raises a real UAC prompt, so it can never
   * live in an effect -- an unrequested consent dialog is how software
   * trains people to click "Yes" without reading it. */
  const handleUnlockWear = async () => {
    setUnlocking(true);
    setUnlockNote(null);
    try {
      const result = await unlockDiskWear();
      if (result.cancelled) {
        setUnlockNote(t('dashboard.driveHealth.notApproved'));
      } else if (result.error) {
        setUnlockNote(result.error);
      } else if (!result.reliabilityAvailable) {
        // Real possibility, not a bug: plenty of consumer NVMe firmware
        // never implements the counters Windows asks for, so even an
        // administrator gets nothing back.
        setUnlockNote(t('dashboard.driveHealth.noWearData'));
        setDiskHealth(result);
      } else {
        setUnlockNote(null);
        setDiskHealth(result);
      }
    } catch (err) {
      setUnlockNote(err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const primaryDisk = diskHealth?.disks?.[0] || null;
  const verdict = driveVerdict(primaryDisk, t('dashboard.driveHealth.unknownStatus'));

  // driveVerdict is only meaningful once primaryDisk has actually
  // answered -- passing it through while primaryDisk is still null would
  // score the drive component as a real "unknown" (75) rather than
  // correctly excluding it as "not loaded yet", which is what lets the
  // very first render show a fabricated high score. See healthScore.js's
  // own doc comment for the full reasoning.
  const { score: healthScore, breakdown } = computeHealthScore({
    driveVerdict: primaryDisk ? verdict : null,
    primaryDisk,
    diskSpace,
    brokenCount
  });
  const formattedBreakdown = {
    drive: formatComponent(breakdown.drive),
    storage: formatComponent(breakdown.storage),
    apps: formatComponent(breakdown.apps),
    errors: formatComponent(breakdown.errors)
  };

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="flex items-baseline justify-between gap-4 mb-8">
        <h1 className="display-heading text-[36px] leading-none">{t('nav.dashboard')}</h1>
        <ScheduleBadge onNavigate={onNavigate} />
      </div>

      {/* The live gauges sit BESIDE drive health rather than as a fourth
          stat card. Making that row four-up squeezed the existing three
          enough to wrap "819.2 GB Used / 952.9 GB Total" onto two lines,
          and this panel had a conspicuously empty right half already --
          the two readouts also belong together: one is what the drive has
          been through, the other is what it is doing now. */}
      <div className="flex items-stretch gap-4 mb-6">
        <div className="glass-panel flex items-center gap-6 p-8 flex-1 min-w-0">
        <HealthGauge percent={healthScore} statusLabel={verdict.statusLabel} tone={verdict.tone} />
        <div className="min-w-0">
          <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">{t('dashboard.systemHealth.title')}</div>
          {healthScore != null && (
            <div className="text-[12px] font-mono text-[color:var(--text-secondary)] mb-2">
              {t('dashboard.systemHealth.breakdownLine', formattedBreakdown.drive, formattedBreakdown.storage, formattedBreakdown.apps, formattedBreakdown.errors)}
            </div>
          )}

          {diskHealthError && (
            <div className="text-[13px] text-[color:var(--text-secondary)] select-text">{t('dashboard.driveHealth.error', diskHealthError)}</div>
          )}

          {!diskHealthError && !primaryDisk && (
            <div className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboard.driveHealth.loading')}</div>
          )}

          {primaryDisk && (
            <>
              <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2.5">
                {t('dashboard.systemHealth.driveDetailHeading')}
              </div>
              {/* model/mediaType/busType are Windows' own strings, same as
                  healthStatus below -- left untranslated. */}
              <div className="text-[13px] text-[color:var(--text-primary)] truncate">
                {primaryDisk.model}
                {primaryDisk.mediaType && <span className="text-[color:var(--text-secondary)]"> · {primaryDisk.mediaType}</span>}
                {primaryDisk.busType && <span className="text-[color:var(--text-secondary)]"> · {primaryDisk.busType}</span>}
              </div>

              {primaryDisk.lifeRemainingPercent != null ? (
                <div className="text-[13px] text-[color:var(--text-secondary)] mt-1">
                  {t('dashboard.driveHealth.lifeRemaining', primaryDisk.lifeRemainingPercent)}
                  {primaryDisk.temperatureC != null && ` · ${primaryDisk.temperatureC} °C`}
                  {primaryDisk.powerOnHours != null && ` · ${t('dashboard.driveHealth.poweredOn', primaryDisk.powerOnHours.toLocaleString())}`}
                </div>
              ) : (
                <div className="text-[13px] text-[color:var(--text-secondary)] mt-1">
                  {/* The status word stays inside the translated sentence
                      rather than in its own styled span: word order around
                      it is not the same in every language. */}
                  {t('dashboard.driveHealth.reportsStatus', primaryDisk.healthStatus || t('dashboard.driveHealth.statusUnknown'))}
                  {' '}{t('dashboard.driveHealth.needsAdmin')}
                </div>
              )}

              {primaryDisk.lifeRemainingPercent == null && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                    onClick={handleUnlockWear}
                    disabled={unlocking}
                  >
                    {unlocking ? t('dashboard.driveHealth.waitingApproval') : t('dashboard.driveHealth.readWear')}
                  </button>
                  {unlockNote && <span className="text-[12px] text-[color:var(--text-muted)]">{unlockNote}</span>}
                </div>
              )}

              {primaryDisk.smart && <SmartAttributes smart={primaryDisk.smart} />}

              {(primaryDisk.readErrorsUncorrected > 0 || primaryDisk.writeErrorsUncorrected > 0) && (
                <div className="text-[12.5px] text-[color:var(--danger)] mt-1.5">
                  {t('dashboard.driveHealth.uncorrectedErrors', primaryDisk.readErrorsUncorrected || 0, primaryDisk.writeErrorsUncorrected || 0)}
                </div>
              )}
            </>
          )}
          </div>
        </div>

        <ResourceMonitor />
      </div>

      {/* Staggered on entry. The delay is small and one-directional --
          60ms apart, rising, no overshoot -- so it reads as the panel
          settling rather than as three separate animations competing.
          Runs again on every return to this tab, because Screen.jsx hides
          inactive tabs with `display: none` and an animation restarts
          when its element is displayed again. */}
      <div className="grid grid-cols-3 gap-4 mb-6 stagger">
        <StatCard
          label={t('dashboard.storage.label')}
          value={
            diskSpace ? (
              <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-2">
                {t('dashboard.storage.usedTotal', formatBytes(diskSpace.totalBytes - diskSpace.freeBytes), formatBytes(diskSpace.totalBytes))}
              </div>
            ) : (
              <div className="text-[13px] text-[color:var(--text-secondary)]">{diskSpaceError || t('dashboard.storage.loading')}</div>
            )
          }
        >
          {diskSpace && (
            <p className="text-[12px] text-[color:var(--text-secondary)] mt-1.5 mb-3">
              {/* The figure someone actually came to this card for. "815.8
                  of 952.9" is two numbers you then have to subtract. */}
              <span className="text-[color:var(--text-primary)] font-medium">
                {formatBytes(diskSpace.freeBytes)}
              </span>{' '}{t('dashboard.storage.free')}
            </p>
          )}
          {diskSpace && (
            <div className="storage-bar h-1.5 rounded-full bg-[color:var(--surface-strong)] overflow-hidden">
              <div
                className="storage-bar-fill h-full rounded-full"
                style={{ width: `${Math.round((1 - diskSpace.freeBytes / diskSpace.totalBytes) * 100)}%`, background: 'var(--accent-primary)' }}
              />
            </div>
          )}
        </StatCard>
        <StatCard
          label={t('dashboard.apps.label')}
          value={<div className="display-heading text-[28px] text-[color:var(--text-primary)] tabular-nums">{Math.round(shownPrograms)}</div>}
          sublabel={
            // A bare count is not actionable; a broken entry is the one
            // thing on this card worth crossing the app for.
            brokenCount > 0 ? (
              <p className="text-[12px] text-[color:var(--danger)] mt-1.5">
                {t('dashboard.apps.broken', brokenCount)}
              </p>
            ) : (
              <p className="text-[12px] text-[color:var(--text-secondary)] mt-1.5">
                {t('dashboard.apps.noBroken')}
              </p>
            )
          }
        >
          <button
            className="btn-ghost mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium"
            onClick={() => onNavigate('applications')}
          >
            {brokenCount > 0 ? t('dashboard.apps.review') : t('dashboard.apps.manage')}
          </button>
        </StatCard>
        {/* This tile used to read "Run Deep Clean to find out." -- a card
            whose entire content was an instruction to go somewhere else,
            sitting between two that carry real numbers.

            It cannot show a number: measuring junk means walking 74 rule
            paths across the disk, which takes about half a minute and is
            not something the front page should start on its own. So it
            says what is true and carries the control, the same shape the
            Disk Map's drive root uses. */}
        <StatCard
          label={t('dashboard.junk.label')}
          value={
            <div className="font-mono text-[15px] text-[color:var(--text-muted)]">{t('dashboard.junk.notMeasured')}</div>
          }
          sublabel={
            <p className="text-[12px] text-[color:var(--text-secondary)] mt-1.5">
              {t('dashboard.junk.description')}
            </p>
          }
        >
          <button
            className="btn-ghost mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium"
            onClick={() => onNavigate('deepclean')}
          >
            {t('dashboard.junk.measure')}
          </button>
        </StatCard>
      </div>

      <div className="flex items-center gap-3 mb-6">
        {/* These are navigation, so they are named for where they go, and
            reuse the same nav.* keys the side bar's own labels do -- the
            words on this button and the destination it goes to should
            never be able to drift apart into two different translations. */}
        <button className="btn-primary" onClick={() => onNavigate('deepclean')}>{t('nav.deepClean')}</button>
        <button className="btn-ghost" onClick={() => onNavigate('diskmap')}>{t('nav.diskMap')}</button>
        <button className="btn-ghost" onClick={() => onNavigate('applications')}>{t('nav.applications')}</button>
      </div>

      <div className="glass-panel p-6">
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[13px] font-medium text-[color:var(--text-primary)]">{t('dashboard.recentActivity.title')}</span>
          <span className="text-[12px] text-[color:var(--text-muted)]">{historyOpen ? t('dashboard.recentActivity.hide') : t('dashboard.recentActivity.show')}</span>
        </button>
        {historyOpen && (
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboard.recentActivity.empty')}</p>
            ) : (
              <div className="divide-y divide-[color:var(--border-subtle)]">
                {history.map((entry) => (
                  <div key={entry.timestamp} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-[13px] text-[color:var(--text-primary)]">{entry.programName}</div>
                      <div className="text-[11px] text-[color:var(--text-muted)] font-mono">{formatRelativeTime(entry.timestamp)}</div>
                    </div>
                    <div className="text-[12px] font-mono text-[color:var(--text-secondary)]">{formatBytes(entry.sizeBytes)} {t('dashboard.recentActivity.freed')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}