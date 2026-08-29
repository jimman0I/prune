import { useEffect, useMemo, useState } from 'react';
import { fetchPrograms } from '../lib/api.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ProgramList({ onUninstall }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchPrograms()
      .then((result) => { if (!cancelled) setPrograms(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? programs.filter(p => p.name.toLowerCase().includes(q) || p.publisher.toLowerCase().includes(q))
      : programs;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [programs, query]);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading installed programs…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Couldn't load programs: {error}</div>;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search installed programs..."
        aria-label="Search installed programs"
        style={{
          width: '100%', background: 'var(--bg-zinc-hi)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, marginBottom: 16
        }}
      />
      {filtered.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No programs match your search.</div>}
      <div role="table" aria-label="Installed programs">
        {filtered.map((program) => (
          <div
            key={program.id}
            role="row"
            style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 12,
              alignItems: 'center', padding: '10px 4px', borderRadius: 10
            }}
          >
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{program.name}</div>
              <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {program.publisher} · {program.version || 'unknown version'}
              </div>
            </div>
            <div className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {formatBytes(program.sizeBytes)}
            </div>
            <button className="btn-ghost" onClick={() => onUninstall(program)}>Uninstall</button>
          </div>
        ))}
      </div>
    </div>
  );
}
