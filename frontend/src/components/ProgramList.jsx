import { useState, useEffect, useCallback } from 'react';
import { fetchPrograms } from '../lib/api';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ProgramList({ onUninstall }) {
  const [programs, setPrograms] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPrograms().then(setPrograms).catch(console.error);
  }, []);

  const debounceFilter = useCallback((query) => {
    const lower = query.toLowerCase();
    setFiltered(
      programs.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.publisher.toLowerCase().includes(lower) ||
          p.version.toLowerCase().includes(lower)
      )
    );
  }, [programs]);

  useEffect(() => {
    const timer = setTimeout(() => debounceFilter(search), 300);
    return () => clearTimeout(timer);
  }, [search, debounceFilter]);

  return (
    <div className="glass-panel">
      <input
        type="text"
        placeholder="Search programs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 mb-4 bg-transparent border border-subtle rounded"
      />
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 font-mono text-sm">
        <div className="text-muted">Name / Publisher / Version</div>
        <div className="text-muted">Size</div>
        <div></div>
        {(filtered.length > 0 ? filtered : programs).map((p) => (
          <React.Fragment key={p.id || `${p.name}-${p.publisher}`}>
            <div className="flex flex-col">
              <span>{p.name}</span>
              <span className="text-xs text-muted">{p.publisher} • {p.version}</span>
            </div>
            <div>{formatBytes(p.size || 0)}</div>
            <button
              onClick={() => onUninstall(p)}
              className="btn btn-ghost w-full"
            >
              Uninstall
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
