import { useEffect, useMemo, useState } from 'react';
import { fetchPrograms } from '../lib/api.js';
import { sizeBadgeTone } from '../lib/sizeBadgeTone.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const SIZE_BADGE_CLASSES = {
  cyan: 'bg-[color:var(--accent-cyan)]/12 text-[color:var(--accent-cyan)]',
  blue: 'bg-[color:var(--accent-blue)]/12 text-[color:var(--accent-blue)]',
  amber: 'bg-[color:var(--warning)]/12 text-[color:var(--warning)]',
  coral: 'bg-[color:var(--accent-coral)]/12 text-[color:var(--accent-coral)]'
};

export default function ProgramList({ programs: initialPrograms, onUninstall }) {
  const [programs, setPrograms] = useState(initialPrograms || []);
  const [loading, setLoading] = useState(!initialPrograms);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (initialPrograms) {
      setPrograms(initialPrograms);
      setLoading(false);
    } else {
      let cancelled = false;
      fetchPrograms()
        .then((result) => { if (!cancelled) setPrograms(result); })
        .catch((err) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
  }, [initialPrograms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? programs.filter(p => p.name.toLowerCase().includes(q) || p.publisher.toLowerCase().includes(q))
      : programs;
    if (filter === 'unused') list = list.filter(p => p.unused);
    list = [...list].sort((a, b) => {
      if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'installed') return new Date(b.installDate) - new Date(a.installDate);
      return 0;
    });
    return list;
  }, [programs, query, sortBy, filter]);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading installed programs…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Couldn't load programs: {error}</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 max-w-md relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applications…"
            className="w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl pl-10 pr-4 py-2.5 text-[13.5px] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-coral)] focus:ring-4 focus:ring-[color:var(--accent-coral)]/10 transition"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl">
          {[{ id: 'all', label: 'All' }, { id: 'unused', label: 'Unused' }].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition ${filter === f.id ? 'bg-white/[0.06] text-white' : 'text-[color:var(--text-muted)] hover:text-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortBy(sortBy === 'size' ? 'name' : sortBy === 'name' ? 'installed' : 'size')}
          className="btn-ghost px-3.5 py-2.5 rounded-xl text-[12.5px] font-medium flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M3 18v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M12 12l-3-3m0 0-3 3m3-3v12"></path>
          </svg>
          Sort: {sortBy === 'size' ? 'Size' : sortBy === 'name' ? 'Name' : 'Install date'}
        </button>
      </div>
      <div>
        <div className="grid grid-cols-[48px_1fr_140px_140px_120px_140px] gap-4 px-4 py-2 text-[10.5px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em]">
          <span></span>
          <span>Application</span>
          <span>Installed</span>
          <span>Version</span>
          <span className="text-right">Size</span>
          <span className="text-right">Action</span>
        </div>
        {filtered.length === 0 && <div className="text-center py-20 text-[color:var(--text-muted)] text-[13px]">No applications match your filters.</div>}
        <div className="space-y-2">
          {filtered.map((program) => (
            <div
              key={program.id}
              className="glass-panel grid grid-cols-[48px_1fr_140px_140px_120px_140px] gap-4 items-center px-4 py-3 group transition-all hover:-translate-y-0.5 hover:shadow-[-4px_0_20px_rgba(249,128,116,0.3)]"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold tracking-tight"
                style={{
                  background: `linear-gradient(135deg, ${program.color || '#f98074'}dd, ${program.color || '#f98074'}88)`,
                  color: '#fff',
                  boxShadow: `0 4px 10px -4px ${program.color || '#f98074'}55, inset 0 1px 0 rgba(255,255,255,0.15)`
                }}
              >
                {program.icon || program.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[13.5px] font-medium truncate">{program.name}</div>
                  {program.unused && <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--warning-soft)] text-[color:var(--warning)] border border-[color:var(--warning)]/25">Unused</span>}
                </div>
                <div className="text-[11.5px] text-[color:var(--text-muted)] font-mono truncate mt-0.5">{program.publisher}</div>
              </div>
              <div className="text-[12px] font-mono text-[color:var(--text-secondary)]">{program.installDate ? new Date(program.installDate).toLocaleDateString() : 'N/A'}</div>
              <div className="text-[12px] font-mono text-[color:var(--text-secondary)] truncate">{program.version || 'N/A'}</div>
              <div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-medium ${SIZE_BADGE_CLASSES[sizeBadgeTone(program.sizeBytes)]}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatBytes(program.sizeBytes)}
                </span>
              </div>
              <div className="text-right">
                <button
                  onClick={() => onUninstall(program)}
                  className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
