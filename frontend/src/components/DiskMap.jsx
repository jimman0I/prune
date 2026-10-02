import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { tooltipPosition } from '../lib/tooltipPosition.js';
import { useDiskSpace, useSettings } from '../hooks/useSystemQueries.js';
import { mapTreeFor } from '../lib/freeSpaceBlock.js';
import { createPortal } from 'react-dom';
import { Treemap, ResponsiveContainer } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { keys } from '../lib/queryClient.js';
import { breadcrumbTrail } from '../lib/breadcrumbTrail.js';
import { fetchDiskScan, stopDiskScan, scanDriveFast, fetchFileTypeIcons, quarantineDiskPath, revealInExplorer } from '../lib/api.js';
import { useToasts } from '../hooks/useToasts.jsx';
import ContextMenu from './ContextMenu.jsx';
import ModalOverlay from './ModalOverlay.jsx';
import { attachFullPaths, topLevelCells } from '../lib/diskMapTree.js';
import { subtreeForPath } from '../lib/mftSubtree.js';
import { NO_EXTENSION } from '../lib/extensionBreakdown.js';
import { useDiskMapAggregates } from '../hooks/useDiskMapAggregates.js';
import { withUnscannedRemainder, scanCoverage, localizeUnscanned } from '../lib/unscannedRemainder.js';
import { buildTypeColors, colorForExtension, colorForNode, inkForFill, NO_EXTENSION_COLOR } from '../lib/fileTypeColors.js';
import { iconKeyForNode, extensionsInCells, extensionOf, GENERIC_FILE_KEY } from '../lib/fileTypeIcon.js';
import { limitCells } from '../lib/limitCells.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import DiskScanProgress from './DiskScanProgress.jsx';
import { DrivePicker } from './DrivePicker.jsx';
import { FolderTable } from './FolderTable.jsx';
import { SearchBox } from './SearchBox.jsx';
import { compileFilter } from '../lib/searchFilter.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { LargestFilesView } from './LargestFilesView.jsx';
import { RowActionsButton } from './RowActionsButton.jsx';
import { useDrives } from '../hooks/useDrives.js';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import { readScanMode, writeScanMode } from '../lib/scanMode.js';
import { driveLetterOf, rootOfDrive, drivesFromScan } from '../lib/driveRoot.js';
import { readFastScanMs, writeFastScanMs } from '../lib/fastScanDuration.js';

const DEFAULT_ROOT = 'C:\\';

/** localStorage, or null where even touching it throws (site data blocked). */
function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

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

/** A spinner and the word "Scanning" is the wrong answer to a wait this
 * long. So this says what is being read, how much has been read so far, how
 * long it can take, and what the faster option is. A minute of silence is
 * where people decide software has hung.
 *
 * A thin wrapper over DiskScanProgress. `percent`, `files` and `bytes` come
 * from the scan's real progress events; when the scan has no known total,
 * `percent` is null and no percentage is drawn -- never a made-up one. */
export function LoadingState({ path, onFastScan, fastScanning, percent, files, bytes, remainingMs, remainingAt, onStop }) {
  const { t } = useLanguage();
  return (
    <DiskScanProgress status="scanning" path={path} percent={percent} files={files} bytes={bytes}
      remainingMs={remainingMs} remainingAt={remainingAt} onStop={onStop}>
      {onFastScan && (
        <button
          className="btn-ghost mt-4 px-3.5 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
          onClick={onFastScan}
          disabled={fastScanning}
        >
          {fastScanning ? t('diskMap.readingDrive') : t('diskMap.loading.indexButton')}
        </button>
      )}
    </DiskScanProgress>
  );
}

/** The drive-root chooser, shown before any scan has been picked. Exported
 * so a render test can assert on it without scanning anything.
 *
 * Two options side by side, left-aligned with the page title, each with a
 * title, one line on what it does, one on its catch, and its own button.
 * The recommended one says so. Contained: the row caps its width, wraps an
 * unbreakable token instead of overflowing, and stacks below 640px so the
 * 900px minimum window never clips it. */
function ScanOption({ title, badge, explain, note, recommended, children }) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl p-5 border ${
        recommended
          ? 'border-[color:var(--control-border)] bg-[color:var(--surface-hover)]'
          : 'border-[color:var(--border-subtle)] bg-[color:var(--surface-hover)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-[color:var(--text-primary)]">{title}</h3>
        {badge && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-[color:var(--control-border)] text-[color:var(--text-secondary)]">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[13px] text-[color:var(--text-primary)]">{explain}</p>
      {typeof note === 'string' ? <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-3">{note}</p> : note}
      <div className="mt-auto">{children}</div>
    </div>
  );
}

/** The other NTFS drives that can ride along on this fast scan, as
 * checkboxes. They share the one administrator prompt the scan raises, which
 * is the point of offering them here rather than as separate scans. */
function AlsoScanDrives({ drives, alsoScan, onToggle }) {
  const { t } = useLanguage();
  if (!drives || drives.length === 0) return null;
  return (
    <fieldset className="mb-3 min-w-0">
      <legend className="text-[12px] font-medium text-[color:var(--text-primary)] mb-1.5">
        {t('diskMapV3.drives.alsoScan')}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {drives.map((drive) => (
          <label key={drive.letter} className="flex items-center gap-1.5 text-[12.5px] text-[color:var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={alsoScan.has(drive.letter)}
              onChange={() => onToggle(drive.letter)}
              className="accent-[color:var(--accent-primary)]"
            />
            <span className="font-mono">{drive.letter}:</span>
            {drive.label && <span className="truncate max-w-[14ch]">{drive.label}</span>}
          </label>
        ))}
      </div>
      <p className="text-[11.5px] text-[color:var(--text-muted)] mt-1.5">{t('diskMapV3.drives.alsoScanNote')}</p>
    </fieldset>
  );
}

/** What the fast scan needs, said plainly: nothing when Prune already has
 * administrator rights, otherwise the reason and the one-time fix. */
function AdminAccessNote({ admin }) {
  const { t } = useLanguage();
  if (admin.elevated) {
    return <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-3">{t('diskMapV3.elevation.runningAsAdmin')}</p>;
  }
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <p className="text-[12.5px] text-[color:var(--text-secondary)]">{t('diskMap.driveRootPrompt.fastNeeds')}</p>
      <p className="text-[12.5px] text-[color:var(--text-secondary)]">{t('diskMapV3.elevation.why')}</p>
      {admin.canRestart && (
        <>
          <p className="text-[12.5px] text-[color:var(--text-secondary)]">{t('diskMapV3.elevation.restartHint')}</p>
          <div>
            <button
              type="button"
              className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
              onClick={admin.onRestart}
              disabled={admin.restarting}
            >
              {admin.restarting ? t('diskMapV3.elevation.restarting') : t('diskMapV3.elevation.restartButton')}
            </button>
          </div>
        </>
      )}
      {admin.outcome?.kind === 'declined' && (
        <p role="status" className="text-[12.5px] text-[color:var(--warning)]">{t('diskMapV3.elevation.restartDeclined')}</p>
      )}
      {admin.outcome?.kind === 'failed' && (
        <p role="status" className="text-[12.5px] text-[color:var(--warning)] select-text">
          {t('diskMapV3.elevation.restartFailed', admin.outcome.error)}
        </p>
      )}
    </div>
  );
}

