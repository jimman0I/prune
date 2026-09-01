import { useState } from 'react';
import { fetchDeepCleanScan, executeDeepClean } from '../lib/api.js';
import DeepCleanTree from './DeepCleanTree.jsx';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DeepClean() {
  // No auto-scan on mount, per spec -- the tree stays empty until the
  // user explicitly clicks Preview.
  const [categories, setCategories] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [confirmClean, setConfirmClean] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);
  const [cleanError, setCleanError] = useState(null);

  const runPreview = async () => {
    setScanning(true);
    setScanError(null);
    setCleanResult(null);
    try {
      const result = await fetchDeepCleanScan();
      setCategories(result);
      // A rule no longer present in a fresh scan (rare, but cleaners.json
      // could change between scans) shouldn't leave a phantom id selected.
      const validIds = new Set(result.flatMap((g) => g.items.map((i) => i.id)));
      setSelected((prev) => new Set([...prev].filter((id) => validIds.has(id))));
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleToggle = (ruleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
      return next;
    });
  };

  const handleToggleCategory = (category, checked) => {
    const group = categories.find((g) => g.category === category);
    if (!group) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of group.items) {
        if (checked) next.add(item.id); else next.delete(item.id);
      }
      return next;
    });
  };

  const handleClean = async () => {
    setCleaning(true);
    setCleanError(null);
    try {
      const result = await executeDeepClean([...selected]);
      setCleanResult(result);
      setSelected(new Set());
      // Re-scan so the numbers on screen reflect what's actually left on
      // disk, not a stale pre-clean snapshot -- same convention Smart
      // Cleanup's own handleClean already follows.
      const fresh = await fetchDeepCleanScan();
      setCategories(fresh);
    } catch (err) {
      setCleanError(err.message);
    } finally {
      setCleaning(false);
      setConfirmClean(false);
    }
  };

  const totalBytes = categories
    ? categories.flatMap((g) => g.items).filter((i) => selected.has(i.id)).reduce((sum, i) => sum + (i.sizeBytes || 0), 0)
    : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto min-h-0 px-12 py-10 max-w-[1400px]">
        <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">Maintenance</div>
        <h1 className="display-heading text-[30px] leading-none mb-2">Deep Clean</h1>
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[62ch]">
          Deep application caches, browser code caches, memory dumps, and error reports --
          beyond what Smart Cleanup's own quick pass covers. Nothing is deleted outright:
          everything Clean removes goes to Quarantine first.
        </p>

        {scanError && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)]">Couldn't scan: {scanError}</p>
          </div>
        )}

        {cleanError && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)]">Couldn't clean: {cleanError}</p>
          </div>
        )}

        {cleanResult && (
          <div className="flex items-center gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
            <div className="text-[12.5px] text-[color:var(--success)]">
              Freed {formatBytes(cleanResult.freedBytes)}
              {cleanResult.results.some((r) => r.skipped?.length > 0) &&
                ` — some files were skipped (in use)`}
            </div>
          </div>
        )}

        {scanning && !categories && (
          <div className="glass-panel flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
              <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-[13px] text-[color:var(--text-secondary)]">Scanning deep caches…</p>
          </div>
        )}

        {!scanning && !categories && !scanError && (
          <div className="glass-panel p-10 text-center">
            <p className="text-[13.5px] text-[color:var(--text-secondary)]">Nothing scanned yet.</p>
            <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">
              Click Preview below to calculate real sizes for every category.
            </p>
          </div>
        )}

        {categories && (
          <DeepCleanTree
            categories={categories}
            selected={selected}
            onToggle={handleToggle}
            onToggleCategory={handleToggleCategory}
          />
        )}
      </div>

      <div
        className="shrink-0 glass-panel flex items-center justify-between gap-4 px-12 py-4"
        style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}
      >
        <div className="text-[13px] text-[color:var(--text-secondary)]">
          Total space to free: <span className="text-[color:var(--text-primary)] font-medium font-mono">{formatBytes(totalBytes)}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {confirmClean ? (
            <>
              <span className="text-[12.5px] text-[color:var(--danger)] mr-1">Move {selected.size} item{selected.size === 1 ? '' : 's'} to Quarantine?</span>
              <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={() => setConfirmClean(false)} disabled={cleaning}>
                Cancel
              </button>
              <button className="btn-primary px-5 py-2 text-[12.5px] font-medium disabled:opacity-50" onClick={handleClean} disabled={cleaning}>
                {cleaning ? 'Cleaning…' : 'Confirm'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50" onClick={runPreview} disabled={scanning}>
                {scanning ? 'Scanning…' : 'Preview'}
              </button>
              <button
                className="btn-primary px-5 py-2 text-[12.5px] font-medium disabled:opacity-50"
                onClick={() => setConfirmClean(true)}
                disabled={!categories || selected.size === 0}
              >
                Clean
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
