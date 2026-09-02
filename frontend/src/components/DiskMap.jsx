import { useCallback, useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import { fetchDiskScan, scanDriveFast } from '../lib/api.js';
import { attachFullPaths, topLevelCells } from '../lib/diskMapTree.js';
import { subtreeForPath } from '../lib/mftSubtree.js';
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
  // The whole drive, read from the MFT in one pass. While this is set,
  // browsing is pure navigation through data already in memory -- no
  // further disk access at all.
  const [fastTree, setFastTree] = useState(null);
  const [fastStats, setFastStats] = useState(null);
  const [fastScanning, setFastScanning] = useState(false);
  const [fastNote, setFastNote] = useState(null);

  /** Explicit click only. This raises a real UAC prompt, so it can never
   * live in an effect -- see api.js. */
  const handleFastScan = async () => {
    setFastScanning(true);
    setFastNote(null);
    try {
      const result = await scanDriveFast(DEFAULT_ROOT.slice(0, 1));
      if (result.cancelled) {
        setFastNote('Not approved — still using the folder-by-folder scan.');
        return;
      }
      setFastTree(attachFullPaths(result.tree, DEFAULT_ROOT));
      setFastStats(result.stats);
      setCurrentPath(DEFAULT_ROOT);
      setError(null);
    } catch (err) {
      setFastNote(err.message);
    } finally {
      setFastScanning(false);
    }
  };

  useEffect(() => {
    // Already have the whole drive in memory: this folder is a lookup,
    // not a scan. Falling through to the recursive scanner here would
    // undo the entire point of having read the MFT.
    if (fastTree) {
      const subtree = subtreeForPath(fastTree, currentPath);
      if (subtree) {
        setTree(subtree);
        setLoading(false);
        setError(null);
        return;
      }
      // Deeper than the fast scan expanded, so fall through and scan this
      // folder for real rather than drawing it as empty.
    }

    // A real AbortController, not just a `cancelled` flag -- this is what
    // actually closes the underlying HTTP connection when the path changes
    // or the component unmounts, so the backend's own req.on('close')
    // handler (backend/src/routes/diskScan.js) really does stop scanning
    // instead of running an unwatched request to completion. Found live:
    // repeatedly navigating away from Disk Map and back left every earlier
    // scan still running server-side, all competing for the same tiny fs
    // thread pool -- exactly the kind of pile-up this is supposed to
    // prevent.
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchDiskScan(currentPath, controller.signal)
      .then((result) => setTree(attachFullPaths(result, currentPath)))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currentPath, fastTree]);

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
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="display-heading text-[30px] leading-none mb-2">Disk Usage</h1>
          {fastStats ? (
            <p className="text-[12px] text-[color:var(--text-secondary)]">
              {fastStats.recordsRead?.toLocaleString()} files and folders read from the drive's own index.
              {' '}Browsing is instant from here.
              {fastStats.mftComplete === false && (
                <span className="text-[color:var(--warning)]">
                  {' '}Part of the index couldn't be read, so totals are a lower bound.
                </span>
              )}
            </p>
          ) : (
            <p className="text-[12px] text-[color:var(--text-secondary)] max-w-[62ch]">
              Scanning folder by folder. A fast scan reads the drive's own file index instead —
              the whole drive at once, in seconds — but Windows only allows that with
              administrator access.
            </p>
          )}
        </div>
        <button
          className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50"
          onClick={handleFastScan}
          disabled={fastScanning}
        >
          {fastScanning ? 'Scanning drive…' : fastStats ? 'Rescan drive (admin)' : 'Fast scan (admin)'}
        </button>
      </div>

      {fastNote && (
        <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
          <p className="text-[12.5px] text-[color:var(--warning)]">{fastNote}</p>
        </div>
      )}

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

      {!loading && !error && tree?.truncated && (
        <div className="flex items-center gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[color:var(--warning)] shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div className="text-[12.5px] text-[color:var(--warning)]">
            This scan took too long and was stopped early — sizes shown are a real but possibly incomplete lower bound.
          </div>
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
