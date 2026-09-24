import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';

// Duplicated locally, the same convention DiskMap.jsx documents for its own
// copy: a small per-component formatter rather than one shared util.
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Private-use characters that cannot occur in a translation. The catalog's
// template returns a plain string, so to keep both numbers animating it is
// rendered once with these in the number slots and split back apart.
const FILES_SLOT = '';
const SIZE_SLOT = '';

/** "N files scanned · X processed", with both numbers counting up.
 *
 * The sentence comes from the catalog with the two figures replaced by
 * sentinels, then is split on them, so a language that puts the size first
 * (or wraps the number in its own words) still animates correctly. */
function Counters({ files, bytes }) {
  const { t } = useLanguage();
  const template = t('diskMap.scanProgress.filesProcessed', FILES_SLOT, SIZE_SLOT);
  const parts = String(template).split(new RegExp(`(${FILES_SLOT}|${SIZE_SLOT})`));
  return (
    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-3 tabular-nums" data-testid="scan-counters">
      {parts.map((part, i) => {
        if (part === FILES_SLOT) return <AnimatedNumber key={i} value={files} />;
        if (part === SIZE_SLOT) return <AnimatedNumber key={i} value={bytes} format={formatBytes} />;
        return part ? <span key={i}>{part}</span> : null;
      })}
    </p>
  );
}

/** Seconds since this card appeared, on its own timer. The fast scan has no
 * progress channel (see the design doc), so time is the only honest thing
 * to show. */
