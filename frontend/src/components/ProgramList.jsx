import { useEffect, useMemo, useState } from 'react';
import { fetchPrograms, revealInExplorer, openInstalledAppsSettings } from '../lib/api.js';
import { sizeBadgeTone } from '../lib/sizeBadgeTone.js';
import { sortPrograms, nextSortState } from '../lib/sortPrograms.js';
import { canBatchUninstall, batchIneligibleReason, batchSummary } from '../lib/batchSelection.js';
import { isRecentlyInstalled, RECENT_DAYS } from '../lib/recentPrograms.js';
import TableSkeleton from './TableSkeleton.jsx';
import { tileLetter } from '../lib/iconTileLetter.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const SIZE_TONE_TEXT = {
  cyan: 'text-[color:var(--accent-cyan)]',
  blue: 'text-[color:var(--accent-blue)]',
  amber: 'text-[color:var(--warning)]',
  coral: 'text-[color:var(--accent-coral)]'
};

/** The grid, defined once so the header and every row cannot drift apart.
 * A column's `sort` key is what makes its header clickable; the ones
 * without a key (the website, the action) aren't meaningfully sortable.
 *
 * Every width here is measured against what the column actually holds on
 * this machine, not estimated. Several were roughly a third wider than
 * their widest value -- Size reserved 92px to render 58px of text -- and
 * the table paid for that with a horizontal scrollbar under the rows at
 * the default window size, before the New column made it worse. The
 * fixed columns now sit just above their real content, and the three
 * flexible ones keep the slack. */
const COLUMNS = [
  { key: 'select', label: '', width: '30px' },
  { key: 'name', label: 'Application', sort: 'name', width: 'minmax(190px,1fr)' },
  { key: 'size', label: 'Size', sort: 'sizeBytes', width: '72px', align: 'right' },
  // Kept wide: "2026.08.19.11.06" is 138px and still truncates here. A
  // version is read left-to-right, so losing the tail costs least.
  { key: 'version', label: 'Version', sort: 'version', width: '128px' },
  { key: 'architecture', label: 'Type', sort: 'architecture', width: '52px' },
  { key: 'installDate', label: 'Installed', sort: 'installDate', width: '74px' },
  // Recency used to be a grouping: recent installs sat under their own
  // collapsible heading above everything else. It is a column now because
  // a grouping owns the order of the whole table -- sort by size and the
  // heading is still there, splitting the answer in two -- while a column
  // sits beside the date it comes from and brings the same rows to the top
  // only when you click it. Sorted by it, this is Revo's New Programs list.
  // 46px is the header, not the badge: NEW plus its sort arrow is wider
  // than the badge it sits over.
  { key: 'recent', label: 'New', sort: 'recent', width: '46px' },
  { key: 'publisher', label: 'Company', sort: 'publisher', width: 'minmax(112px,0.7fr)' },
  { key: 'website', label: 'Website', width: 'minmax(92px,0.6fr)' },
  { key: 'action', label: '', width: '164px', align: 'right' }
];

const GRID_TEMPLATE = COLUMNS.map((c) => c.width).join(' ');

/** The program's own icon, falling back to a lettered tile.
 *
 * Two different fallbacks, both needed. `src` is absent for a program
 * whose icon couldn't be extracted at all (mostly MSI redistributables
 * that register no icon anywhere, plus the ones whose only registered
 * icon turned out to be an installer's generic glyph). `onError` covers
 * the rarer case of a data URI that arrived but won't decode; without it
 * the row would show a broken-image glyph, which looks worse than the
 * letter it replaced.
 *
 * The letter skips a leading vendor word -- see iconTileLetter.js. It
 * matters more than one character usually would: the programs that reach
 * this tile are almost all system components named after their vendor,
 * and twenty-six of the forty-six tiles here were the same "M". */
function ProgramIcon({ program, src }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        className="w-5 h-5 object-contain shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-5 h-5 rounded-[4px] flex items-center justify-center text-[9px] font-bold shrink-0"
      style={{
        background: `linear-gradient(135deg, ${program.color || '#f98074'}dd, ${program.color || '#f98074'}88)`,
        color: '#fff'
      }}
    >
      {tileLetter(program.name, program.publisher)}
    </div>
  );
}

