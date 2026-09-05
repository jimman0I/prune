import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchResources } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';

/** CPU, memory and disk throughput, live.
 *
 * Framed around the one question this app can actually use the answer to:
 * whether now is a reasonable moment to start a scan, and whether Prune's
 * own scanning is what is loading the machine. A Deep Clean walks the
 * whole disk and the fast scan reads the raw MFT -- both show up here
 * while they run, which makes the gauges a readout on this app rather
 * than a decoration beside it.
 *
 * Null is drawn as null. Every value can be missing -- CPU needs two
 * readings before it has a percentage, and the disk counter takes about
 * two seconds to produce its first sample -- and an empty ring reading
 * "—" is honest where a ring at zero would say the machine is idle at
 * exactly the moment someone decides it is safe to start.
 */
const RADIUS = 26;

/** Matches the app's own motion: snappy, no overshoot. */
const EASE = [0.2, 0.9, 0.3, 1];

function formatRate(bytesPerSec) {
  if (bytesPerSec === null || bytesPerSec === undefined) return null;
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  const units = ['KB/s', 'MB/s', 'GB/s'];
  let value = bytesPerSec / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** The ring. `pathLength` rather than stroke-dashoffset arithmetic: the
 * value IS the fraction, so nothing has to convert a percentage into a
 * circumference and the two cannot drift apart. */
function Gauge({ label, percent, caption, tone }) {
  const known = Number.isFinite(percent);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[64px] h-[64px]">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
          {known && (
            <motion.circle
              cx="32" cy="32" r={RADIUS} fill="none"
              stroke={tone} strokeWidth="5" strokeLinecap="round"
              // pathLength normalises the path to 1, so these two are the
              // fraction directly.
              pathLength={1}
              strokeDasharray="1 1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: percent / 100 }}
              transition={{ duration: 0.3, ease: EASE }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[13px]" style={{ color: known ? tone : 'var(--text-muted)' }}>
            {known ? `${percent}%` : '—'}
          </span>
        </div>
      </div>
      <span className="text-[10.5px] font-mono uppercase tracking-[0.13em] text-[color:var(--text-muted)]">
        {label}
      </span>
      <span className="text-[11px] text-[color:var(--text-secondary)] h-[14px]">{caption ?? ''}</span>
    </div>
  );
}

function formatGB(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1)}`;
}

export default function ResourceMonitor() {
  const { data } = useQuery({
    queryKey: keys.resources,
    queryFn: fetchResources,
    // Two seconds. Fast enough to see a scan start, slow enough that the
    // widget is not itself a load -- the reading costs microseconds, but
    // a render every 250ms across three animated rings would not.
    //
    // Gated on VISIBILITY, not on focus, and the distinction is the whole
    // reason this is a function. By default the interval pauses whenever
    // the window loses focus, which froze all three gauges the moment
    // anything else was clicked -- on a second monitor they would never
    // have moved at all. Caught live: the API was returning 29% then 48%
    // while the widget still showed the "—" of its very first reading.
    //
    // refetchIntervalInBackground lifts the focus rule; visibilityState
    // then puts back the part that was worth keeping. A minimised window
    // is genuinely hidden, polling stops, and the backend's disk counter
    // shuts itself down for want of readers.
    refetchInterval: () => (document.visibilityState === 'visible' ? 2000 : false),
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 1
  });

  // A rate has no ceiling, so the ring needs one to be a fraction of
  // anything. 500 MB/s is roughly a saturated SATA SSD: past it the ring
  // is full and the number underneath carries the real value.
  const diskCeiling = 500 * 1024 * 1024;
  const diskPercent = Number.isFinite(data?.diskBytesPerSec)
    ? Math.min(100, Math.round((data.diskBytesPerSec / diskCeiling) * 100))
    : null;

  return (
    <div className="glass-panel p-5 w-[268px] shrink-0 flex flex-col">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Right now
        </h2>
        <span className="text-[11px] text-[color:var(--text-muted)]">
          {data?.cores ? `${data.cores} cores` : ''}
        </span>
      </div>

      <div className="flex items-start justify-around gap-2">
        <Gauge
          label="CPU"
          percent={data?.cpuPercent}
          tone="var(--accent-blue)"
          caption={null}
        />
        <Gauge
          label="Memory"
          percent={data?.ram?.percent}
          tone="var(--accent-purple)"
          // Short enough not to wrap in a 268px panel. "15.9 GB of 31.9
          // GB" broke onto two lines and pushed the row out of line.
          caption={data?.ram ? `${formatGB(data.ram.usedBytes)} / ${formatGB(data.ram.totalBytes)} GB` : null}
        />
        <Gauge
          label="Disk"
          percent={diskPercent}
          tone="var(--accent-primary)"
          caption={formatRate(data?.diskBytesPerSec)}
        />
      </div>

      <p className="text-[11px] text-[color:var(--text-muted)] mt-4 leading-snug">
        A scan reads the whole disk, so these move while Prune is working — which is the point of
        having them here.
      </p>
    </div>
  );
}
