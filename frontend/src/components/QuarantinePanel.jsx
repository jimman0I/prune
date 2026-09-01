import { useEffect, useState } from 'react';
import { fetchQuarantineBatches, restoreQuarantineBatch, removeQuarantined } from '../lib/api.js';

export default function QuarantinePanel() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuarantineBatches()
      .then((result) => { if (!cancelled) setBatches(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleRestore = async (batchDir) => {
    try {
      await restoreQuarantineBatch(batchDir);
      setBatches(batches.filter(batch => batch.batchDir !== batchDir));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (batch) => {
    try {
      await removeQuarantined({
        programName: batch.programName,
        files: batch.files,
        registryKeys: batch.registryKeys
      });
      setBatches(batches.filter(b => b.batchDir !== batch.batchDir));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-[13px] text-[color:var(--text-muted)] py-4">Loading quarantine batches…</div>;
  if (error) return <div className="text-[13px] text-[#f7a8b0] py-4">Error: {error}</div>;

  if (batches.length === 0) {
    return <p className="text-[13px] text-[color:var(--text-secondary)] py-2">No quarantined items.</p>;
  }

  return (
    <div className="card divide-y divide-[color:var(--border-subtle)]">
      {batches.map((batch) => (
        <div key={batch.batchDir} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-white truncate">{batch.programName}</div>
            <div className="font-mono text-[11px] text-[color:var(--text-muted)] truncate">{batch.timestamp}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => handleRestore(batch.batchDir)}>
              Restore
            </button>
            <button className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => handleRemove(batch)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}