/** Row checkbox. Not a native input, matching DeepCleanTree's own bespoke
 * control -- and it needs a disabled state a native one styles badly.
 *
 * A disabled box carries the reason as its accessible label rather than a
 * tooltip: a control that refuses to tick and says nothing is a dead end,
 * and this codebase doesn't use native hover text. */
function RowCheckbox({ checked, disabled, label, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`w-[15px] h-[15px] rounded-[4px] flex items-center justify-center shrink-0 border transition-colors ${
        disabled
          ? 'border-[color:var(--border-subtle)] opacity-30 cursor-not-allowed'
          : checked
            ? 'bg-[color:var(--accent-coral)] border-[color:var(--accent-coral)]'
            : 'bg-white/[0.03] border-[color:var(--border-subtle)] hover:border-white/25'
      }`}
    >
      {checked && !disabled && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
    </button>
  );
}

function SortArrow({ active, direction }) {
  if (!active) return null;
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" className="shrink-0">
      {direction === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}

/** One program's row. Extracted when the list gained group headings: the
 * body renders from a `row` union now, and a component keeps the row's own
 * markup readable instead of reaching through it. */
/** Opens the program's folder in Explorer.
 *
 * Revo keeps this behind More Commands and it is the most-used thing
 * there: the row says a program is 55 GB and the next question is always
 * where. Shown only when there is a folder to open -- most Store apps and
 * every extension have one, but plenty of registry entries record none,
 * and a button that cannot work is worse than no button. */
function RevealButton({ program }) {
  const [failed, setFailed] = useState(null);
  const target = program.installLocation;
  if (!target) return null;

  return (
    <button
      onClick={async () => {
        setFailed(null);
        try {
          await revealInExplorer(target);
        } catch (error) {
          // The usual cause is a folder that is gone, which is worth
          // saying: it means the entry is stale.
          setFailed(error.message);
        }
      }}
      aria-label={`Open the folder for ${program.name}`}
      className="btn-ghost px-2 py-1 rounded-md text-[11px] font-medium opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
    >
      {failed ? 'Not found' : 'Folder'}
    </button>
  );
}

function ProgramRow({ program, iconSrc, checked, running, isNew, onToggle, onUninstall }) {
  return (
    <div
    className="grid gap-2.5 px-4 py-1.5 items-center group hover:bg-white/[0.04] transition-colors"
    style={{ gridTemplateColumns: GRID_TEMPLATE }}
  >
    <RowCheckbox
      checked={checked}
      disabled={!canBatchUninstall(program)}
      label={batchIneligibleReason(program) || `Select ${program.name}`}
      onChange={onToggle}
    />

    <div className="flex items-center gap-2.5 min-w-0">
      <ProgramIcon program={program} src={iconSrc} />
      <span className="text-[12.5px] truncate">{program.name}</span>
      {program.health?.orphaned && (
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--danger-soft)] text-[color:var(--danger)] border border-[color:var(--danger)]/25 shrink-0">
          Broken
        </span>
      )}
      {/* Revo warns before uninstalling something that is open, and the
          warning earns its place: an uninstaller for a running program
          either fails, or half-succeeds and leaves files behind that the
          next launch recreates. */}
      {running && (
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--accent-cyan)]/15 text-[color:var(--accent-cyan)] border border-[color:var(--accent-cyan)]/25 shrink-0">
          Running
        </span>
      )}
      {/* Marked, because how you remove one is genuinely different --
          a Store app has no uninstaller to run. */}
      {program.source === 'store' && (
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--accent-blue)]/15 text-[color:var(--accent-blue)] border border-[color:var(--accent-blue)]/25 shrink-0">
          Store
        </span>
      )}
      {/* Which browser it belongs to is the identifying fact here -- the
          same extension is often installed in two of them. */}
      {program.source === 'extension' && (
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--accent-cyan)]/15 text-[color:var(--accent-cyan)] border border-[color:var(--accent-cyan)]/25 shrink-0">
          {program.browser}
        </span>
      )}
      {/* Only shown when the reader actually knows. Gecko records an
          add-on's enabled state in the same index it lists them from;
          Chromium keeps it somewhere this reader does not look, so those
          rows say nothing rather than guessing "enabled". A disabled
          add-on still occupies disk, which is what this list is about. */}
      {program.source === 'extension' && program.enabled === false && (
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-white/[0.06] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] shrink-0">
          Disabled
        </span>
      )}
      {program.unused && !program.health?.orphaned && (
        <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--warning-soft)] text-[color:var(--warning)] border border-[color:var(--warning)]/25 shrink-0">
          Unused
        </span>
      )}
    </div>

    <div
      className={`text-[12px] font-mono text-right ${SIZE_TONE_TEXT[sizeBadgeTone(program.sizeBytes)]}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatBytes(program.sizeBytes)}
    </div>

    <div className="text-[11.5px] font-mono text-[color:var(--text-secondary)] truncate">
      {program.version || '—'}
    </div>

    {/* Blank rather than a guess: a per-user registry entry
        carries no architecture, and a wrong "64-bit" is a fact
        stated confidently and incorrectly. */}
    <div className="text-[11.5px] font-mono text-[color:var(--text-muted)]">
      {program.architecture || '—'}
    </div>

    {/* An inferred date is shown muted. Two thirds of these come
        from the uninstall key's write time rather than from
        anything the installer declared, and that is a weaker
        claim -- an update rewrites the key too. Revo shows both
        identically; saying which is which costs nothing. */}
    <div
      className={`text-[11.5px] font-mono ${
        program.installDateApproximate
          ? 'text-[color:var(--text-muted)]'
          : 'text-[color:var(--text-secondary)]'
      }`}
    >
      {program.installDate ? new Date(program.installDate).toLocaleDateString() : '—'}
    </div>

    {/* Blank, not a dash, for everything else. A dash means "we have no
        value here"; almost nothing is new, and 120 dashes down a column
        would read as 120 unknowns. */}
    <div className="flex items-center">
      {isNew && (
        <span
          className="text-[9px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--accent-coral)]/15 text-[color:var(--accent-coral)] border border-[color:var(--accent-coral)]/25"
        >
          New
        </span>
      )}
    </div>

    <div className="text-[11.5px] text-[color:var(--text-secondary)] truncate">
      {program.publisher}
    </div>

    <div className="text-[11.5px] font-mono text-[color:var(--text-muted)] truncate">
      {program.website ? program.website.replace(/^https?:\/\//, '') : '—'}
    </div>

    <div className="text-right flex items-center justify-end gap-1.5">
      <RevealButton program={program} />
      {program.source === 'extension' ? (
        // Removing one is a browser operation, not an uninstaller.
        <span className="text-[11px] font-mono text-[color:var(--text-muted)]">via browser</span>
      ) : program.source === 'store' ? (
        // Not a dead Uninstall button, and not a bare label either.
        // Removing a Store app is Remove-AppxPackage, which Prune does not
        // do -- but saying "via Windows" and leaving someone to find the
        // page is half an answer, so this opens it.
        <button
          onClick={() => { openInstalledAppsSettings().catch(() => {}); }}
          aria-label={`Open Windows settings to remove ${program.name}`}
          className="btn-ghost px-2 py-1 rounded-md text-[11px] font-medium opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          In Windows
        </button>
      ) : (
        <button
          onClick={() => onUninstall(program)}
          className="btn-danger px-2.5 py-1 rounded-md text-[11px] font-medium opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          {program.health?.orphaned ? 'Force remove' : 'Uninstall'}
        </button>
      )}
    </div>
  </div>
  );
}

export default function ProgramList({ programs: initialPrograms, extensions = [], icons = {}, running = {}, onUninstall, onBatchUninstall }) {
  const [programs, setPrograms] = useState(initialPrograms || []);
  const [loading, setLoading] = useState(!initialPrograms);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ column: 'sizeBytes', direction: 'desc' });
  const [selected, setSelected] = useState(new Set());

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

  const brokenCount = useMemo(() => programs.filter(p => p.health?.orphaned).length, [programs]);
  const storeCount = useMemo(() => programs.filter(p => p.source === 'store').length, [programs]);

  const filtered = useMemo(() => {
    // Extensions are their own list, not part of the program list. Revo
    // gives them their own module for the same reason: an extension is
    // not an installed program, and mixing 24 of them in would dilute
    // both the count and the total.
    const source = filter === 'extensions' ? extensions : programs;
    const q = query.trim().toLowerCase();
    let list = q
      ? source.filter(p => p.name.toLowerCase().includes(q) || (p.publisher || '').toLowerCase().includes(q))
      : source;
    if (filter === 'unused') list = list.filter(p => p.unused);
    if (filter === 'broken') list = list.filter(p => p.health?.orphaned);
    if (filter === 'store') list = list.filter(p => p.source === 'store');
    return sortPrograms(list, sort.column, sort.direction);
  }, [programs, extensions, query, sort, filter]);

  const totalBytes = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.sizeBytes || 0), 0),
    [filtered]
  );

  // Which rows carry the New badge, decided once per render rather than
  // per row: every one of them would otherwise build its own Date to ask
  // the same question about the same clock.
  const newIds = useMemo(() => {
    const ids = new Set();
    for (const program of filtered) if (isRecentlyInstalled(program)) ids.add(program.id);
    return ids;
  }, [filtered]);

  // Only what's both selected AND still on screen. Selecting rows, then
  // filtering them away, then hitting Uninstall should not remove things
  // the user can no longer see.
  const selectedPrograms = useMemo(
    () => filtered.filter((p) => selected.has(p.id)),
    [filtered, selected]
  );
  const selectable = useMemo(() => filtered.filter(canBatchUninstall), [filtered]);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  const toggleRow = (program) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(program.id)) next.delete(program.id); else next.add(program.id);
    return next;
  });

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    // Acts on the filtered view only, which is the set the header sits
    // above -- "select all" over rows you can't see would be a surprise.
    if (allSelected) for (const p of selectable) next.delete(p.id);
    else for (const p of selectable) next.add(p.id);
    return next;
  });

  const summary = batchSummary(selectedPrograms);

  // The shape of the table that is coming, not a line of text where it
  // will be. The list takes about a second to arrive and the header,
  // filters and column set are all known before it does -- showing them
  // immediately means nothing moves when the rows land.
  if (loading) {
    return (
      <div className="flex flex-col min-h-0">
        <TableSkeleton columns={COLUMNS.filter((c) => c.label)} rows={10} label="Reading installed programs…" />
      </div>
    );
  }
  if (error) return <div style={{ color: 'var(--danger)' }}>Couldn't load programs: {error}</div>;

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="flex-1 max-w-md relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applications…"
            className="w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl pl-10 pr-4 py-2 text-[13px] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-coral)] focus:ring-4 focus:ring-[color:var(--accent-coral)]/10 transition"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl">
          {[
            { id: 'all', label: 'All' },
            { id: 'unused', label: 'Unused' },
            // Only offered when there's something to see. On a healthy
            // machine this filter would return an empty list every time,
            // and a permanently-empty view teaches people to ignore it --
            // when it does appear, it means something.
            ...(storeCount > 0 ? [{ id: 'store', label: `Store (${storeCount})` }] : []),
            ...(extensions.length > 0 ? [{ id: 'extensions', label: `Extensions (${extensions.length})` }] : []),
            ...(brokenCount > 0 ? [{ id: 'broken', label: `Broken (${brokenCount})` }] : [])
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition ${filter === f.id ? 'bg-white/[0.06] text-white' : 'text-[color:var(--text-muted)] hover:text-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden flex flex-col min-h-0">
        {/* Sticky header. Sorting lives here rather than in a separate
            control: with eight columns on screen, the thing you want to
            sort by is already in front of you. */}
        <div
          className="grid gap-2.5 px-4 py-2 border-b border-[color:var(--border-subtle)] bg-white/[0.02] shrink-0"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          {COLUMNS.map((col) => {
            if (col.key === 'select') {
              return (
                <RowCheckbox
                  key={col.key}
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  label={allSelected ? 'Clear selection' : 'Select all shown'}
                  onChange={toggleAll}
                />
              );
            }
            const active = sort.column === col.sort;
            const content = (
              <>
                {col.label}
                <SortArrow active={active} direction={sort.direction} />
              </>
            );
            const classes = `flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.13em] ${
              active ? 'text-[color:var(--accent-coral)]' : 'text-[color:var(--text-muted)]'
            } ${col.align === 'right' ? 'justify-end' : ''}`;

            return col.sort ? (
              <button
                key={col.key}
                onClick={() => setSort((s) => nextSortState(s, col.sort))}
                className={`${classes} hover:text-[color:var(--text-primary)] transition-colors`}
              >
                {content}
              </button>
            ) : (
              <span key={col.key} className={classes}>{content}</span>
            );
          })}
        </div>

        <div className="overflow-y-auto min-h-0 divide-y divide-[color:var(--border-subtle)]">
          {filtered.length === 0 && (
            // An empty result on this screen is almost always a filter the
            // user forgot, not an empty machine -- there are 210 programs
            // behind it. So it says which filter is responsible and offers
            // to undo it, rather than reporting the absence and stopping.
            <div className="text-center py-16 px-6">
              <p className="text-[13px] text-[color:var(--text-secondary)]">
                Nothing matches
                {query.trim() && <> “<span className="text-[color:var(--text-primary)]">{query.trim()}</span>”</>}
                {query.trim() && filter !== 'all' && ' in '}
                {filter !== 'all' && <span className="text-[color:var(--text-primary)]">{filter}</span>}
                .
              </p>
              <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">
                {(filter === 'extensions' ? extensions : programs).length} entries are hidden by the
                current filter.
              </p>
              <button
                className="btn-ghost mt-4 px-3.5 py-2 rounded-lg text-[12.5px] font-medium"
                onClick={() => { setQuery(''); setFilter('all'); }}
              >
                Clear search and filters
              </button>
            </div>
          )}
          {filtered.map((program) => (
            <ProgramRow
              key={program.id}
              program={program}
              iconSrc={icons[program.id]}
              checked={selected.has(program.id)}
              running={Boolean(running[program.id])}
              isNew={newIds.has(program.id)}
              onToggle={() => toggleRow(program)}
              onUninstall={onUninstall}
            />
          ))}
        </div>

        {/* Revo puts the installation count at the bottom of the window,
            and it earns the space: it's the one number that changes as
            you filter. */}
        {summary.count > 0 ? (
          // The footer becomes the batch bar once anything is ticked,
          // rather than a separate strip appearing and pushing the table:
          // it's the same row of information, about a smaller set.
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-[color:var(--accent-coral)]/25 bg-[color:var(--accent-coral)]/[0.07] shrink-0">
            <span className="text-[12px] text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-primary)] font-medium">{summary.count}</span> selected ·{' '}
              <span className="font-mono">{formatBytes(summary.totalBytes)}</span>
              {summary.unknownSizes > 0 && (
                <span className="text-[color:var(--text-muted)]"> + {summary.unknownSizes} of unknown size</span>
              )}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                className="text-[11.5px] text-[color:var(--text-secondary)] hover:text-[color:var(--accent-coral)] transition-colors"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
              <button
                className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium"
                onClick={() => onBatchUninstall?.(selectedPrograms)}
              >
                Uninstall {summary.count} program{summary.count === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-[color:var(--border-subtle)] bg-white/[0.02] shrink-0 text-[11.5px] font-mono text-[color:var(--text-muted)]">
            <span>
              {filtered.length === programs.length
                ? `Installations: ${programs.length}`
                // Against the list actually being filtered. Extensions are
                // their own list, so "24 of 210" would be comparing them
                // against a total they are not part of.
                : `Showing ${filtered.length} of ${(filter === 'extensions' ? extensions : programs).length}`}
              {/* The count the old New Programs heading used to carry, and
                  the only place the column's window is spelled out. A
                  badge saying New is not self-explanatory about how new. */}
              {newIds.size > 0 && (
                <span className="text-[color:var(--accent-coral)]">
                  {' · '}{newIds.size} new in {RECENT_DAYS} days
                </span>
              )}
            </span>
            <span>{formatBytes(totalBytes)} total</span>
          </div>
        )}
      </div>
    </div>
  );
}
