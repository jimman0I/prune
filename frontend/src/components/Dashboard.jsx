import { useEffect, useState } from 'react';
import { fetchDiskSpace, fetchUninstallHistory } from '../lib/api.js';
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

function HealthGauge({ percent }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = percent != null ? circumference * (1 - percent / 100) : circumference;
  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        {percent != null && (
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke="var(--accent-coral)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 500ms ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="display-heading text-[32px] text-[color:var(--text-primary)]">
          {percent != null ? `${percent}%` : '—'}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard({ programs, totalSize }) {
  const [diskSpace, setDiskSpace] = useState(null);
  const [diskSpaceError, setDiskSpaceError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDiskSpace()
      .then((result) => { if (!cancelled) setDiskSpace(result); })
      .catch((err) => { if (!cancelled) setDiskSpaceError(err.message); });
    fetchUninstallHistory()
      .then((entries) => { if (!cancelled) setHistory(entries); })
      .catch(() => { /* Recent Activity just shows empty on failure -- not worth a second error banner on a Dashboard already showing a disk-space one if that also failed */ });
    return () => { cancelled = true; };
  }, []);

  const healthScore = diskSpace ? Math.round((diskSpace.freeBytes / diskSpace.totalBytes) * 100) : null;

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
        Overview
      </div>
      <h1 className="display-heading text-[36px] leading-none mb-8">Dashboard</h1>

      <div className="glass-panel flex items-center gap-6 p-8 mb-6">
        <HealthGauge percent={healthScore} />
        <div>
          <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">System Health</div>
          <div className="text-[13px] text-[color:var(--text-secondary)]">
            {diskSpaceError
              ? "Couldn't read disk space."
              : healthScore != null
                ? `${healthScore}% of your system drive is free.`
                : 'Reading disk space…'}
          </div>
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
          value={<div className="text-[13px] text-[color:var(--text-secondary)]">Run Smart Cleanup to find out.</div>}
        />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button className="btn-primary" disabled title="Coming in a future update">Smart Scan</button>
        <button className="btn-ghost" disabled title="Coming in a future update">Disk Analyzer</button>
        <button className="btn-ghost" disabled title="Coming in a future update">Batch Uninstall</button>
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