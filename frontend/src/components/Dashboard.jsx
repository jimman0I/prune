import { useEffect, useState } from 'react';
import { fetchDiskSpace, fetchDiskHealth, unlockDiskWear, fetchUninstallHistory } from '../lib/api.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';
import StatCard from './StatCard.jsx';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Maps a real drive verdict to a semantic colour. Deliberately NOT the
 * coral accent the old free-space gauge used -- index.css's own token
 * comment reserves coral for "primary actions ONLY", and a health readout
 * is status, not an action. */
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
            style={{ transition: 'stroke-dashoffset 500ms ease', opacity: percent != null ? 1 : 0.55 }}
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
function driveVerdict(disk) {
  if (!disk) return { percent: null, statusLabel: null, tone: 'muted' };
  if (disk.lifeRemainingPercent != null) {
    const pct = disk.lifeRemainingPercent;
    return { percent: pct, statusLabel: null, tone: pct <= 10 ? 'danger' : pct <= 25 ? 'warning' : 'success' };
  }
  const status = disk.healthStatus;
  const tone = status === 'Healthy' ? 'success' : status === 'Warning' ? 'warning' : status ? 'danger' : 'muted';
  return { percent: null, statusLabel: status || 'Unknown', tone };
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
  const tb = (bytes) => (typeof bytes === 'number' ? `${(bytes / 1e12).toFixed(1)} TB` : '—');

  const rows = [
    ['Power-on hours', formatCount(smart.powerOnHours)],
    ['Power cycles', formatCount(smart.powerCycles)],
    ['Data written', tb(smart.bytesWritten)],
    ['Data read', tb(smart.bytesRead)],
    ['Spare blocks', smart.availableSparePercent != null ? `${smart.availableSparePercent}%` : '—'],
    ['Unsafe shutdowns', formatCount(smart.unsafeShutdowns), smart.unsafeShutdowns > 0 ? 'warn' : null],
    ['Media errors', formatCount(smart.mediaErrors), smart.mediaErrors > 0 ? 'bad' : 'good'],
    ['Error log entries', formatCount(smart.errorLogEntries)]
  ];

  return (
    <div className="mt-4 pt-4 border-t border-[color:var(--border-subtle)]">
      <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2.5">
        Reported by the drive
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
  const [diskSpace, setDiskSpace] = useState(null);
  const [diskSpaceError, setDiskSpaceError] = useState(null);
  const [diskHealth, setDiskHealth] = useState(null);
  const [diskHealthError, setDiskHealthError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDiskSpace()
      .then((result) => { if (!cancelled) setDiskSpace(result); })
      .catch((err) => { if (!cancelled) setDiskSpaceError(err.message); });
    fetchDiskHealth()
      .then((result) => { if (!cancelled) setDiskHealth(result); })
      .catch((err) => { if (!cancelled) setDiskHealthError(err.message); });
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
        setUnlockNote('Not approved — still showing what Windows reports.');
      } else if (result.error) {
        setUnlockNote(result.error);
      } else if (!result.reliabilityAvailable) {
        // Real possibility, not a bug: plenty of consumer NVMe firmware
        // never implements the counters Windows asks for, so even an
        // administrator gets nothing back.
        setUnlockNote("This drive doesn't report wear data, even as administrator.");
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
  const verdict = driveVerdict(primaryDisk);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <h1 className="display-heading text-[36px] leading-none mb-8">Dashboard</h1>

      <div className="glass-panel flex items-center gap-6 p-8 mb-6">
        <HealthGauge percent={verdict.percent} statusLabel={verdict.statusLabel} tone={verdict.tone} />
        <div className="min-w-0">
          <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">Drive Health</div>

          {diskHealthError && (
            <div className="text-[13px] text-[color:var(--text-secondary)]">Couldn't read drive health: {diskHealthError}</div>
          )}

          {!diskHealthError && !primaryDisk && (
            <div className="text-[13px] text-[color:var(--text-secondary)]">Reading drive health…</div>
          )}

          {primaryDisk && (
            <>
              <div className="text-[13px] text-[color:var(--text-primary)] truncate">
                {primaryDisk.model}
                {primaryDisk.mediaType && <span className="text-[color:var(--text-secondary)]"> · {primaryDisk.mediaType}</span>}
                {primaryDisk.busType && <span className="text-[color:var(--text-secondary)]"> · {primaryDisk.busType}</span>}
              </div>

              {primaryDisk.lifeRemainingPercent != null ? (
                <div className="text-[13px] text-[color:var(--text-secondary)] mt-1">
                  {primaryDisk.lifeRemainingPercent}% life remaining
                  {primaryDisk.temperatureC != null && ` · ${primaryDisk.temperatureC} °C`}
                  {primaryDisk.powerOnHours != null && ` · ${primaryDisk.powerOnHours.toLocaleString()} h powered on`}
                </div>
              ) : (
                <div className="text-[13px] text-[color:var(--text-secondary)] mt-1">
                  Windows reports this drive <span className="text-[color:var(--text-primary)]">{primaryDisk.healthStatus || 'status unknown'}</span>.
                  {' '}Wear, temperature and power-on hours need administrator access — Prune won't show a made-up figure instead.
                </div>
              )}

              {primaryDisk.lifeRemainingPercent == null && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                    onClick={handleUnlockWear}
                    disabled={unlocking}
                  >
                    {unlocking ? 'Waiting for approval…' : 'Read drive wear (admin)'}
                  </button>
                  {unlockNote && <span className="text-[12px] text-[color:var(--text-muted)]">{unlockNote}</span>}
                </div>
              )}

              {primaryDisk.smart && <SmartAttributes smart={primaryDisk.smart} />}

              {(primaryDisk.readErrorsUncorrected > 0 || primaryDisk.writeErrorsUncorrected > 0) && (
                <div className="text-[12.5px] text-[color:var(--danger)] mt-1.5">
                  {primaryDisk.readErrorsUncorrected || 0} uncorrected read · {primaryDisk.writeErrorsUncorrected || 0} uncorrected write errors
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Storage"
          value={
            diskSpace ? (
              <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-2">
                {formatBytes(diskSpace.totalBytes - diskSpace.freeBytes)} Used / {formatBytes(diskSpace.totalBytes)} Total
              </div>
            ) : (
              <div className="text-[13px] text-[color:var(--text-secondary)]">{diskSpaceError || 'Loading…'}</div>
            )
          }
        >
          {diskSpace && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round((1 - diskSpace.freeBytes / diskSpace.totalBytes) * 100)}%`, background: 'var(--accent-coral)' }}
              />
            </div>
          )}
        </StatCard>
        <StatCard
          label="Installed Apps"
          value={<div className="display-heading text-[28px] text-[color:var(--text-primary)]">{programs.length}</div>}
        />
        <StatCard
          label="Junk Files"
          value={<div className="text-[13px] text-[color:var(--text-secondary)]">Run Deep Clean to find out.</div>}
        />
      </div>

      <div className="flex items-center gap-3 mb-6">
        {/* These are navigation, so they are named for where they go.
            They previously invented a third set of names for screens that
            already have two -- "Smart Scan" for a screen called Deep Clean,
            "Disk Analyzer" for one called Disk Map -- which leaves the
            reader matching synonyms instead of reading.

            "Smart Scan" also pointed at 'cleanup', the Smart Cleanup screen
            that no longer exists, so the primary action on the app's front
            page navigated nowhere at all. */}
        <button className="btn-primary" onClick={() => onNavigate('deepclean')}>Deep Clean</button>
        <button className="btn-ghost" onClick={() => onNavigate('diskmap')}>Disk Map</button>
        <button className="btn-ghost" onClick={() => onNavigate('applications')}>Applications</button>
      </div>

      <div className="glass-panel p-6">
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[13px] font-medium text-[color:var(--text-primary)]">Recent Activity</span>
          <span className="text-[12px] text-[color:var(--text-muted)]">{historyOpen ? 'Hide' : 'Show'}</span>
        </button>
        {historyOpen && (
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-[13px] text-[color:var(--text-secondary)]">No uninstalls yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {history.map((entry) => (
                  <div key={entry.timestamp} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-[13px] text-[color:var(--text-primary)]">{entry.programName}</div>
                      <div className="text-[11px] text-[color:var(--text-muted)] font-mono">{formatRelativeTime(entry.timestamp)}</div>
                    </div>
                    <div className="text-[12px] font-mono text-[color:var(--text-secondary)]">{formatBytes(entry.sizeBytes)} freed</div>
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