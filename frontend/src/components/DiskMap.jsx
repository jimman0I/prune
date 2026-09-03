import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Treemap, ResponsiveContainer } from 'recharts';
import { fetchDiskScan, scanDriveFast, fetchDiskSpace, fetchFileTypeIcons } from '../lib/api.js';
import { attachFullPaths, topLevelCells } from '../lib/diskMapTree.js';
import { subtreeForPath } from '../lib/mftSubtree.js';
import { extensionBreakdown, NO_EXTENSION } from '../lib/extensionBreakdown.js';
import { largestFiles } from '../lib/largestFiles.js';
import { folderTableRows } from '../lib/folderTable.js';
import { sortFolderRows, nextFolderSort } from '../lib/sortFolderRows.js';
import { withUnscannedRemainder, scanCoverage } from '../lib/unscannedRemainder.js';
import { colorForNode } from '../lib/diskMapColors.js';
import { iconKeyForNode, extensionsInCells, extensionOf, GENERIC_FILE_KEY } from '../lib/fileTypeIcon.js';
import { limitCells } from '../lib/limitCells.js';

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

/** "C:\" or "C:" -- the only place a whole-drive used-space figure is the
 * right thing to reconcile a scan against.
 *
 * Written without a regex on purpose. The obvious one needs an escaped
 * backslash, and an earlier version of this line shipped as
 * `/^[a-z]:\?$/i` -- an optional literal QUESTION MARK rather than an
 * optional separator, so it silently returned false for every path and
 * the unscanned remainder never appeared. It cost a rebuild and a live
 * probe to find, because nothing throws: the feature just quietly
 * doesn't happen. */
