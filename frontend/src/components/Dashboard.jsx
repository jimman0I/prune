import { useEffect, useMemo, useState } from 'react';
import { unlockDiskWear, fetchUninstallHistory } from '../lib/api.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';
import { useQuery } from '@tanstack/react-query';
import { fetchAutomation } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useDiskSpace, useDiskHealth } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { computeHealthScore, healthBand } from '../lib/healthScore.js';
import { formatBytes } from '../lib/formatBytes.js';
import { spaceBreakdown, largestPrograms } from '../lib/spaceBreakdown.js';
import { useJunkMeasure } from '../hooks/useJunkMeasure.js';
import SpaceQuestion from './SpaceQuestion.jsx';
import LargestPrograms from './LargestPrograms.jsx';
import Page from './Page.jsx';

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

/** The score's own colour: 75 and up is good, 50 and up is caution, below
 * that a problem. See healthBand -- the ring reads the number it prints, not
 * the drive's verdict, which used to paint a 58 green because the SSD is
 * fine. */
const BAND_COLOR = { good: 'var(--success)', caution: 'var(--warning)', problem: 'var(--danger)' };

/** Shows the drive-health score out of 100 when one exists, and a short status
 * word when it doesn't -- never a stand-in number. `score` stays null until
 * the drive has genuinely answered (healthScore.js), so
 * neither the number, the "/100" nor a colour band appears before then: a
 * ring that invents a healthy-looking figure is worse than one that admits
 * it hasn't read the machine yet. Until then the ring shows the drive's own
 * status word in the drive's own tone, exactly as before. */
