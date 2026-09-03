import { useEffect, useMemo, useState } from 'react';
import { fetchPrograms } from '../lib/api.js';
import { sizeBadgeTone } from '../lib/sizeBadgeTone.js';
import { sortPrograms, nextSortState } from '../lib/sortPrograms.js';
import { canBatchUninstall, batchIneligibleReason, batchSummary } from '../lib/batchSelection.js';
import { splitRecentPrograms, RECENT_DAYS } from '../lib/recentPrograms.js';

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
 * without a key (the website, the action) aren't meaningfully sortable. */
const COLUMNS = [
  { key: 'select', label: '', width: '30px' },
  { key: 'name', label: 'Application', sort: 'name', width: 'minmax(200px,1fr)' },
  { key: 'size', label: 'Size', sort: 'sizeBytes', width: '92px', align: 'right' },
  { key: 'version', label: 'Version', sort: 'version', width: '128px' },
  { key: 'architecture', label: 'Type', sort: 'architecture', width: '68px' },
  { key: 'installDate', label: 'Installed', sort: 'installDate', width: '96px' },
  { key: 'publisher', label: 'Company', sort: 'publisher', width: 'minmax(130px,0.7fr)' },
  { key: 'website', label: 'Website', width: 'minmax(120px,0.6fr)' },
  { key: 'action', label: '', width: '104px', align: 'right' }
];

const GRID_TEMPLATE = COLUMNS.map((c) => c.width).join(' ');

/** The program's own icon, falling back to a lettered tile.
 *
 * Two different fallbacks, both needed. `src` is absent for a program
 * whose icon couldn't be extracted at all (28 of 129 here -- mostly MSI
 * redistributables that register no icon). `onError` covers the rarer
 * case of a data URI that arrived but won't decode; without it the row
 * would show a broken-image glyph, which looks worse than the letter it
 * replaced. */
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
      {program.name.charAt(0)}
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
function ProgramRow({ program, iconSrc, checked, onToggle, onUninstall }) {
  return (
    <div
    className="grid gap-3 px-4 py-1.5 items-center group hover:bg-white/[0.04] transition-colors"
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

    <div className="text-[11.5px] text-[color:var(--text-secondary)] truncate">
      {program.publisher}
    </div>

    <div className="text-[11.5px] font-mono text-[color:var(--text-muted)] truncate">
      {program.website ? program.website.replace(/^https?:\/\//, '') : '—'}
    </div>

    <div className="text-right">
      <button
        onClick={() => onUninstall(program)}
        className="btn-danger px-2.5 py-1 rounded-md text-[11px] font-medium opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        {program.health?.orphaned ? 'Force remove' : 'Uninstall'}
      </button>
    </div>
  </div>
  );
}

/** A group heading inside the list.
 *
 * Revo divides its list the same way and puts the count in the heading,
 * which is the useful part: "New Programs: 16" answers a question the rows
 * themselves cannot. Collapsible, because the recent group is the one
 * someone opens this tab for and the rest is a long tail. */
function GroupHeader({ label, count, collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="w-full flex items-center gap-2 px-4 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
    >
      <svg
        width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"
        className={`shrink-0 text-[color:var(--text-muted)] transition-transform ${collapsed ? '-rotate-90' : ''}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
        {label}
      </span>
      <span className="text-[11px] font-mono text-[color:var(--text-muted)]">{count}</span>
    </button>
  );
}

export default function ProgramList({ programs: initialPrograms, icons = {}, onUninstall, onBatchUninstall }) {
  const [programs, setPrograms] = useState(initialPrograms || []);
  const [loading, setLoading] = useState(!initialPrograms);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ column: 'sizeBytes', direction: 'desc' });
  const [selected, setSelected] = useState(new Set());
  const [collapsed, setCollapsed] = useState(() => new Set());

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? programs.filter(p => p.name.toLowerCase().includes(q) || p.publisher.toLowerCase().includes(q))
      : programs;
    if (filter === 'unused') list = list.filter(p => p.unused);
    if (filter === 'broken') list = list.filter(p => p.health?.orphaned);
    return sortPrograms(list, sort.column, sort.direction);
  }, [programs, query, sort, filter]);

  const totalBytes = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.sizeBytes || 0), 0),
    [filtered]
  );

  // Recently installed first, under its own heading, the way Revo splits
  // its list. Only shown when there is something in it -- a heading over an
  // empty group is noise, and on a machine nobody has touched this week
  // both headings would be pure decoration.
  const rows = useMemo(() => {
    const { recent, rest } = splitRecentPrograms(filtered);
    if (recent.length === 0) return filtered.map((program) => ({ type: 'program', program }));

    const out = [];
    for (const [key, label, group] of [
      ['recent', `Installed in the last ${RECENT_DAYS} days`, recent],
      ['rest', 'Everything else', rest]
    ]) {
      if (group.length === 0) continue;
      out.push({ type: 'header', key, label, count: group.length });
      if (!collapsed.has(key)) {
        for (const program of group) out.push({ type: 'program', program });
      }
    }
    return out;
  }, [filtered, collapsed]);

  const toggleGroup = (key) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

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

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading installed programs…</div>;
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
          className="grid gap-3 px-4 py-2 border-b border-[color:var(--border-subtle)] bg-white/[0.02] shrink-0"
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
            <div className="text-center py-16 text-[color:var(--text-muted)] text-[13px]">
              No applications match your filters.
            </div>
          )}
          {rows.map((row) => (
            row.type === 'header' ? (
              <GroupHeader
                key={`group-${row.key}`}
                label={row.label}
                count={row.count}
                collapsed={collapsed.has(row.key)}
                onToggle={() => toggleGroup(row.key)}
              />
            ) : (
            <ProgramRow
              key={row.program.id}
              program={row.program}
              iconSrc={icons[row.program.id]}
              checked={selected.has(row.program.id)}
              onToggle={() => toggleRow(row.program)}
              onUninstall={onUninstall}
            />
            )
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
                : `Showing ${filtered.length} of ${programs.length}`}
            </span>
            <span>{formatBytes(totalBytes)} total</span>
          </div>
        )}
      </div>
    </div>
  );
}
