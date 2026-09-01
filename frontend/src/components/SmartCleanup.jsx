import { useEffect, useState } from 'react';
import { fetchCleanupScan, executeCleanupCategories } from '../lib/api.js';

// Duplicated locally rather than imported from Dashboard.jsx/ProgramList.jsx/
// DiskMap.jsx (all off-limits for this task) -- matches this codebase's own
// existing convention of a small per-component formatBytes copy.
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** A real toggle switch rather than .sleek's small checkbox (index.css) --
 * "select which junk categories to include in one big sweep" reads better
 * as an on/off switch than a checklist tick, and the spec asks for coral
 * specifically on the on-state. Built with plain Tailwind, same as this
 * codebase's other bespoke controls (e.g. Composer's own mode buttons) --
 * no new CSS class needed. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-[color:var(--accent-coral)]' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function SmartCleanup() {
  const [categories, setCategories] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCleanupScan()
      .then((data) => {
        if (cancelled) return;
        setCategories(data.categories);
        setSelected(new Set(data.categories.map((c) => c.id))); // every category starts selected
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedSize = (categories || [])
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + c.sizeBytes, 0);

  const handleClean = async () => {
    setCleaning(true);
    setResult(null);
    setError(null);
    try {
      const outcome = await executeCleanupCategories([...selected]);
      setResult(outcome);
      // Re-scan so the numbers shown reflect what's actually left on disk,
      // not a stale pre-cleanup snapshot.
      const fresh = await fetchCleanupScan();
      setCategories(fresh.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">Maintenance</div>
      <h1 className="display-heading text-[30px] leading-none mb-6">Smart Cleanup</h1>

      {loading && (
        <div className="glass-panel flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[13px] text-[color:var(--text-secondary)]">Scanning for junk…</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass-panel p-6">
          <p className="text-[13px] text-[color:var(--danger)]">Couldn't scan for junk: {error}</p>
        </div>
      )}

      {!loading && !error && categories && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {categories.map((c) => (
              <div key={c.id} className="glass-panel p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{c.label}</div>
                  <div className="text-[12px] font-mono text-[color:var(--text-secondary)] mt-1">{formatBytes(c.sizeBytes)}</div>
                </div>
                <Toggle checked={selected.has(c.id)} onChange={() => toggle(c.id)} label={c.label} />
              </div>
            ))}
          </div>

          {result && (
            <div className="flex items-center gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <div className="text-[12.5px] text-[color:var(--success)]">
                Freed {formatBytes(result.freedBytes)}
                {result.skipped.length > 0 &&
                  ` — ${result.skipped.length} item${result.skipped.length === 1 ? '' : 's'} skipped (in use)`}
              </div>
            </div>
          )}

          <button
            className="btn-primary w-full py-3.5 text-[14px] font-medium disabled:opacity-50"
            disabled={selected.size === 0 || cleaning}
            onClick={handleClean}
          >
            {cleaning ? 'Cleaning…' : `Clean ${formatBytes(selectedSize)}`}
          </button>
        </>
      )}
    </div>
  );
}
