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

  const handleRestore = async (batchDirName) => {
    try {
      await restoreQuarantineBatch(batchDirName);
      setBatches(batches.filter(batch => batch.dirName !== batchDirName));
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
      setBatches(batches.filter(b => b.dirName !== batch.dirName));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading quarantine batches…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Quarantine
      </h2>
      {batches.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No quarantined items.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {batches.map((batch) => (
            <div key={batch.dirName} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-zinc-hi)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
                    {batch.programName}
                  </div>
                  <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {batch.timestamp}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => handleRestore(batch.dirName)}>
                    Restore
                  </button>
                  <button className="btn-danger" onClick={() => handleRemove(batch)}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}