export function DriveRootPrompt({ path, onFastScan, fastScanning, onCrawl, otherDrives, alsoScan, onToggleAlso, fastUnavailable, admin, lastMode }) {
  const { t } = useLanguage();
  const crawlFirst = lastMode === 'crawl';
  return (
    <section className="w-full max-w-[860px] leading-[1.55] [overflow-wrap:anywhere]">
      <h2 className="text-[18px] font-semibold text-[color:var(--text-primary)] mb-4">
        {t('diskMap.driveRootPrompt.heading')}
      </h2>
      <div className="grid gap-4 grid-cols-1 min-[640px]:grid-cols-2">
        <ScanOption
          recommended={!fastUnavailable}
          title={t('diskMap.driveRootPrompt.fastTitle')}
          badge={fastUnavailable ? undefined : t('diskMap.driveRootPrompt.recommended')}
          explain={t('diskMap.driveRootPrompt.fastExplain', path.replace(/\\+$/, ''))}
          note={fastUnavailable ? t('diskMapV3.drives.notNtfs') : admin ? <AdminAccessNote admin={admin} /> : t('diskMap.driveRootPrompt.fastNeeds')}
        >
          {!fastUnavailable && otherDrives && onToggleAlso && (
            <AlsoScanDrives drives={otherDrives} alsoScan={alsoScan ?? new Set()} onToggle={onToggleAlso} />
          )}
          <button className={`${crawlFirst ? 'btn-ghost px-3.5 text-[12.5px]' : 'btn-primary px-4 text-[13px]'} py-2 rounded-lg font-medium disabled:opacity-50`}
            onClick={onFastScan}
            disabled={fastScanning || fastUnavailable}
          >
            {fastScanning ? t('diskMap.readingDrive') : t('diskMap.fastScanButton')}
          </button>
        </ScanOption>
        <ScanOption
          title={t('diskMap.driveRootPrompt.crawlTitle')}
          explain={t('diskMap.driveRootPrompt.crawlExplain')}
          note={t('diskMap.driveRootPrompt.crawlLimit')}
        >
          <button
            className={`${crawlFirst ? 'btn-primary px-4 text-[13px]' : 'btn-ghost px-3.5 text-[12.5px]'} py-2 rounded-lg font-medium`}
            onClick={onCrawl}
          >
            {t('diskMap.driveRootPrompt.crawlButton')}
          </button>
        </ScanOption>
      </div>
    </section>
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

/** What the breakdown/largest-files panels read before
 * useDiskMapAggregates' worker has answered for the current tree.
 * Module-level and reused rather than built fresh per render, so a
 * consumer's own `useMemo` (shownExtensions, typeColors) doesn't see a
 * new object identity on every render while nothing has actually
 * changed. Shaped exactly like extensionBreakdown()'s and largestFiles()'
 * own real return values -- an empty result, not a different one. */
const EMPTY_BREAKDOWN = { rows: [], totalBytes: 0, totalFiles: 0, treeBytes: 0, uncategorizedBytes: 0 };
const EMPTY_FILES = [];
const EMPTY_FOLDER_ROWS = [];

function TreemapCell({ x, y, width, height, depth, name, size, type, scanned, aggregated, fullPath, searchMatch, icons, typeColors, onHover, onLeave, onDrillDown, onContextMenu }) {
  const { t } = useLanguage();
  if (depth === 0 || !(width > 0) || !(height > 0)) return null;
  const fill = colorForNode({ name, type, scanned: scanned === false || aggregated ? false : scanned }, typeColors);
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
      // The search box's verdict on this cell, when there is a search:
      // "true" for a match, "false" for everything else. Absent otherwise.
      data-name={name}
      data-search-match={searchMatch === undefined ? undefined : String(searchMatch)}
      className={`treemap-cell${canDrillDown ? ' treemap-cell--clickable' : ''}`}
      // ONE style prop. There were briefly two -- an animationDelay added
      // beside the existing cursor -- and JSX silently keeps the last, so
      // the stagger was dropped and every cell revealed at once. It looked
      // fine, which is why it survived a live check that read the computed
      // delay as "0s" without anyone asking why.
      //
      // Delay taken from the cell's own position rather than an index, so
      // the reveal sweeps across the map instead of firing in whatever
      // order the layout happened to emit. Capped: the largest cells sit
      // top-left and should not wait on the long tail.
      style={{
        animationDelay: `${Math.min(260, (x + y) * 0.22)}ms`,
        cursor: canDrillDown ? 'pointer' : 'default'
      }}
      // onMouseEnter only. This used to also fire on every mousemove,
      // which set React state and re-rendered every cell in the treemap
      // -- 1,903 of them inside C:\Windows\System32. A 60-move sweep took
      // over three minutes. The tooltip still follows the cursor; it's
      // moved by a single listener on the container that writes to the
      // element's style directly, without a render.
      /* Reachable and operable without a mouse.
       *
       * The map was pointer-only: no cell was focusable, so a keyboard
       * user could see the picture and do nothing with it -- not drill
       * into a folder, not reach the removal menu. Only the cells that
       * actually DO something are put in the tab order; a cell that
       * cannot be opened is a coloured rectangle, and stopping on it
       * would be a tab stop that leads nowhere.
       *
       * Enter and Space activate, matching the click. Focus also raises
       * the tooltip, so what the pointer reveals on hover is not
       * information only a mouse can get at. */
      tabIndex={canDrillDown ? 0 : undefined}
      role={canDrillDown ? 'button' : undefined}
      aria-label={canDrillDown ? t('diskMap.cellOpenLabel', name) : undefined}
      onFocus={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onHover({ name, size, fullPath, type, scanned, aggregated }, {
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2
        });
      }}
      onBlur={onLeave}
      onKeyDown={(e) => {
        if (!canDrillDown) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDrillDown(fullPath);
        }
      }}
      onMouseEnter={(e) => onHover({ name, size, fullPath, type, scanned, aggregated }, e)}
      onMouseLeave={onLeave}
      onClick={() => canDrillDown && onDrillDown(fullPath)}
      // An unscanned or aggregate block is not a place -- there is no path
      // to open, copy or remove -- so it gets no menu rather than a menu
      // of disabled items.
      onContextMenu={(e) => {
        if (!fullPath || aggregated || scanned === false) return;
        e.preventDefault();
        onContextMenu({ name, size, fullPath, type }, e);
      }}
    >
      <rect
        x={x} y={y} width={width} height={height} fill={fill} rx={3}
        // A match gets a ring in the accent colour; everything else steps
        // back. The ring is a stroke, not an opacity change, so a match still
        // reads at full strength next to dimmed neighbours.
        stroke={searchMatch === true ? 'var(--accent-primary)' : 'var(--bg-base)'}
        strokeWidth={searchMatch === true ? 3 : 1.5}
        opacity={searchMatch === false ? 0.22 : undefined}
      />
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
          // Ink chosen from the fill's own luminance (fileTypeColors.js), at
          // full opacity: white at 85% was 2 to 3.4:1 on the light hues.
          fill={inkForFill(fill)}
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
function ExtensionPanel({ breakdown, shown, icons, typeColors }) {
  const { t } = useLanguage();
  const { rows, totalBytes, totalFiles, uncategorizedBytes } = breakdown;
  if (rows.length === 0) return null;

  return (
    <div className="glass-panel p-4 min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
          {t('diskMap.extensionPanel.header')}
        </div>
        <div className="text-[11px] font-mono text-[color:var(--text-muted)]">
          {t('diskMap.extensionPanel.typeCount', rows.length)}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {shown.map((row) => (
          <div key={row.extension} className="flex items-center gap-2.5">
            {/* The swatch is what makes this a legend rather than a second
                table. Every cell of that type on the map is painted this
                colour, so "which folders hold my .pak files" is answered
                by looking, not by clicking. */}
            <div
              className="w-[10px] h-[10px] rounded-[2px] shrink-0"
              style={{ background: row.extension === NO_EXTENSION ? NO_EXTENSION_COLOR : colorForExtension(row.extension, typeColors) }}
            />
            {icons?.[row.extension] ? (
              <img src={icons[row.extension]} alt="" width={16} height={16} className="w-4 h-4 shrink-0 object-contain" />
            ) : (
              <div className="w-4 h-4 shrink-0" />
            )}
            <div className="font-mono text-[11.5px] text-[color:var(--text-primary)] w-[62px] shrink-0 truncate">
              {row.extension === NO_EXTENSION ? t('diskMap.extensionPanel.noType') : row.extension}
            </div>

            {/* The bar carries the comparison; the number carries the
                fact. Sharing one row keeps both readable at a glance. */}
            <div className="flex-1 h-[6px] rounded-full bg-[color:var(--surface-hover)] overflow-hidden min-w-0">
              {/* Grows in rather than snapping to width: the breakdown is
                  computed off the main thread (useDiskMapAggregates) and
                  can land a moment after the row itself first paints at
                  0.6% -- the growth is the process resolving, not
                  decoration on a value that was already final. */}
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: `${Math.max(row.percent, 0.6)}%`,
                  background: row.extension === NO_EXTENSION ? NO_EXTENSION_COLOR : colorForExtension(row.extension, typeColors)
                }}
              />
            </div>

            <div
              className="font-mono text-[11.5px] text-[color:var(--text-secondary)] w-[62px] text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatBytes(row.sizeBytes)}
            </div>
            <div
              className="font-mono text-[11px] text-[color:var(--text-muted)] w-[42px] text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {row.percent.toFixed(1)}%
            </div>
            {/* WizTree's own Files column. A type can be big because one
                file is enormous or because there are 391,670 of them, and
                those are different problems with different fixes. */}
            <div
              className="font-mono text-[11px] text-[color:var(--text-muted)] w-[52px] text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {row.fileCount?.toLocaleString() ?? '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[color:var(--border-subtle)] text-[11px] font-mono text-[color:var(--text-muted)]">
        {t('diskMap.extensionPanel.footer', formatBytes(totalBytes), totalFiles.toLocaleString())}
        {uncategorizedBytes > 0 && (
          <>{t('diskMap.extensionPanel.unopenedFolders', formatBytes(uncategorizedBytes))}</>
        )}
      </div>
    </div>
  );
}


// Re-exported: the render tests (and anything else) have always imported it from here.
export { LargestFilesView };

/** Why a folder could not be scanned, naming the folder it was reading.
 * Exported so it can be tested without scanning a real drive. */
export function ScanFailure({ path, error, onRetry }) {
  const { t } = useLanguage();
  return (
    <DiskScanProgress status="error" message={t('diskMap.scanFailure', path, error)} onRetry={onRetry} />
  );
}

/** Why the fast scan did not run: declined, or Windows' own reason. */
export function FastScanNote({ note }) {
  return (
    <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
      <p className="text-[12.5px] text-[color:var(--warning)] select-text">{note}</p>
    </div>
  );
}

function DiskMap() {
  const { t } = useLanguage();
  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT);
  const [hovered, setHovered] = useState(null);
  // Whole drives, read from the MFT in one pass, by drive letter. While a
  // drive is in here, browsing it is pure navigation through data already
  // in memory -- no further disk access at all.
  const [fastTrees, setFastTrees] = useState({});
  // The other drives ticked to ride along on the next fast scan.
  const [alsoScan, setAlsoScan] = useState(() => new Set());
  const [fastScanning, setFastScanning] = useState(false);
  const [fastNote, setFastNote] = useState(null);
  const [fastExpectedMs, setFastExpectedMs] = useState(null);
  // The latest real progress event of the folder-by-folder scan
  // ({type:'progress'|'complete', files/bytes/percent or totalFiles/
  // totalBytes}, plus the path it belongs to). Only ever set from the
  // backend's own events; a scan that reports nothing leaves it null.
  const [scanProgress, setScanProgress] = useState(null);
  // Real used space, so a truncated scan can show how much of the drive
  // it never got to instead of presenting a fragment as the whole thing.
  //
  // A ref rather than state on purpose: as a dependency of the scan
  // effect it would land mid-scan, abort the 30-second walk already in
  // flight and start the whole thing again. /api/disk-space answers in
  // milliseconds while the scan takes half a minute, so the value is
  // always here long before the scan's .then() reads it.
  const usedBytesRef = useRef({});
  // Windows' own file-type icons, keyed by extension (plus "folder" and
  // "file"). Fetched for whatever is on screen and accumulated, so
  // drilling into a folder only ever asks about types not already held.
  const [typeIcons, setTypeIcons] = useState({});
  const [view, setView] = useState('map');
  // The drives whose root the user chose to walk. Set only by the button that
  // says so: a whole-drive crawl is opt-in; see the effect below.
  const [crawlRoots, setCrawlRoots] = useState(() => new Set());

  const { drives, systemDrive } = useDrives();
  const admin = useAdminAccess();
  // How the user last chose to scan, so the chooser leads with it. It only
  // emphasises a button; it never starts a scan.
  const [lastMode, setLastMode] = useState(() => readScanMode(safeStorage()));
  const rememberMode = (mode) => { writeScanMode(safeStorage(), mode); setLastMode(mode); };
  const currentLetter = driveLetterOf(currentPath);
  const crawlRoot = crawlRoots.has(currentLetter);
  const currentDrive = drives?.find((d) => d.letter === currentLetter) ?? null;

  // Opens on the drive Windows lives on, which is not always C:. Once, and
  // only if nobody has chosen anything yet -- a drive picked before the list
  // arrived must not be overridden by it.
  const systemDriveApplied = useRef(false);
  useEffect(() => {
    if (!systemDrive || systemDriveApplied.current) return;
    systemDriveApplied.current = true;
    setCurrentPath((path) => (path === DEFAULT_ROOT ? rootOfDrive(systemDrive) : path));
  }, [systemDrive]);

  /** Explicit click only. This raises a real UAC prompt, so it can never
   * live in an effect -- see api.js. Every drive ticked goes in ONE request,
   * so it is one prompt however many are chosen. */
  const handleFastScan = async () => {
    rememberMode('fast');
    setFastScanning(true);
    setFastNote(null);
    // What the last successful fast scan took, read fresh at the click: the
    // card estimates from it. Nothing remembered means no estimate.
    setFastExpectedMs(readFastScanMs(safeStorage()));
    const startedAt = Date.now();
    const here = currentLetter ?? DEFAULT_ROOT.slice(0, 1);
    const letters = [here, ...[...alsoScan].filter((l) => l !== here)];
    try {
      const result = await scanDriveFast(letters);
      if (result.cancelled) {
        setFastNote(t('diskMap.fastScanDeclined'));
        return;
      }
      const { scanned, failures } = drivesFromScan(result, letters);
      // A drive that could not be read is said so, by name, beside the ones
      // that could -- the user approved a prompt for all of them.
      if (failures.length > 0) {
        setFastNote(failures.map((f) => t('diskMapV3.drives.failed', `${f.letter}:`, f.error)).join(' '));
      }
      if (scanned.length === 0) return;
      // Only a scan that actually finished is remembered. A declined prompt
      // (above) or a failure (the catch) would teach the estimate nonsense.
      writeFastScanMs(safeStorage(), Date.now() - startedAt);
      setFastTrees((prev) => {
        const next = { ...prev };
        for (const drive of scanned) {
          next[drive.letter] = { tree: attachFullPaths(drive.tree, rootOfDrive(drive.letter)), stats: drive.stats };
        }
        return next;
      });
      setAlsoScan(new Set());
      setCurrentPath(rootOfDrive(scanned.some((d) => d.letter === here) ? here : scanned[0].letter));
    } catch (err) {
      setFastNote(err.message);
    } finally {
      setFastScanning(false);
    }
  };

  /** Switching drive only changes which root is on screen. */
  const handleSelectDrive = (letter) => {
    setHovered(null);
    setAlsoScan(new Set());
    setCurrentPath(rootOfDrive(letter));
  };
  const handleToggleAlso = (letter) => setAlsoScan((prev) => {
    const next = new Set(prev);
    if (next.has(letter)) next.delete(letter); else next.add(letter);
    return next;
  });

  /* Through the query layer, sharing the Dashboard's cached reading
   * rather than issuing a second request for the same numbers.
   *
   * This was a bare useEffect + fetch while useDiskSpace already existed
   * -- the same defect that was fixed on the Dashboard one round earlier
   * and missed here, which is what an incomplete fix looks like.
   *
   * Still a ref rather than state: the used figure only feeds the
   * unscanned-remainder calculation, and holding it in state would
   * re-render the whole treemap when it lands. */
  const { diskSpace } = useDiskSpace();
  const { settings } = useSettings();
  useEffect(() => {
    const used = { ...usedBytesRef.current };
    // The API reports free and total; used is the subtraction. Read off
    // the response rather than assumed -- there is no `usedBytes` field,
    // and reading one gave undefined silently. /api/disk-space is the C:
    // figure; every drive in the picker brings its own.
    if (typeof diskSpace?.totalBytes === 'number' && typeof diskSpace?.freeBytes === 'number') {
      used.C = diskSpace.totalBytes - diskSpace.freeBytes;
    }
    for (const drive of drives ?? []) {
      if (typeof drive.totalBytes === 'number' && typeof drive.freeBytes === 'number') {
        used[drive.letter] = drive.totalBytes - drive.freeBytes;
      }
    }
    usedBytesRef.current = used;
  }, [diskSpace, drives]);

  // Already have the whole drive in memory? Then this folder is a lookup,
  // not a scan. Falling through to the recursive scanner here would undo
  // the entire point of having read the MFT.
  const fastEntry = currentLetter ? fastTrees[currentLetter] ?? null : null;
  const fastStats = fastEntry?.stats ?? null;
  const scannedLetters = useMemo(() => new Set(Object.keys(fastTrees)), [fastTrees]);
  const fastSubtree = useMemo(
    () => (fastEntry ? subtreeForPath(fastEntry.tree, currentPath) : null),
    [fastEntry, currentPath]
  );

  // A drive root is not worth crawling. Measured on this machine: the
  // folder-by-folder scan spent its whole time limit and reached 36 GB of
  // the 813.8 GB in use -- 4% -- so the default experience was a minute of
  // waiting for a picture that is 96% "unknown". The scan is not bad, it
  // is being asked the wrong question: it walks directories one at a time,
  // which is fine for a folder and hopeless for a volume.
  //
  // So at a drive root nothing runs until the user picks: the fast scan
  // (which reads the MFT and does the whole drive in seconds, and needs
  // admin for it) or the crawl anyway. Deliberately NOT an automatic
  // elevation request -- a UAC prompt that appears because a tab was
  // opened is how software teaches people to click Yes without reading.
  const shouldScan = Boolean(currentPath)
    && !fastSubtree
    && !(isDriveRoot(currentPath) && !crawlRoot);
  const nonNtfsRoot = isDriveRoot(currentPath) && currentDrive !== null && currentDrive.ntfs === false;

  // The signal this query provides is the whole reason it is a query.
  // Changing path or leaving the screen aborts it, which closes the HTTP
  // connection, which is what the backend's own req.on('close') handler
  // in routes/diskScan.js watches for -- so an abandoned scan really does
  // stop walking the filesystem instead of running to completion
  // unwatched. Found live: repeatedly navigating away from Disk Map and
  // back left every earlier scan still running server-side, all competing
  // for the same tiny fs thread pool.
  //
  // Keying on the path also means going back up to a folder already
  // scanned is now a cache read rather than a second walk of it, which is
  // the same pile-up from the other direction.
  const scanQuery = useQuery({
    queryKey: keys.diskScan(currentPath),
    enabled: shouldScan,
    retry: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      setScanProgress(null);
      // Whether the user pressed Stop, from the completion event. Stamped on
      // the tree below so the wording stays right when the tree outlives the
      // card (navigate away and back to a cached folder).
      let stoppedByUser = false;
      const result = await fetchDiskScan(currentPath, signal, {
        // An event that lands after the scan was abandoned (path changed,
        // screen left) belongs to nobody.
        onProgress: (event) => {
          if (signal.aborted) return;
          if (event.type === 'complete') stoppedByUser = event.stoppedByUser === true;
          // The completion event carries no percent or counters of its own,
          // so it is merged over the last real progress reading: the card
          // keeps showing what was actually read while the tree downloads.
          setScanProgress((prev) => ({
            ...(prev?.path === currentPath ? prev : null),
            ...event,
            path: currentPath,
            // When this reading arrived: the server's `remainingMs` is true
            // as of now, and the card counts down from here.
            receivedAt: Date.now()
          }));
        }
      });
      return attachFullPaths(
        // Only at a drive root: a truncated scan of a subfolder has no
        // used-space figure to reconcile against.
        isDriveRoot(currentPath)
          ? withUnscannedRemainder(stoppedByUser ? { ...result, stoppedByUser } : result, usedBytesRef.current[driveLetterOf(currentPath)] ?? null)
          : (stoppedByUser ? { ...result, stoppedByUser } : result),
        currentPath
      );
    }
  });

  // The block for the part the scan never reached carries a stable English
  // key as its stored name; what is drawn is the catalog's wording.
  const unscannedLabel = t('diskMap.unscannedLabel');
  const rawTree = fastSubtree ?? scanQuery.data ?? null;
  const tree = useMemo(() => localizeUnscanned(rawTree, unscannedLabel), [rawTree, unscannedLabel]);
  const loading = shouldScan && scanQuery.isFetching;
  // Progress belongs to one path; a reading left over from another folder's
  // scan is never shown against this one.
  const progressHere = scanProgress?.path === currentPath ? scanProgress : null;
  // A failed crawl is not worth reporting once the fast scan has answered
  // the same question -- the old code cleared this by hand after the MFT
  // read succeeded, and a derived error has to account for that itself.
  // An abort is the user changing folder, never a failure.
  const error = (!fastSubtree && scanQuery.error && !/abort/i.test(scanQuery.error.message || ''))
    ? scanQuery.error.message
    : null;


  // Capped: a folder like System32 has ~1,900 direct children, and
  // drawing every one produced 10,086 DOM nodes and made the whole view
  // crawl. Past this many the rects are a few pixels wide and say
  // nothing that the aggregate cell doesn't say better.
  // WizTree's "Show Free Space on Treemap", at a drive root only, and on
  // the map only: the folder table and the file-type breakdown describe
  // what is on the disk, and free space is not on it. scanCoverage keeps
  // reading `tree`, which never has the block.
  const mapTree = mapTreeFor(tree, {
    enabled: settings?.showFreeSpaceOnMap,
    atDriveRoot: isDriveRoot(currentPath),
    freeBytes: currentLetter === 'C' && typeof diskSpace?.freeBytes === 'number' ? diskSpace.freeBytes : currentDrive?.freeBytes
  });
  const cells = mapTree ? limitCells(topLevelCells(mapTree), MAX_CELLS, (count) => t('diskMap.aggregateCell', count)) : [];

  // The file-type breakdown, the largest-files list and the folder
  // table's counts, computed off the main thread: each is an honest
  // single pass over the WHOLE scanned tree, and at a drive root after a
  // full MFT fast scan that tree can be millions of nodes on a machine
  // this wasn't measured against. Three such passes back to back,
  // synchronously, in the render that just received the scan, is what
  // froze the whole app -- not just this tab -- on some machines.
  // useDiskMapAggregates falls back to computing these synchronously
  // wherever there is no Worker to post to (every test environment,
  // notably), so this still returns the exact same shapes there.
  // The search box. The folder rows and the map answer to every keystroke
  // (a screenful of items); the whole-tree search behind the File view waits
  // for a pause in typing, and is not run at all for an invalid pattern.
  const [searchText, setSearchText] = useState('');
  const filter = useMemo(() => compileFilter(searchText), [searchText]);
  const fileFilterText = useDebouncedValue(filter.active ? searchText : '', 250);
  const markedCells = useMemo(
    () => (filter.active ? cells.map((cell) => ({ ...cell, searchMatch: !cell.aggregated && filter.match(cell.name, cell.fullPath) })) : cells),
    [cells, filter]
  );
  const aggregates = useDiskMapAggregates(tree, { fileLimit: FILE_ROWS, filterText: fileFilterText });
  const breakdown = aggregates.result?.extensionBreakdown ?? EMPTY_BREAKDOWN;
  const shownExtensions = useMemo(() => breakdown.rows.slice(0, PANEL_ROWS), [breakdown]);

  // The colours the map is painted with AND the legend's swatch column --
  // one assignment, built from the breakdown's own order so the biggest
  // types get the most distinct colours. Reading "14.2% .pak" in the list
  // and seeing where the .pak is on the map only works if both sides got
  // their colour from here.
  //
  // The no-extension key is dropped rather than ranked: it is the absence
  // of a type, and giving it a palette slot would put it in competition
  // with the real ones.
  const typeColors = useMemo(
    () => buildTypeColors(breakdown.rows.map((r) => r.extension).filter((e) => e !== NO_EXTENSION)),
    [breakdown]
  );
  const topFiles = aggregates.result?.largestFiles ?? EMPTY_FILES;

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
    if (!el) return;
    // Clamped HERE as well as in the JSX, and this is the one that
    // matters: this handler overwrites the rendered transform on every
    // mousemove, so a clamp applied only at render time would be undone
    // by the first pixel of movement. The element is measured each time
    // because its width follows the path it is showing.
    const box = el.getBoundingClientRect();
    const { left, top } = tooltipPosition({
      x: e.clientX,
      y: e.clientY,
      size: { width: box.width, height: box.height },
      viewport: { width: window.innerWidth, height: window.innerHeight }
    });
    el.style.transform = `translate(${left}px, ${top}px)`;
  }, []);
  const handleLeave = useCallback(() => setHovered(null), []);
  const coverage = scanCoverage(tree);
  const stoppedByUser = Boolean(tree?.stoppedByUser || progressHere?.stoppedByUser);
  // A finished crawl that reported its completion. Absent for any scan that
  // reported none, so a scan without progress events looks as it always did.
  const showCompleteCard = !loading && !error && Boolean(tree) && !fastSubtree && progressHere?.type === 'complete';
  // Right-click target and menu position. One piece of state: the menu is
  // either open on something or closed, and two flags would let those
  // disagree.
  const [menu, setMenu] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const toasts = useToasts();
  const queryClient = useQueryClient();

  const handleContextMenu = useCallback((node, event) => {
    setMenu({ node, x: event.clientX, y: event.clientY });
  }, []);

  /** Removal goes to quarantine and is confirmed first.
   *
   * This is the only removal in the app that acts on whatever was
   * right-clicked rather than on a curated target, so it gets both: a
   * dialog naming the exact path, and a backend guard that refuses
   * Windows, the program folders, a whole profile and a drive root
   * regardless of what the client asks for. The guard is the real
   * protection -- the dialog is only the part the user sees. */
  /* Wrapped in useSingleFlight, because clearing pendingRemoval is not a
   * guard. setPendingRemoval schedules a re-render; it does not change the
   * value THIS closure captured, so two clicks before that re-render both
   * saw the node and both called the backend. The second failed with
   * "that path is no longer there" -- the first had already moved it --
   * and put an error toast on screen straight after a removal that
   * worked. */
  const confirmRemoval = useSingleFlight(useCallback(async () => {
    const node = pendingRemoval;
    setPendingRemoval(null);
    if (!node) return;

    const result = await quarantineDiskPath(node.fullPath, node.size ?? null);

    if (result.ok) {
      toasts.success(t('diskMap.toasts.moved', node.name), {
        detail: t('diskMap.toasts.restoreHint')
      });
      // The picture is now wrong -- that folder is gone. Re-read rather
      // than splicing the cell out: the parent's size changed too.
      queryClient.invalidateQueries({ queryKey: keys.diskScan(currentPath) });
      queryClient.invalidateQueries({ queryKey: keys.quarantine });
      return;
    }

    // A refusal is not a failure. The guard returns a reason and the whole
    // point is to show it -- "that is Windows itself" is information, and
    // a generic error message in its place reads as the app being broken.
    if (result.protected) toasts.warn(result.error, { detail: node.fullPath, ttl: 0 });
    else toasts.error(result.error || t('diskMap.toasts.moveFailed'), { detail: node.fullPath });
  }, [pendingRemoval, toasts, queryClient, currentPath, t]));

  const handleDrillDown = useCallback((fullPath) => {
    setHovered(null);
    setCurrentPath(fullPath);
  }, []);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="display-heading text-[30px] leading-none mb-2">{t('diskMap.title')}</h1>
          {fastStats ? (
            <p className="text-[12px] text-[color:var(--text-secondary)]">
              {t('diskMap.fastIndexSummary', fastStats.recordsRead?.toLocaleString())}
              {' '}{t('diskMap.browsingInstant')}
              {fastStats.mftComplete === false && (
                <span className="text-[color:var(--warning)]">
                  {' '}{t('diskMap.indexIncomplete')}
                </span>
              )}
              {/* The numbers to hold the scan against the drive itself: what
                  was counted, what it occupies on disk, and what the volume
                  says is in use. A mismatch is visible here rather than
                  trusted. */}
              {typeof fastStats.allocatedBytes === 'number' && (
                <span className="block mt-0.5 font-mono text-[11.5px] text-[color:var(--text-muted)]" data-testid="scan-totals">
                  {typeof fastStats.bitmapUsedBytes === 'number'
                    ? t('diskMapV3.totals.line', formatBytes(fastStats.totalBytes), formatBytes(fastStats.allocatedBytes), formatBytes(fastStats.bitmapUsedBytes))
                    : t('diskMapV3.totals.lineNoVolume', formatBytes(fastStats.totalBytes), formatBytes(fastStats.allocatedBytes))}
                  {fastStats.hardLinkedFiles > 0 && <> {t('diskMapV3.totals.hardLinkNote', fastStats.hardLinkedFiles.toLocaleString())}</>}
                </span>
              )}
            </p>
          ) : (
            <p className="text-[12px] text-[color:var(--text-secondary)] max-w-[110ch]">
              {t('diskMap.subtitle')}
            </p>
          )}
        </div>
        {/* Hidden exactly where the panel below is offering the same thing.
            Two "(admin)" buttons on one screen is not two ways to do it,
            it's a question about whether they do the same thing. That is
            true of the drive-root chooser AND of the scanning panel, which
            now carries its own escape hatch. */}
        {!loading && !(!error && !tree && isDriveRoot(currentPath)) && (
          <button
            className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50"
            onClick={handleFastScan}
            disabled={fastScanning}
          >
            {fastScanning ? t('diskMap.scanningDrive') : fastStats ? t('diskMap.rescanButton') : t('diskMap.fastScanButton')}
          </button>
        )}
      </div>

      {fastNote && (
        <FastScanNote note={fastNote} />
      )}

      <DrivePicker
        drives={drives}
        current={currentLetter}
        scanned={scannedLetters}
        onSelect={handleSelectDrive}
      />

      <div className="flex items-center flex-wrap gap-0.5 text-[12.5px] font-mono mb-6">
        {breadcrumbTrail(currentPath).map((seg, i, arr) => (
          <span key={seg.path} className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPath(seg.path)}
              // The last crumb is where you are. 24 px tall with side padding:
              // the crumbs were the text's own height, 15 px.
              aria-current={i === arr.length - 1 ? 'page' : undefined}
              className={`min-h-6 px-1.5 rounded hover:text-[color:var(--accent-primary)] transition-colors ${
                i === arr.length - 1 ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'
              }`}
            >
              {seg.label}
            </button>
            {i < arr.length - 1 && <span className="text-[color:var(--text-muted)]">/</span>}
          </span>
        ))}
      </div>

      {loading && (
        <LoadingState
          path={currentPath}
          onFastScan={handleFastScan}
          fastScanning={fastScanning}
          percent={progressHere?.percent}
          files={progressHere?.files}
          bytes={progressHere?.bytes}
          remainingMs={progressHere?.remainingMs}
          remainingAt={progressHere?.receivedAt}
          // Only once the backend has announced the scan's id; before that
          // there is nothing to stop yet.
          onStop={progressHere?.scanId ? () => { stopDiskScan(progressHere.scanId); } : undefined}
        />
      )}

      {/* The drive root, before a choice has been made. Nothing is scanning
          and nothing is going to until one of these is pressed. */}
      {!loading && !error && !tree && isDriveRoot(currentPath) && !fastScanning && (
        <DriveRootPrompt
          path={currentPath}
          onFastScan={handleFastScan}
          fastScanning={fastScanning}
          onCrawl={() => { rememberMode('crawl'); setCrawlRoots((prev) => new Set(prev).add(currentLetter)); }}
          admin={{ ...admin, onRestart: admin.restart }}
          lastMode={lastMode}
          otherDrives={(drives ?? []).filter((d) => d.letter !== currentLetter && d.ntfs)}
          alsoScan={alsoScan}
          onToggleAlso={handleToggleAlso}
          fastUnavailable={nonNtfsRoot}
        />
      )}

      {/* The fast scan reads the MFT in an elevated process that has no
          progress channel, so this is time only: no percent, no counters. */}
      {!loading && fastScanning && (
        <DiskScanProgress status="scanning" mode="index" path={currentPath} expectedMs={fastExpectedMs} />
      )}

      {!loading && error && (
        <ScanFailure path={currentPath} error={error} onRetry={() => scanQuery.refetch()} />
      )}

      {/* A crawl that has finished, when the backend said so. Absent for
          any scan that reported no completion, so a scan without progress
          events looks exactly as it always did. */}
      {showCompleteCard && (
        <DiskScanProgress
          status="complete"
          totalFiles={progressHere.totalFiles}
          totalBytes={progressHere.totalBytes}
          truncated={Boolean(tree.truncated || progressHere.truncated)}
          stoppedByUser={stoppedByUser}
          coverage={coverage}
          onScanAgain={() => scanQuery.refetch()}
          onFastScan={handleFastScan}
          fastScanning={fastScanning}
        />
      )}

      {/* The same explanation, for a partial tree with no card above it (a
          cached folder reached again later). With the card up, the card says
          it, once. */}
      {!loading && !error && tree?.truncated && !showCompleteCard && (
        <div className="flex items-center gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[color:var(--warning)] shrink-0">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div className="text-[12.5px] text-[color:var(--warning)]">
            {/* The concrete number matters more than the warning does. "Possibly
                incomplete" reads as a rounding caveat; "measured 34.5 GB of 850 GB"
                tells you immediately that the picture is nearly all hole. The two
                measured/used figures lose their bold styling here -- the same
                trade the Dashboard's own drive-health sentence makes -- because
                where they fall in the sentence is not the same in every language. */}
            {coverage
              ? t(stoppedByUser ? 'diskMap.truncated.stoppedWithCoverage' : 'diskMap.truncated.withCoverage', formatBytes(coverage.measured), formatBytes(coverage.used), coverage.percent)
              : t(stoppedByUser ? 'diskMap.truncated.stoppedWithoutCoverage' : 'diskMap.truncated.withoutCoverage')}
            {' '}<button
              className="underline underline-offset-2 hover:text-[color:var(--text-primary)] transition-colors disabled:opacity-50"
              onClick={handleFastScan}
              disabled={fastScanning}
            >
              {fastScanning ? t('diskMap.scanningDrive') : t('diskMap.truncated.rescanLink')}
            </button>
          </div>
        </div>
      )}

      {/* WizTree's own split, and only its own: Tree View and File View.
          The three panels that used to be tabs here -- map, folder table,
          file types -- are three readings of ONE folder, and WizTree shows
          all three at once for a reason. The table says a folder is 105 GB,
          the type list says the drive is 14% .pak, and the map is where you
          see that those are the same fact. Behind tabs, the reader has to
          hold one panel in their head while looking at another, which is
          the work the layout is supposed to be doing for them.

          The flat file list stays a tab, exactly as it is in WizTree: it is
          not a reading of this folder, it is a different question ("which
          single file is biggest") asked of the whole subtree. */}
      {!loading && !error && tree && (
        <div className="flex items-start justify-between flex-wrap gap-x-4 gap-y-2 mb-3">
        <div className="flex items-center gap-1">
          {[['map', t('diskMap.view.tree')], ['files', t('diskMap.view.files')]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                view === key
                  ? 'bg-[color:var(--accent-primary)] text-[color:var(--accent-ink)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
          <SearchBox value={searchText} onChange={setSearchText} invalid={!filter.ok} />
        </div>
      )}

      {!loading && !error && tree && view === 'files' && (
        <LargestFilesView files={topFiles} icons={typeIcons} onContextMenu={handleContextMenu} searchText={filter.active ? searchText : ''} />
      )}

      {!loading && !error && tree && view !== 'files' && (
        <div className="flex flex-col gap-4">
          {/* Folder table and file types side by side, the map full width
              beneath them -- WizTree's proportions, and the right ones: the
              two tables are read row by row and want height, the map is
              read as a picture and wants area. */}
          {/* Beside each other only from 1400 px. The table needs about 700 px
              and the type panel takes 360 more, and from 1100 px the rail is
              200 px wide: at 1280 that leaves about 610 for the table and the
              last column is sliced off, as it was between 1024 and 1207 before
              the rail widened. Below the breakpoint they stack. */}
          <div className="grid gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_360px] items-start">
            <FolderTable folderRows={aggregates.result?.folderRows ?? EMPTY_FOLDER_ROWS} onDrillDown={handleDrillDown} onContextMenu={handleContextMenu} filter={filter} searchText={searchText} />
            <ExtensionPanel breakdown={breakdown} shown={shownExtensions} icons={typeIcons} typeColors={typeColors} />
          </div>

          <div className="glass-panel p-4 treemap-cells" style={{ position: 'relative' }} onMouseMove={handleContainerMouseMove}>
            <ResponsiveContainer width="100%" height={420}>
              <Treemap
                data={markedCells}
                dataKey="size"
                isAnimationActive={false}
                content={<TreemapCell icons={typeIcons} typeColors={typeColors} onHover={handleHover} onLeave={handleLeave} onDrillDown={handleDrillDown} onContextMenu={handleContextMenu} />}
              />
            </ResponsiveContainer>
          </div>
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
            /* Flipped away from whichever edge it would cross, rather
               than sent straight down-right off the screen. Measured from
               the element itself so a long path -- the widest thing it
               ever shows -- is accounted for; before the first measure
               the size reads 0 and it simply lands beside the cursor. */
            transform: (() => {
              const box = tooltipRef.current?.getBoundingClientRect();
              const { left, top } = tooltipPosition({
                x: hovered.clientX,
                y: hovered.clientY,
                size: { width: box?.width ?? 0, height: box?.height ?? 0 },
                viewport: { width: window.innerWidth, height: window.innerHeight }
              });
              return `translate(${left}px, ${top}px)`;
            })(),
            zIndex: 'var(--z-tooltip)',
            pointerEvents: 'none'
          }}
        >
          <div className="text-[13px] font-medium text-[color:var(--text-primary)] mb-1">{hovered.node.name}</div>
          <div className="text-[12px] text-[color:var(--text-secondary)] mb-1">
            {hovered.node.scanned === false ? t('diskMap.tooltip.notMeasured', formatBytes(hovered.node.size)) : formatBytes(hovered.node.size)}
          </div>
          <div className="text-[11px] font-mono text-[color:var(--text-muted)] break-all max-w-[320px]">
            {hovered.node.aggregated
              ? t('diskMap.tooltip.aggregated')
              : hovered.node.scanned === false
                ? t('diskMap.tooltip.unscanned')
                : hovered.node.fullPath}
          </div>
        </div>,
        document.body
      )}

      <ContextMenu
        open={Boolean(menu)}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        onClose={() => setMenu(null)}
        items={menu ? [
          {
            label: t('diskMap.contextMenu.openInExplorer'),
            onSelect: () => revealInExplorer(menu.node.fullPath)
              .catch((err) => toasts.error(err.message, { detail: menu.node.fullPath }))
          },
          {
            label: t('diskMap.contextMenu.copyPath'),
            onSelect: () => navigator.clipboard?.writeText(menu.node.fullPath)
              .then(() => toasts.info(t('diskMap.toasts.pathCopied'), { detail: menu.node.fullPath }))
              .catch(() => toasts.error(t('diskMap.toasts.copyFailed')))
          },
          {
            label: t('diskMap.contextMenu.moveToQuarantineMenu'),
            danger: true,
            // Never removed straight from the menu. A right-click is one
            // gesture and this is the only removal in the app aimed at
            // whatever happened to be under the cursor.
            onSelect: () => setPendingRemoval(menu.node)
          }
        ] : []}
      />

      {pendingRemoval && (
        <ModalOverlay label={t('diskMap.removeModal.label')} onClose={() => setPendingRemoval(null)}>
          <div className="glass-panel w-full max-w-[520px] p-6">
            <h2 className="display-heading text-[20px] mb-2">{t('diskMap.removeModal.heading')}</h2>
            <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-3">
              {t('diskMap.removeModal.note')}
            </p>
            {/* The exact path, in full and wrapped rather than truncated.
                A confirmation for an arbitrary folder is worth nothing if
                it hides which folder. */}
            <p className="font-mono text-[11.5px] text-[color:var(--text-primary)] bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] rounded-lg px-3 py-2 mb-2 break-all">
              {pendingRemoval.fullPath}
            </p>
            <p className="text-[11.5px] text-[color:var(--text-muted)] mb-5">
              {pendingRemoval.type === 'directory' ? t('diskMap.removeModal.folder') : t('diskMap.removeModal.file')}
              {pendingRemoval.size ? ` · ${formatBytes(pendingRemoval.size)}` : ''}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium"
                onClick={() => setPendingRemoval(null)}
              >
                {t('diskMap.removeModal.cancel')}
              </button>
              <button
                className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium"
                onClick={confirmRemoval}
              >
                {t('diskMap.removeModal.label')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/** Memoised because App owns the active-screen state.
 *
 * Screens stay mounted once visited (see Screen.jsx), so every setScreen
 * re-renders App and React then reconciles every screen that has ever
 * been opened -- hidden ones skip layout and paint, not render. Measured
 * before this was added: a hidden Disk Map rendered twice across two tab
 * switches, once per switch, and that cost grows with every tab the user
 * has visited.
 *
 * Safe here specifically because this component takes no props at all, so
 * the comparison is between two empty objects and can never produce a
 * stale screen. A component with unstable props would gain nothing from
 * this and is deliberately left alone. */
export default memo(DiskMap);
