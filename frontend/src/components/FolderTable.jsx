import { useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { sortFolderRows, nextFolderSort } from '../lib/sortFolderRows.js';
import { RowActionsButton } from './RowActionsButton.jsx';

/** WizTree's Tree View: what is directly inside the folder in view, as a
 * sortable table.
 *
 * The map answers "which of these is big" and nothing else. It cannot say
 * that a 29 GB folder holds 52,780 items, or when it was last touched,
 * and those are what decide whether a folder is worth opening.
 *
 * Size is the length of the data; Allocated is what it occupies on disk
 * (whole clusters, holes of sparse files left out). They differ for exactly
 * the reasons a disk-usage tool exists to explain: a 1 KB file holds a whole
 * cluster, a sparse VM disk is far smaller on disk than it claims. The
 * Allocated column is drawn only for a scan that measured it. Windows file
 * attributes are not on a Node stat and nothing in the scan carries them;
 * an empty column would be worse than no column.
 *
 * Sized to fit beside the file-type panel rather than to a comfortable
 * ideal: that pane is about 680 px wide, and an earlier seven-column
 * layout at 840 px sliced Folders and Modified off the right edge. Every
 * width is measured against the widest real value in its column ("3.6%",
 * "29.4 GB", "59,502", "8/17/2026"), and the table scrolls sideways rather
 * than clipping if a language or a zoom level needs more. */
const FOLDER_COLUMNS = [
  { key: 'name', align: 'left', width: 'minmax(130px,1fr)' },
  { key: 'percentOfParent', align: 'right', width: '46px' },
  { key: 'size', align: 'right', width: '76px' },
  { key: 'allocated', align: 'right', width: '78px', onlyIfMeasured: true },
  { key: 'items', align: 'right', width: '58px' },
  { key: 'files', align: 'right', width: '60px' },
  { key: 'folders', align: 'right', width: '60px' },
  { key: 'modified', align: 'right', width: '78px' },
  // The "..." menu. No header word: it is an action column, not data.
  { key: 'actions', align: 'right', width: '24px' }
];

// percentOfParent is the one column with no word to translate -- "%" is
// the same symbol in every language this app ships.
const FOLDER_COLUMN_KEYS = {
  name: 'diskMap.folderTable.columns.folder',
  size: 'diskMap.folderTable.columns.size',
  allocated: 'diskMapV3.columns.allocated',
  items: 'diskMap.folderTable.columns.items',
  files: 'diskMap.folderTable.columns.files',
  folders: 'diskMap.folderTable.columns.folders',
  modified: 'diskMap.folderTable.columns.modified'
};

/** A count that was never taken reads as a dash, never as zero. */
function Count({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-[color:var(--text-muted)]">—</span>;
  }
  return <>{value.toLocaleString()}</>;
}

export function FolderTable({ folderRows, onDrillDown, onContextMenu }) {
  const { t } = useLanguage();
  const [sort, setSort] = useState({ column: 'size', direction: 'desc' });
  // The counts themselves are computed off the main thread (see
  // useDiskMapAggregates.js) since a folder like a drive root's own
  // countSubtree walk covers every node in the tree; only the SORT of the
  // already-computed rows happens here, which is cheap regardless of how
  // large the tree behind them was.
  const rows = useMemo(
    () => sortFolderRows(folderRows, sort.column, sort.direction),
    [folderRows, sort]
  );

  const measured = useMemo(() => folderRows.some((r) => typeof r.allocated === 'number'), [folderRows]);
  const columns = useMemo(
    () => FOLDER_COLUMNS.filter((c) => !c.onlyIfMeasured || measured),
    [measured]
  );
  const grid = columns.map((c) => c.width).join(' ');

  if (rows.length === 0) {
    return (
      <div className="glass-panel p-6 text-[13px] text-[color:var(--text-muted)]">
        {t('diskMap.folderTable.empty')}
      </div>
    );
  }

  return (
    // A real table to assistive tech: the rows are divs in a grid (a native
    // <table> cannot give a truncating flexible first column), so the
    // semantics are stated instead of assumed.
    <div className="glass-panel overflow-x-auto min-w-0" role="table" aria-label={t('diskMap.folderTable.columns.folder')}>
      <div
        role="row"
        className="grid gap-2 px-4 py-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)]"
        style={{ gridTemplateColumns: grid }}
      >
        {columns.map((col) => {
          if (col.key === 'actions') return <span key={col.key} role="presentation" />;
          const sorted = sort.column === col.key;
          return (
            <div
              key={col.key}
              role="columnheader"
              aria-sort={sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              className={col.align === 'right' ? 'flex justify-end' : 'flex'}
            >
              <button
                onClick={() => setSort((s) => nextFolderSort(s, col.key))}
                // 32 px tall: a sortable header is a control, not a label.
                className={`flex items-center gap-1 min-h-8 text-[11px] font-mono uppercase tracking-[0.12em] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors ${
                  col.align === 'right' ? 'justify-end' : ''
                }`}
              >
                {col.key === 'percentOfParent' ? '%' : t(FOLDER_COLUMN_KEYS[col.key])}
                {sorted && (
                  <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" className="shrink-0">
                    {sort.direction === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div role="rowgroup" className="max-h-[520px] overflow-y-auto divide-y divide-[color:var(--border-subtle)]">
        {rows.map((row) => {
          // Only a folder the scan actually opened is worth drilling into --
          // clicking an unscanned block would scan a path we have no
          // evidence even exists.
          const drillable = row.scanned && row.type === 'directory' && Boolean(row.fullPath);
          // The same test as the map's menu: a real, measured place.
          const actionable = row.scanned && Boolean(row.fullPath);
          const node = { name: row.name, size: row.size, fullPath: row.fullPath, type: row.type };
          return (
            <div
              role="row"
              key={row.fullPath || row.name}
              className={`grid gap-2 px-4 py-[7px] items-center ${
                drillable ? 'cursor-pointer hover:bg-[color:var(--surface-hover)] transition-colors' : ''
              }`}
              style={{ gridTemplateColumns: grid }}
              onClick={() => { if (drillable) onDrillDown(row.fullPath); }}
              onContextMenu={(e) => {
                if (!actionable || !onContextMenu) return;
                e.preventDefault();
                onContextMenu(node, e);
              }}
            >
              <div role="cell" className="text-[12.5px] text-[color:var(--text-primary)] truncate min-w-0">
                {drillable ? (
                  // The row's keyboard door. A mouse click anywhere on the row
                  // drills (the row's own handler); this is the same action for
                  // Tab, Enter and Space, named with what it opens and how big
                  // it is. Its click bubbles to the row, so there is one path.
                  <button
                    type="button"
                    aria-label={t('diskMap.folderTable.rowLabel', row.name, formatBytes(row.size))}
                    className="max-w-full truncate text-left"
                  >
                    {row.name}
                  </button>
                ) : (
                  row.name
                )}
                {!row.scanned && (
                  <span className="ml-2 text-[11px] font-mono uppercase tracking-wider text-[color:var(--text-muted)]">
                    {t('diskMap.folderTable.notScanned')}
                  </span>
                )}
              </div>
              <div role="cell" className="text-[11.5px] font-mono text-right text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {row.scanned ? `${row.percentOfParent.toFixed(1)}%` : '—'}
              </div>
              {/* Text colour, not the cyan that also marks buttons and ticks. */}
              <div role="cell" className="text-[12px] font-mono text-right text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {row.scanned ? formatBytes(row.size) : '—'}
              </div>
              {measured && (
                <div role="cell" className="text-[12px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {row.scanned ? formatBytes(row.allocated) : '—'}
                </div>
              )}
              <div role="cell" className="text-[11.5px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Count value={row.items} />
              </div>
              <div role="cell" className="text-[11.5px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Count value={row.files} />
              </div>
              <div role="cell" className="text-[11.5px] font-mono text-right text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Count value={row.folders} />
              </div>
              <div role="cell" className="text-[11.5px] font-mono text-right text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {row.modified ? new Date(row.modified).toLocaleDateString() : '—'}
              </div>
              <div role="cell" className="flex justify-end">
                {actionable && onContextMenu && (
                  <RowActionsButton name={row.name} onOpen={(pos) => onContextMenu(node, pos)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
