import { useCallback, useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { fetchDiskScan } from '../lib/api.js';
import { attachFullPaths, topLevelCells } from '../lib/diskMapTree.js';
import { colorForNode } from '../lib/diskMapColors.js';

const DEFAULT_ROOT = 'C:\\';

// Duplicated locally rather than imported from Dashboard.jsx/ProgramList.jsx
// (both off-limits for this task) -- matches this codebase's own existing
// convention of a small per-component formatBytes copy rather than one
// shared util.
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** "C:\Users\Jim" -> [{label:'C:', path:'C:\\'}, {label:'Users', path:'C:\\Users'}, {label:'Jim', path:'C:\\Users\\Jim'}].
 * Exported for testing. */
export function breadcrumbSegments(path) {
  const clean = path.replace(/\\+$/, '');
  const parts = clean.split('\\').filter(Boolean);
  return parts.map((part, i) => ({
    label: part,
    path: i === 0 ? `${part}\\` : parts.slice(0, i + 1).join('\\')
  }));
}

function LoadingState() {
  return (
    <div className="glass-panel flex flex-col items-center justify-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
        <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[13px] text-[color:var(--text-secondary)]">Scanning disk…</p>
    </div>
  );
}

/** One rectangle in the treemap -- recharts clones this element per node,
 * injecting x/y/width/height/depth plus every extra field the scanned data
 * carried (name, size, type, fullPath). depth 0 is the synthetic outer
 * container recharts wraps a single-root `data` array in -- there's
 * nothing to draw for it. */
function TreemapCell({ x, y, width, height, depth, name, size, type, fullPath, onHover, onLeave, onDrillDown }) {
  if (depth === 0 || !(width > 0) || !(height > 0)) return null;
  const fill = colorForNode({ name, type });
  const canDrillDown = type === 'directory' && Boolean(fullPath);
  const label = width > 60 && height > 22 && name.length > Math.floor(width / 7)
    ? `${name.slice(0, Math.floor(width / 7))}…`
    : name;

  return (
    <g
      onMouseEnter={(e) => onHover({ name, size, fullPath, type }, e)}
      onMouseMove={(e) => onHover({ name, size, fullPath, type }, e)}
      onMouseLeave={onLeave}
      onClick={() => canDrillDown && onDrillDown(fullPath)}
      style={{ cursor: canDrillDown ? 'pointer' : 'default' }}
    >
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--bg-navy)" strokeWidth={1.5} rx={3} />
      {width > 60 && height > 22 && (
        <text
          x={x + 6}
          y={y + 16}
          fontSize={11}
          fill="#fff"
          fillOpacity={0.85}
          className="font-mono"
          style={{ pointerEvents: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

export default function DiskMap() {
  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDiskScan(currentPath)
      .then((result) => { if (!cancelled) setTree(attachFullPaths(result, currentPath)); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentPath]);

  const handleHover = useCallback((node, e) => {
    setHovered({ node, clientX: e.clientX, clientY: e.clientY });
  }, []);
  const handleLeave = useCallback(() => setHovered(null), []);
  const handleDrillDown = useCallback((fullPath) => {
    setHovered(null);
    setCurrentPath(fullPath);
  }, []);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">Disk Map</div>
      <h1 className="display-heading text-[30px] leading-none mb-6">Disk Usage</h1>

      <div className="flex items-center flex-wrap gap-1.5 text-[12.5px] font-mono mb-6">
        {breadcrumbSegments(currentPath).map((seg, i, arr) => (
          <span key={seg.path} className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPath(seg.path)}
              className={`hover:text-[color:var(--accent-coral)] transition-colors ${
                i === arr.length - 1 ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'
              }`}
            >
              {seg.label}
            </button>
            {i < arr.length - 1 && <span className="text-[color:var(--text-muted)]">/</span>}
          </span>
        ))}
      </div>

      {loading && <LoadingState />}

      {!loading && error && (
        <div className="glass-panel p-6">
          <p className="text-[13px] text-[color:var(--danger)]">Couldn't scan "{currentPath}": {error}</p>
        </div>
      )}

      {!loading && !error && tree && (
        <div className="glass-panel p-4" style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={520}>
            <Treemap
              data={topLevelCells(tree)}
              dataKey="size"
              isAnimationActive={false}
              content={<TreemapCell onHover={handleHover} onLeave={handleLeave} onDrillDown={handleDrillDown} />}
            />
          </ResponsiveContainer>
          {hovered && (
            <div
              className="diskmap-tooltip"
              style={{ position: 'fixed', left: hovered.clientX + 14, top: hovered.clientY + 14, zIndex: 50 }}
            >
              <div className="text-[13px] font-medium text-[color:var(--text-primary)] mb-1">{hovered.node.name}</div>
              <div className="text-[12px] text-[color:var(--accent-coral)] mb-1">{formatBytes(hovered.node.size)}</div>
              <div className="text-[11px] font-mono text-[color:var(--text-muted)] break-all max-w-[320px]">
                {hovered.node.fullPath}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
