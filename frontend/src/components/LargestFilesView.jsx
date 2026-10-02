import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { sortFiles } from '../lib/sortFiles.js';
import { extensionOf, GENERIC_FILE_KEY } from '../lib/fileTypeIcon.js';
import { RowActionsButton } from './RowActionsButton.jsx';

/** The biggest individual files, WizTree's second tab.
 *
 * A treemap is good at showing that a folder is enormous and bad at
 * showing that one file inside it is the reason. Satisfactory's 8.4 GB
 * .ucas is a quarter of everything scanned here and the map draws it as
 * an indistinguishable slab inside Games.
 *
 * Paths are shown in full and are the point of the view: this is the list
 * you act on, and "FactoryGame-Windows.ucas" without its folder is not
 * something anyone can find again.
 *
 * The list is the biggest files, re-orderable: by size (the default), by when
 * each was last written, or by name. Sorting reorders THESE files; it does
 * not search the whole drive for the newest ones. */
const SORT_COLUMNS = [
  ['size', 'diskMap.folderTable.columns.size'],
  ['modified', 'diskMap.folderTable.columns.modified'],
  ['name', 'diskMapV3.columns.name']
];

export function LargestFilesView({ files, icons, onContextMenu, onVisibleRows, searchText = '' }) {
  const { t } = useLanguage();
  const [sort, setSort] = useState({ column: 'size', direction: 'desc' });
  const rows = useMemo(() => sortFiles(files, sort.column, sort.direction), [files, sort]);
  // What is on screen, in the order it is on screen, for the CSV export.
  useEffect(() => { onVisibleRows?.(rows); }, [rows, onVisibleRows]);

  if (files.length === 0) {
    return (
      <div className="glass-panel p-6 text-[13px] text-[color:var(--text-muted)]">
        {searchText.trim() ? t('diskMapV3.search.noMatches', searchText.trim()) : t('diskMap.largestFiles.empty')}
      </div>
    );
  }

  const choose = (column) => setSort((s) => (
    s.column === column
      ? { column, direction: s.direction === 'asc' ? 'desc' : 'asc' }
      : { column, direction: column === 'name' ? 'asc' : 'desc' }
  ));

  return (
    <div className="glass-panel p-4 min-w-0">
      <div role="group" aria-label={t('diskMapV3.filesView.sortBy')} className="flex items-center gap-1 mb-2 pb-2 border-b border-[color:var(--border-subtle)]">
        <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[color:var(--text-muted)] mr-1.5">
          {t('diskMapV3.filesView.sortBy')}
        </span>
        {SORT_COLUMNS.map(([column, key]) => {
          const active = sort.column === column;
          return (
            <button
              key={column}
              type="button"
              aria-pressed={active}
              onClick={() => choose(column)}
              className={`min-h-7 px-2.5 rounded-lg text-[12px] font-medium transition-colors flex items-center gap-1 ${
                active
                  ? 'bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
              }`}
            >
              {t(key)}
              {active && (
                <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" className="shrink-0">
                  {sort.direction === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col">
        {rows.map((file) => {
          const node = { name: file.name, size: file.size, allocated: file.allocated, modified: file.modified, fullPath: file.fullPath, type: 'file' };
          return (
            <div
              key={file.fullPath || file.name}
              className="flex items-center gap-2.5 py-[5px] border-b border-[color:var(--border-subtle)] last:border-b-0"
              onContextMenu={(e) => {
                if (!onContextMenu || !file.fullPath) return;
                e.preventDefault();
                onContextMenu(node, e);
              }}
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
                className="font-mono text-[12px] text-[color:var(--text-primary)] w-[86px] text-right shrink-0"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatBytes(file.size)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-[color:var(--text-primary)] truncate">{file.name}</div>
                {file.fullPath && (
                  <div className="text-[11px] font-mono text-[color:var(--text-muted)] truncate select-text">{file.fullPath}</div>
                )}
              </div>
              <div
                className="font-mono text-[11.5px] text-[color:var(--text-muted)] w-[84px] text-right shrink-0"
                style={{ fontVariantNumeric: 'tabular-nums' }}
                data-testid="file-modified"
              >
                {file.modified ? new Date(file.modified).toLocaleDateString() : '—'}
              </div>
              {onContextMenu && file.fullPath && (
                <RowActionsButton name={file.name} onOpen={(pos) => onContextMenu(node, pos)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