function HealthGauge({ score, statusLabel, tone }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = score != null ? circumference * (1 - score / 100) : 0;
  const color = score != null ? BAND_COLOR[healthBand(score)] : toneColor(tone);
  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        {/* The theme's own strong surface, not a white alpha: white at 8%
            is invisible on the light ground, which left the ring an arc
            floating with no track. */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--surface-strong)" strokeWidth="10" />
        {(score != null || statusLabel) && (
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
              opacity: score != null ? 1 : 0.55
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
        {score != null ? (
          <span className="flex items-baseline gap-0.5" style={{ color }}>
            <span className="display-heading text-[32px]">{score}</span>
            <span className="text-[12px] font-mono text-[color:var(--text-secondary)]">/100</span>
          </span>
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
      <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2.5">
        {t('dashboard.smart.header')}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-6 gap-y-2">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="min-w-0">
            <div className="text-[11px] leading-snug text-[color:var(--text-muted)] break-words">{label}</div>
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

/** One cell of the quiet row: a small title, then whatever that item has to
 * say. Cells are separated by hairlines, not boxed -- three cards side by
 * side is the stat-card grid this screen used to be. */
function QuietItem({ title, children }) {
  return (
    <div className="min-w-0 px-6 py-5">
      <div className="text-[13px] font-medium text-[color:var(--text-secondary)] mb-2">{title}</div>
      {children}
    </div>
  );
}

/** Reused for the disclosure chevron and Recent activity's, so the two turn
 * the same way. */
function Chevron({ open }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`text-[color:var(--text-muted)] transition-transform duration-150 motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
    >
      <path d="M6 9l6 6 6-6"></path>
    </svg>
  );
}

export default function Dashboard({ programs, programsMeasured = false, onNavigate = () => {} }) {
  const { t } = useLanguage();

  /* Programs left behind by a failed uninstall: an entry whose uninstaller
   * is gone, which Windows will list forever. Read from the list, so it is
   * only claimed -- including "nothing" -- once the list is settled. */
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
  const [driveOpen, setDriveOpen] = useState(false);
  const junk = useJunkMeasure();

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
  const { score: healthScore } = computeHealthScore({
    driveVerdict: primaryDisk ? verdict : null,
    primaryDisk
  });

  const breakdown = useMemo(
    () => spaceBreakdown({ diskSpace, programs, programsMeasured }),
    [diskSpace, programs, programsMeasured]
  );
  const top = useMemo(() => (programsMeasured ? largestPrograms(programs) : []), [programs, programsMeasured]);
  // The backend measures the system drive; it does not report its letter, and
  // a machine whose Windows is not on C: is the exception this leaves as is.
  const driveLetter = diskSpace?.driveLetter ?? 'C';

  return (
    <Page>
      <div className="flex items-baseline justify-between gap-4 mb-8">
        <h1 className="display-heading text-[30px] leading-none">{t('nav.dashboard')}</h1>
        <ScheduleBadge onNavigate={onNavigate} />
      </div>

      <SpaceQuestion diskSpaceError={diskSpaceError} breakdown={breakdown} driveLetter={driveLetter} />

      <LargestPrograms
        top={top}
        measured={programsMeasured}
        installedCount={(programs || []).length}
        otherBytes={breakdown.ready ? breakdown.otherBytes : 0}
        onOpenApplications={() => onNavigate('applications')}
        onOpenDiskMap={() => onNavigate('diskmap')}
      />

      {/* The quiet row. Three facts that are worth a glance and rarely worth
          a click, side by side under hairlines rather than in cards. Every
          button in it is secondary: nothing on this screen is the one thing
          to do. Stacks to one column below ~720px of content (888px window
          with the icon rail). */}
      <div className="glass-panel mb-6 overflow-hidden">
        <div className="grid grid-cols-1 min-[888px]:grid-cols-3 divide-y min-[888px]:divide-y-0 min-[888px]:divide-x divide-[color:var(--border-subtle)]">
          <QuietItem title={t('dashboard.driveHealth.title')}>
            {diskHealthError && (
              <div className="text-[13px] text-[color:var(--text-secondary)] select-text">{t('dashboard.driveHealth.error', diskHealthError)}</div>
            )}
            {!diskHealthError && !primaryDisk && (
              <div className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboard.driveHealth.loading')}</div>
            )}
            {primaryDisk && (
              <>
                <div className="text-[18px] font-medium text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {healthScore != null ? t('dashboard.quiet.scoreOf', healthScore) : (verdict.statusLabel || '—')}
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {primaryDisk.lifeRemainingPercent != null ? (
                    <>
                      {t('dashboard.driveHealth.lifeRemaining', primaryDisk.lifeRemainingPercent)}
                      {primaryDisk.temperatureC != null && ` · ${primaryDisk.temperatureC} °C`}
                    </>
                  ) : (
                    // The status word stays inside the translated sentence
                    // rather than in its own styled span: word order around
                    // it is not the same in every language.
                    t('dashboard.driveHealth.reportsStatus', primaryDisk.healthStatus || t('dashboard.driveHealth.statusUnknown'))
                  )}
                </div>
                <button
                  type="button"
                  className="btn-ghost mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-2 min-h-[28px]"
                  aria-expanded={driveOpen}
                  aria-controls="drive-details-panel"
                  onClick={() => setDriveOpen((o) => !o)}
                >
                  {t('dashboard.quiet.driveDetails')}
                  <Chevron open={driveOpen} />
                </button>
              </>
            )}
          </QuietItem>

          {/* Junk cannot show a number until it is measured, and measuring
              walks 74 rule paths across the disk -- about half a minute --
              so the front page never starts it on its own. It says what is
              true and carries the control. */}
          <QuietItem title={t('dashboard.quiet.junkTitle')}>
            {junk.status === 'done' ? (
              <>
                <div className="font-mono text-[18px] font-medium text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatBytes(junk.bytes)}
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t('dashboard.quiet.junkBasis', junk.cleanerCount)}
                </div>
                <button
                  type="button"
                  className="btn-ghost mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[28px]"
                  onClick={() => onNavigate('deepclean')}
                >
                  {t('dashboard.quiet.openDeepClean')}
                </button>
              </>
            ) : (
              <>
                <div className="font-mono text-[15px] text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {junk.status === 'measuring'
                    ? (junk.total > 0 ? t('dashboard.quiet.junkProgress', junk.scanned, junk.total) : t('dashboard.quiet.junkMeasuring'))
                    : t('dashboard.quiet.junkNotMeasured')}
                </div>
                {junk.status === 'error' && (
                  <div className="mt-1 text-[13px] text-[color:var(--text-secondary)] select-text">{t('dashboard.quiet.junkError', junk.error)}</div>
                )}
                <button
                  type="button"
                  className="btn-ghost mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[28px]"
                  onClick={junk.start}
                  disabled={junk.status === 'measuring'}
                >
                  {t('dashboard.quiet.junkMeasure')}
                </button>
              </>
            )}
          </QuietItem>

          <QuietItem title={t('dashboard.quiet.leftTitle')}>
            {!programsMeasured ? (
              <div className="text-[13px] text-[color:var(--text-muted)]">{t('dashboard.measuring')}</div>
            ) : brokenCount > 0 ? (
              <>
                <div className="text-[18px] font-medium text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t('dashboard.quiet.leftCount', brokenCount)}
                </div>
                <button
                  type="button"
                  className="btn-ghost mt-3 px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[28px]"
                  onClick={() => onNavigate('applications')}
                >
                  {t('dashboard.quiet.leftReview')}
                </button>
              </>
            ) : (
              <div className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboard.quiet.leftNone')}</div>
            )}
          </QuietItem>
        </div>

        {/* The drive's own detail, exactly as it was when this was a card of
            its own: the ring and its verdict, model, wear, the admin unlock,
            the SMART attributes and any uncorrected errors. Collapsed
            because it is reference, not news. */}
        {driveOpen && primaryDisk && (
          <div id="drive-details-panel" className="border-t border-[color:var(--border-subtle)] px-6 py-6 flex items-center gap-6 min-w-0">
            <HealthGauge score={healthScore} statusLabel={verdict.statusLabel} tone={verdict.tone} />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2.5">
                {t('dashboard.systemHealth.driveDetailHeading')}
              </div>
              {/* model/mediaType/busType are Windows' own strings, same as
                  healthStatus -- left untranslated. */}
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
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        {/* A disclosure: the state is aria-expanded and the chevron, not the
            words Hide/Show, which put a second label in every language on
            a control the title already names. 28px tall so it is a target
            and not a line of text. */}
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          aria-expanded={historyOpen}
          aria-controls="recent-activity-panel"
          className="w-full min-h-[28px] flex items-center justify-between text-left"
        >
          <span className="text-[13px] font-medium text-[color:var(--text-primary)]">{t('dashboard.recentActivity.title')}</span>
          <Chevron open={historyOpen} />
        </button>
        {historyOpen && (
          <div id="recent-activity-panel" className="mt-4">
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
    </Page>
  );
}