export function isDriveRoot(path) {
  if (typeof path !== 'string') return false;
  const trimmed = path.replace(/[/\\]+$/, '');
  return trimmed.length === 2 && trimmed[1] === ':' && /^[a-z]$/i.test(trimmed[0]);
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
const ICON_SIZE = 16;

/** How many rectangles to actually draw. See limitCells.js -- past this
 * the cells are a few pixels wide and cost far more than they say. */
const MAX_CELLS = 120;

/** How many file types the panel lists. Past this the rows are a long
 * tail of single files and the panel stops being scannable. */
const PANEL_ROWS = 14;

/** How many files the list shows. WizTree's is unbounded and virtualised;
 * this is the honest depth for a plain list -- past it the sizes flatten
 * out and nothing on screen is worth acting on. */
const FILE_ROWS = 60;

function TreemapCell({ x, y, width, height, depth, name, size, type, scanned, aggregated, fullPath, icons, onHover, onLeave, onDrillDown }) {
  if (depth === 0 || !(width > 0) || !(height > 0)) return null;
  const fill = colorForNode({ name, type, scanned: scanned === false || aggregated ? false : scanned });
  // An unscanned block is a hole in the picture, not a folder. Clicking
  // it would scan a path that may not even exist (the whole-drive
  // remainder isn't a real directory), and its size is a subtraction
  // rather than a measurement. The aggregate cell is the same: a count,
  // not a place.
  const canDrillDown = scanned !== false && !aggregated && type === 'directory' && Boolean(fullPath);

  // The icon needs room for itself AND for the label to still say
  // something; below that the cell reads better as a plain block of
  // colour than as a mystery glyph with two letters next to it.
  const iconSrc = aggregated ? null : icons?.[iconKeyForNode({ name, type, scanned })];
  const showIcon = Boolean(iconSrc) && width > 74 && height > 26;

  const textX = x + (showIcon ? ICON_SIZE + 10 : 6);
  const roomForText = Math.max(0, x + width - textX - 4);
  const showLabel = width > 60 && height > 22 && roomForText > 18;
  const maxChars = Math.floor(roomForText / 6.4);
  const label = name.length > maxChars ? `${name.slice(0, Math.max(1, maxChars - 1))}…` : name;

  return (
    <g
      // onMouseEnter only. This used to also fire on every mousemove,
      // which set React state and re-rendered every cell in the treemap
      // -- 1,903 of them inside C:\Windows\System32. A 60-move sweep took
      // over three minutes. The tooltip still follows the cursor; it's
      // moved by a single listener on the container that writes to the
      // element's style directly, without a render.
      onMouseEnter={(e) => onHover({ name, size, fullPath, type, scanned, aggregated }, e)}
      onMouseLeave={onLeave}
      onClick={() => canDrillDown && onDrillDown(fullPath)}
      style={{ cursor: canDrillDown ? 'pointer' : 'default' }}
    >
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--bg-navy)" strokeWidth={1.5} rx={3} />
      {showIcon && (
        <image
          href={iconSrc}
          x={x + 6}
          y={y + 5}
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {showLabel && (
        <text
          x={textX}
          y={y + 17}
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


/** What the space went TO, beside the map that shows where it went.
 *
 * WizTree puts this next to its treemap and it answers a question the map
 * cannot: a folder view will never reveal that a third of the drive is
 * .pdb files spread across a dozen projects.
 *
 * The footer is not decoration. These rows only cover files the scan
 * actually reached as leaves, and the folder-by-folder scanner stops at a
 * depth limit -- 33.4 GB categorised out of a 35.1 GB tree here. A panel
 * that printed only the first number would be quietly claiming the
 * second. */
function ExtensionPanel({ breakdown, shown, icons }) {
  const { rows, totalBytes, totalFiles, uncategorizedBytes } = breakdown;
  if (rows.length === 0) return null;

  return (
    <div className="glass-panel p-4 min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
          By file type
        </div>
        <div className="text-[11px] font-mono text-[color:var(--text-muted)]">
          {rows.length} types
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {shown.map((row) => (
          <div key={row.extension} className="flex items-center gap-2.5">
            {icons?.[row.extension] ? (
              <img src={icons[row.extension]} alt="" width={16} height={16} className="w-4 h-4 shrink-0 object-contain" />
            ) : (
              <div className="w-4 h-4 shrink-0" />
            )}
            <div className="font-mono text-[11.5px] text-[color:var(--text-primary)] w-[74px] shrink-0 truncate">
              {row.extension === NO_EXTENSION ? 'no type' : row.extension}
            </div>

            {/* The bar carries the comparison; the number carries the
                fact. Sharing one row keeps both readable at a glance. */}
            <div className="flex-1 h-[6px] rounded-full bg-white/[0.05] overflow-hidden min-w-0">
              <div
                className="h-full rounded-full bg-[color:var(--accent-coral)]"
                style={{ width: `${Math.max(row.percent, 0.6)}%` }}
              />
            </div>

            <div
              className="font-mono text-[11.5px] text-[color:var(--text-secondary)] w-[68px] text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatBytes(row.sizeBytes)}
            </div>
            <div
              className="font-mono text-[11px] text-[color:var(--text-muted)] w-[46px] text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {row.percent.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[color:var(--border-subtle)] text-[11px] font-mono text-[color:var(--text-muted)]">
        {formatBytes(totalBytes)} across {totalFiles.toLocaleString()} files
        {uncategorizedBytes > 0 && (
          <> · {formatBytes(uncategorizedBytes)} in folders the scan did not open</>
        )}
      </div>
    </div>
  );
}


/** The biggest individual files, WizTree's second tab.
 *
 * A treemap is good at showing that a folder is enormous and bad at
 * showing that one file inside it is the reason. Satisfactory's 8.4 GB
 * .ucas is a quarter of everything scanned here and the map draws it as
 * an indistinguishable slab inside Games.
 *
 * Paths are shown in full and are the point of the view: this is the list
 * you act on, and "FactoryGame-Windows.ucas" without its folder is not
 * something anyone can find again. */
function LargestFilesView({ files, icons }) {

  if (files.length === 0) {
    return (
      <div className="glass-panel p-6 text-[13px] text-[color:var(--text-muted)]">
        The scan found no files to list.
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 min-w-0">
      <div className="flex flex-col">
        {files.map((file) => (
          <div
            key={file.fullPath || file.name}
            className="flex items-center gap-2.5 py-[5px] border-b border-[color:var(--border-subtle)] last:border-b-0"
          >
            {icons?.[extensionOf(file.name) ?? GENERIC_FILE_KEY] ? (
              <img
                src={icons[extensionOf(file.name) ?? GENERIC_FILE_KEY]}
                alt="" width={16} height={16}
                className="w-4 h-4 shrink-0 object-contain"
              />
            ) : (
              <div className="w-4 h-4 shrink-0" />
            )}
            <div
              className="font-mono text-[12px] text-[color:var(--accent-coral)] w-[86px] text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatBytes(file.size)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-[color:var(--text-primary)] truncate">{file.name}</div>
              {file.fullPath && (
                <div className="text-[11px] font-mono text-[color:var(--text-muted)] truncate">{file.fullPath}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/** WizTree's Tree View: what is directly inside the folder in view, as a
 * sortable table.
 *
 * The map answers "which of these is big" and nothing else. It cannot say
 * that a 29 GB folder holds 52,780 items, or when it was last touched,
 * and those are what decide whether a folder is worth opening.
 *
 * Two of WizTree's columns are deliberately absent. Allocated size was
 * measured in this project and thrown out -- it summed to 1270 GB on a
 * 952.9 GB volume, so it fails its own sanity check. Windows file
 * attributes are not on a Node stat and nothing in the scan carries them.
 * An empty column would be worse than no column. */
const FOLDER_COLUMNS = [
  { key: 'name', label: 'Folder', align: 'left', width: 'minmax(180px,1fr)' },
  { key: 'percentOfParent', label: '% of parent', align: 'right', width: '104px' },
  { key: 'size', label: 'Size', align: 'right', width: '96px' },
  { key: 'items', label: 'Items', align: 'right', width: '84px' },
  { key: 'files', label: 'Files', align: 'right', width: '84px' },
  { key: 'folders', label: 'Folders', align: 'right', width: '84px' },
  { key: 'modified', label: 'Modified', align: 'right', width: '104px' }
];

const FOLDER_GRID = FOLDER_COLUMNS.map((c) => c.width).join(' ');

/** A count that was never taken reads as a dash, never as zero. */
function Count({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-[color:var(--text-muted)]">—</span>;
  }
  return <>{value.toLocaleString()}</>;
}

function FolderTable({ tree, onDrillDown }) {
  const [sort, setSort] = useState({ column: 'size', direction: 'desc' });
  const rows = useMemo(
    () => sortFolderRows(folderTableRows(tree), sort.column, sort.direction),
    [tree, sort]
  );

  if (rows.length === 0) {
    return (
      <div className="glass-panel p-6 text-[13px] text-[color:var(--text-muted)]">
        Nothing to list inside this folder.
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden min-w-0">
      <div
        className="grid gap-3 px-4 py-2 border-b border-[color:var(--border-subtle)] bg-white/[0.02]"
        style={{ gridTemplateColumns: FOLDER_GRID }}
      >
        {FOLDER_COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => setSort((s) => nextFolderSort(s, col.key))}
            className={`flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.12em] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors ${
              col.align === 'right' ? 'justify-end' : ''
            }`}
          >
            {col.label}
            {sort.column === col.key && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" className="shrink-0">
                {sort.direction === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="max-h-[520px] overflow-y-auto divide-y divide-[color:var(--border-subtle)]">
        {rows.map((row) => (
          <div
            key={row.fullPath || row.name}
            className={`grid gap-3 px-4 py-[7px] items-center ${
              row.scanned && row.type === 'directory' && row.fullPath
                ? 'cursor-pointer hover:bg-white/[0.04] transition-colors'
                : ''
            }`}
            style={{ gridTemplateColumns: FOLDER_GRID }}
            onClick={() => {
              // Only a folder the scan actually opened is worth drilling
              // into -- clicking an unscanned block would scan a path we
              // have no evidence even exists.
              if (row.scanned && row.type === 'directory' && row.fullPath) onDrillDown(row.fullPath);
            }}
          >
            <div className="text-[12.5px] text-[color:var(--text-primary)] truncate min-w-0">
              {row.name}
              {!row.scanned && (
                <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-[color:var(--text-muted)]">
                  not scanned
                </span>
              )}
            </div>
            <div className="text-[11.5px] font-mono text-right text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {row.scanned ? `${row.percentOfParent.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[12px] font-mono text-right text-[color:var(--accent-coral)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {row.scanned ? formatBytes(row.size) : '—'}
            </div>
            <div className="text-[11.5px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Count value={row.items} />
            </div>
            <div className="text-[11.5px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Count value={row.files} />
            </div>
            <div className="text-[11.5px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Count value={row.folders} />
            </div>
            <div className="text-[11.5px] font-mono text-right text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {row.modified ? new Date(row.modified).toLocaleDateString() : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
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
  // Real used space, so a truncated scan can show how much of the drive
  // it never got to instead of presenting a fragment as the whole thing.
  //
  // A ref rather than state on purpose: as a dependency of the scan
  // effect it would land mid-scan, abort the 30-second walk already in
  // flight and start the whole thing again. /api/disk-space answers in
  // milliseconds while the scan takes half a minute, so the value is
  // always here long before the scan's .then() reads it.
  const usedBytesRef = useRef(null);
  // Windows' own file-type icons, keyed by extension (plus "folder" and
  // "file"). Fetched for whatever is on screen and accumulated, so
  // drilling into a folder only ever asks about types not already held.
  const [typeIcons, setTypeIcons] = useState({});
  const [view, setView] = useState('map');

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
    let cancelled = false;
    fetchDiskSpace()
      .then((d) => {
        // The API reports free and total; used is the subtraction. Read
        // straight off the response rather than assumed -- there is no
        // `usedBytes` field, and reading one gave undefined silently.
        if (cancelled || typeof d?.totalBytes !== 'number' || typeof d?.freeBytes !== 'number') return;
        usedBytesRef.current = d.totalBytes - d.freeBytes;
      })
      .catch(() => { /* the remainder block is an enhancement, never a blocker */ });
    return () => { cancelled = true; };
  }, []);

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
      .then((result) => setTree(attachFullPaths(
        // Only at a drive root: a truncated scan of a subfolder has no
        // used-space figure to reconcile against.
        isDriveRoot(currentPath) ? withUnscannedRemainder(result, usedBytesRef.current) : result,
        currentPath
      )))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [currentPath, fastTree]);

  // Capped: a folder like System32 has ~1,900 direct children, and
  // drawing every one produced 10,086 DOM nodes and made the whole view
  // crawl. Past this many the rects are a few pixels wide and say
  // nothing that the aggregate cell doesn't say better.
  const cells = tree ? limitCells(topLevelCells(tree), MAX_CELLS) : [];

  // Computed here rather than inside the panel so the icon fetch below can
  // ask for exactly the types the panel is about to show.
  const breakdown = useMemo(() => extensionBreakdown(tree), [tree]);
  const shownExtensions = useMemo(() => breakdown.rows.slice(0, PANEL_ROWS), [breakdown]);
  const topFiles = useMemo(() => largestFiles(tree, { limit: FILE_ROWS }), [tree]);

  useEffect(() => {
    const wanted = [
      ...extensionsInCells(cells),
      // The by-file-type panel names types that need not appear anywhere
      // in the top-level cells -- .pdb is 41% of this drive and not a
      // single top-level folder is called that.
      ...shownExtensions.map((row) => row.extension).filter((ext) => ext !== NO_EXTENSION),
      // And the file list names types that need not be in the top 14
      // either: one enormous .iso is unremarkable by total size.
      ...topFiles.map((file) => extensionOf(file.name)).filter(Boolean)
    ];
    const missing = [...new Set(wanted)].filter((ext) => !(ext in typeIcons));
    // "folder" and "file" ride along with every response, so an empty
    // icon map still needs one initial call.
    if (missing.length === 0 && Object.keys(typeIcons).length > 0) return;

    let cancelled = false;
    fetchFileTypeIcons(missing)
      .then((result) => {
        if (cancelled) return;
        // Merged, not replaced: a later folder's response carries only
        // the types it asked about, and replacing would drop the rest.
        setTypeIcons((prev) => ({ ...prev, ...result }));
      })
      .catch(() => { /* icons are decoration -- the map works without them */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const tooltipRef = useRef(null);

  const handleHover = useCallback((node, e) => {
    // Content only. Position is written straight to the element below,
    // so moving the cursor never triggers a render.
    setHovered({ node, clientX: e.clientX, clientY: e.clientY });
  }, []);

  /** Moves the tooltip by writing to the DOM directly.
   *
   * One listener on the container, not one per cell, and no state: with
   * ~1,900 cells a state update per mousemove re-rendered the entire
   * treemap and made the view unusable. */
  const handleContainerMouseMove = useCallback((e) => {
    const el = tooltipRef.current;
    if (el) el.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
  }, []);
  const handleLeave = useCallback(() => setHovered(null), []);
  const coverage = scanCoverage(tree);
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
            {coverage
              // The concrete number matters more than the warning does. "Possibly
              // incomplete" reads as a rounding caveat; "measured 34.5 GB of 850 GB"
              // tells you immediately that the picture is nearly all hole.
              ? <>This scan ran out of time: it measured <span className="font-medium text-white">{formatBytes(coverage.measured)}</span> of
                the <span className="font-medium text-white">{formatBytes(coverage.used)}</span> in use ({coverage.percent}%).
                What it measured is real; the rest is shown as unscanned, not as empty.</>
              : <>This scan ran out of time before it finished the drive. Everything it did measure
                is real, but folders it never reached are shown as unscanned rather than as empty —
                don't read this as a full picture of what's using your space.</>}
            {' '}<button
              className="underline underline-offset-2 hover:text-[color:var(--text-primary)] transition-colors disabled:opacity-50"
              onClick={handleFastScan}
              disabled={fastScanning}
            >
              {fastScanning ? 'Scanning drive…' : 'Run a fast scan instead'}
            </button>
          </div>
        </div>
      )}

      {/* WizTree splits the same data into a Tree View and a File View, and
          the split earns its place: the map answers "which folder" and the
          list answers "which file". */}
      {!loading && !error && tree && (
        <div className="flex items-center gap-1 mb-3">
          {[['map', 'Map'], ['folders', 'Folders'], ['files', 'Largest files']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                view === key
                  ? 'bg-[color:var(--accent-coral)] text-white'
                  : 'text-[color:var(--text-secondary)] hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!loading && !error && tree && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
          {view === 'files' ? (
            <LargestFilesView files={topFiles} icons={typeIcons} />
          ) : view === 'folders' ? (
            <FolderTable tree={tree} onDrillDown={handleDrillDown} />
          ) : (
          <div className="glass-panel p-4" style={{ position: 'relative' }} onMouseMove={handleContainerMouseMove}>
            <ResponsiveContainer width="100%" height={520}>
              <Treemap
                data={cells}
                dataKey="size"
                isAnimationActive={false}
                content={<TreemapCell icons={typeIcons} onHover={handleHover} onLeave={handleLeave} onDrillDown={handleDrillDown} />}
              />
            </ResponsiveContainer>
          </div>
          )}
          <ExtensionPanel breakdown={breakdown} shown={shownExtensions} icons={typeIcons} />
        </div>
      )}

      {/* Rendered into <body>, not beside the treemap.
          `position: fixed` is resolved against the nearest ancestor that
          establishes a containing block, and .glass-panel has
          `backdrop-filter: blur(24px)` -- which does exactly that, the
          same way `transform` does. So the tooltip's viewport coordinates
          were being measured from the panel's top-left corner instead,
          and it appeared offset from the cursor by however far down the
          page the panel sat. A portal puts it back in the viewport's own
          coordinate space, and also stops the panel's bounds clipping it
          near an edge. */}
      {hovered && createPortal(
        <div
          ref={tooltipRef}
          className="diskmap-tooltip"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            transform: `translate(${hovered.clientX + 14}px, ${hovered.clientY + 14}px)`,
            zIndex: 50,
            pointerEvents: 'none'
          }}
        >
          <div className="text-[13px] font-medium text-[color:var(--text-primary)] mb-1">{hovered.node.name}</div>
          <div className="text-[12px] text-[color:var(--accent-coral)] mb-1">
            {hovered.node.scanned === false ? `${formatBytes(hovered.node.size)} not measured` : formatBytes(hovered.node.size)}
          </div>
          <div className="text-[11px] font-mono text-[color:var(--text-muted)] break-all max-w-[320px]">
            {hovered.node.aggregated
              ? 'The smallest entries in this folder, grouped together.'
              : hovered.node.scanned === false
                ? 'The scan stopped before reaching this. Its real size is unknown.'
                : hovered.node.fullPath}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