function useElapsedSeconds(active, startMs) {
  const [seconds, setSeconds] = useState(() => Math.floor((startMs || 0) / 1000));
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

function Rings() {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center mb-5">
      {/* Two rings breathing outward behind the spinner, offset by half a
          cycle: motion that reads as "still working" without claiming a
          percentage the scan does not have. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl border border-[color:var(--accent-primary)]/40"
        style={{ animation: 'pulse-ring 2.4s ease-out infinite' }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl border border-[color:var(--accent-primary)]/40"
        style={{ animation: 'pulse-ring 2.4s ease-out infinite', animationDelay: '1.2s' }}
      />
      <div className="relative w-14 h-14 rounded-2xl bg-[color:var(--accent-primary)]/10 border border-[color:var(--accent-primary)]/25 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );
}

function Bar({ percent }) {
  const { t } = useLanguage();
  // The one gate for every place a number can appear.
  const real = Number.isFinite(percent);
  const width = real ? Math.min(100, Math.max(0, percent)) : null;
  const ariaProps = real
    ? { 'aria-valuenow': percent, 'aria-valuemin': 0, 'aria-valuemax': 100 }
    : { 'data-indeterminate': 'true' };
  return (
    <div className="w-full max-w-[420px] mt-5">
      {real && (
        <div className="text-[12.5px] font-medium text-[color:var(--text-primary)] tabular-nums text-right mb-1.5">
          {`${percent}%`}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={t('diskMap.scanProgress.barLabel')}
        className="relative h-2 rounded-full bg-[color:var(--surface-hover)] overflow-hidden"
        {...ariaProps}
      >
        {real ? (
          <motion.div
            className="relative h-full rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary-deep))',
              boxShadow: '0 0 12px var(--accent-primary-glow)'
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${width}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 24 }}
          >
            <span aria-hidden="true" className="scan-shimmer absolute inset-0" />
          </motion.div>
        ) : (
          <motion.div
            className="scan-indeterminate absolute inset-y-0 left-0 rounded-full overflow-hidden"
            style={{
              width: '35%',
              background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-primary-deep))',
              boxShadow: '0 0 12px var(--accent-primary-glow)'
            }}
          >
            <span aria-hidden="true" className="scan-shimmer absolute inset-0" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Scanning({ path, percent, files, bytes, mode, elapsedMs, children }) {
  const { t } = useLanguage();
  const seconds = useElapsedSeconds(mode === 'index', elapsedMs);
  const showCounters = mode !== 'index' && typeof files === 'number';
  return (
    <div className="glass-panel flex flex-col items-center justify-center py-12 px-6 text-center">
      <Rings />
      <p className="font-mono text-[13px] text-[color:var(--text-primary)] max-w-[52ch] truncate">
        {t('diskMap.scanProgress.scanning', path)}
      </p>
      {mode === 'index' ? (
        <>
          <Bar percent={null} />
          <p className="text-[12.5px] text-[color:var(--text-primary)] mt-3 tabular-nums">
            {t('diskMap.scanProgress.elapsed', formatElapsed(seconds))}
          </p>
          <p className="text-[12px] text-[color:var(--text-secondary)] mt-2 max-w-[52ch]">
            {t('diskMap.scanProgress.indexNote')}
          </p>
        </>
      ) : (
        <>
          <Bar percent={percent} />
          {showCounters && <Counters files={files} bytes={bytes} />}
          <p className="text-[12px] text-[color:var(--text-secondary)] mt-3 max-w-[52ch]">
            {t('diskMap.loading.note')}
          </p>
          {!Number.isFinite(percent) && (
            <p className="text-[12px] text-[color:var(--text-muted)] mt-1.5 max-w-[52ch]">
              {t('diskMap.scanProgress.noTotalNote')}
            </p>
          )}
        </>
      )}
      {children}
    </div>
  );
}

/** A finished scan. A scan that ran out of time (`truncated`) is NOT
 * complete and must not say so: it gets "stopped early" wording and a
 * warning mark in place of the success checkmark. */
function Complete({ totalFiles, totalBytes, truncated, onScanAgain }) {
  const { t } = useLanguage();
  const known = Number.isFinite(totalFiles);
  const size = known ? [totalFiles.toLocaleString(), formatBytes(totalBytes)] : null;
  let message;
  if (truncated) {
    message = known ? t('diskMap.scanProgress.stoppedEarlyCounts', ...size) : t('diskMap.scanProgress.stoppedEarly');
  } else {
    message = known ? t('diskMap.scanProgress.completeCounts', ...size) : t('diskMap.scanProgress.complete');
  }
  return (
    <div className="glass-panel flex items-center gap-3 px-4 py-3 mb-5">
      {truncated ? (
        <svg
          aria-hidden="true"
          data-testid="scan-stopped-mark"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--warning)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12.5" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
      <motion.svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--success)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <motion.path
          d="M5 12.5l4.5 4.5L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.svg>
      )}
      <p className="text-[13px] text-[color:var(--text-primary)] flex-1 min-w-0">{message}</p>
      {onScanAgain && (
        <button
          className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0"
          onClick={onScanAgain}
        >
          {t('diskMap.scanProgress.scanAgain')}
        </button>
      )}
    </div>
  );
}

function Failed({ message, onRetry }) {
  const { t } = useLanguage();
  return (
    <div className="glass-panel p-6">
      <p className="text-[13px] text-[color:var(--danger)] select-text">{message}</p>
      {onRetry && (
        <button
          className="btn-ghost mt-4 px-3.5 py-2 rounded-lg text-[12.5px] font-medium"
          onClick={onRetry}
        >
          {t('diskMap.scanProgress.retry')}
        </button>
      )}
    </div>
  );
}

/** The Disk Map's scan card, one component for every state a scan is in.
 *
 * A percent is drawn only when `percent` is a finite number. Nothing here
 * derives, rounds up or smooths one: an unknown total is an indeterminate
 * bar and live counters, never a made-up figure. `role="progressbar"`
 * carries aria-valuenow/min/max only when the percent is real, which is
 * what the ARIA pattern for an indeterminate bar means.
 *
 * status: 'idle' (renders nothing) | 'scanning' | 'complete' | 'error'
 * mode:   'walk' (default; counters) | 'index' (fast scan; elapsed time
 *         only, because the elevated reader cannot report progress). */
export default function DiskScanProgress({
  status,
  path,
  percent,
  files,
  bytes,
  mode = 'walk',
  elapsedMs,
  message,
  totalFiles,
  truncated = false,
  totalBytes,
  onRetry,
  onScanAgain,
  children
}) {
  if (status === 'scanning') {
    return (
      <Scanning path={path} percent={percent} files={files} bytes={bytes} mode={mode} elapsedMs={elapsedMs}>
        {children}
      </Scanning>
    );
  }
  if (status === 'complete') {
    return <Complete totalFiles={totalFiles} totalBytes={totalBytes} truncated={truncated} onScanAgain={onScanAgain} />;
  }
  if (status === 'error') return <Failed message={message} onRetry={onRetry} />;
  return null;
}
