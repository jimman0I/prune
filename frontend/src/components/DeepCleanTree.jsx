import { useState } from 'react';
import { categorySelectionState, nextCategoryChecked } from '../lib/categorySelection.js';
import { tileLetter } from '../lib/iconTileLetter.js';
import { tileColor, TILE_INK } from '../lib/programTileColor.js';

/** The Deep Clean list.
 *
 * Rebuilt against BleachBit's tree, which is denser than what was here and
 * denser in the ways that matter for 74 rules under 29 headings: one
 * scroll region rather than a stack of cards, a single tri-state checkbox
 * per application rather than two text links, and one line per rule.
 * Before this, six rows of a single application filled the panel.
 *
 * What was NOT taken from BleachBit is the row content. BleachBit shows a
 * name and nothing else -- no size until you run Preview, and no
 * explanation ever, so "Cookies" tells a non-expert exactly nothing. This
 * keeps the measured size, the three-way not-installed / needs-admin /
 * real-bytes distinction, and the plain-English description, and pays for
 * them by putting the description on the same line as the name instead of
 * on a second one. Denser than what it replaces AND more informative than
 * the thing it was modelled on.
 */

/** Custom checkbox -- primary-accent fill + DARK check when checked, glass
 * border when not. The check is dark, not white: white on the accent is
 * 2.43:1, which is a tick you cannot see. Not a native
 * <input type="checkbox">, same "build the control ourselves" convention
 * SettingsPage.jsx's own Toggle already establishes for this codebase.
 *
 * `state` is 'none' | 'all' | 'some'. The partial state draws a dash
 * rather than a tick, which is the one shape that cannot be mistaken for
 * either of the other two. */
function Checkbox({ state, onChange, label, size = 16 }) {
  const filled = state === 'all' || state === 'some';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'all'}
      aria-label={label}
      onClick={onChange}
      style={{ width: size, height: size }}
      className={`rounded-[4px] flex items-center justify-center shrink-0 transition-colors border ${
        filled
          ? 'bg-[color:var(--accent-primary)] border-[color:var(--accent-primary)]'
          : 'bg-[color:var(--surface-subtle)] border-[color:var(--border-subtle)] hover:border-[color:var(--border-hover)]'
      }`}
    >
      {state === 'all' && (
        <svg width={size - 6} height={size - 6} viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      )}
      {state === 'some' && (
        <svg width={size - 6} height={size - 6} viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="3.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      )}
    </button>
  );
}

/** Three genuinely different answers that all used to render as "0 B":
 *   - the app isn't installed on this machine at all
 *   - it's installed and there's nothing cached right now
 *   - it exists but Windows won't let us look inside without admin
 * Only the middle one actually means "nothing to clean". Prefetch is the
 * everyday example of the third: it routinely holds hundreds of MB and
 * reads as empty to an unelevated process. */
function SizeLabel({ item }) {
  if (item.sizeBytes === null) {
    return <span className="font-mono text-[11px] shrink-0 text-[color:var(--text-muted)]">—</span>;
  }
  if (item.accessible === false) {
    return <span className="font-mono text-[11px] shrink-0 text-[color:var(--warning)]">needs admin</span>;
  }
  if (item.present === false) {
    return <span className="font-mono text-[11px] shrink-0 text-[color:var(--text-muted)]">not installed</span>;
  }
  return (
    <span className={`font-mono text-[11px] shrink-0 ${item.sizeBytes ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-muted)]'}`}>
      {formatBytes(item.sizeBytes)}
    </span>
  );
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** The application's own icon, falling back to a lettered tile.
 *
 * Same two fallbacks the program and startup lists use, and needed for the
 * same reasons: `src` is absent for a category whose program is not
 * installed (or which is not a program at all -- Windows, DirectX,
 * Developer tools), and onError covers a data URI that arrived but will
 * not decode, which would otherwise draw a broken-image glyph. */
function CategoryIcon({ category, src }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={18}
        height={18}
        className="w-[18px] h-[18px] object-contain shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center text-[9px] font-bold shrink-0"
      style={{ background: tileColor(category), color: TILE_INK }}
    >
      {tileLetter(category)}
    </div>
  );
}

function CategorySection({ category, items, iconSrc, selected, onToggle, onToggleCategory }) {
  const [expanded, setExpanded] = useState(true);
  const state = categorySelectionState(items, selected);

  return (
    <div>
      {/* Opaque, not the translucent tint the rest of the list uses. A
          sticky heading is the one row that has other rows sliding under
          it, and at 2.5% white over glass the row beneath read straight
          through the text. backdrop-blur does not save it either: the
          panel is already a backdrop-filter surface, so the heading was
          blurring a backdrop that had itself been blurred. */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[color:var(--bg-panel)] border-y border-[color:var(--border-subtle)] sticky top-0 z-10">
        {/* Ticking this often lands on 'some' rather than 'all', and that
            is correct rather than a stuck control: onToggleCategory
            deliberately skips the risky rules and the ones for software
            that is not installed, so a category like Brave -- five of
            whose seven rules lose data -- fills to two. The box reports
            what is actually ticked. Every row it left alone is wearing a
            "Loses data" badge saying why, and each still takes a
            deliberate individual click that raises the warning dialog. */}
        <Checkbox
          state={state}
          size={16}
          label={`Select everything under ${category}`}
          onChange={() => onToggleCategory(category, nextCategoryChecked(state))}
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[color:var(--text-muted)] shrink-0"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <CategoryIcon category={category} src={iconSrc} />
          <span className="text-[12.5px] font-medium text-[color:var(--text-primary)] truncate">{category}</span>
          <span className="text-[10.5px] text-[color:var(--text-muted)] font-mono shrink-0">{items.length}</span>
        </button>
      </div>

      {/* Plain conditional, not the 0fr/1fr height transition this used to
          animate. With every category expanded by default and 29 of them
          in one scroll region, animating a collapse moves everything below
          it -- the cost is paid by rows the user was not looking at. The
          chevron still turns, which is the part that reads as a state
          change. */}
      {expanded && (
        <div>
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 pl-[38px] pr-3 py-[3px] hover:bg-[color:var(--surface-subtle)] ${
                item.present === false ? 'opacity-45' : ''
              }`}
            >
              <Checkbox
                state={selected.has(item.id) ? 'all' : 'none'}
                size={14}
                label={item.name}
                onChange={() => onToggle(item.id)}
              />
              <span className="text-[12px] text-[color:var(--text-primary)] shrink-0">{item.name}</span>

              {/* Marked because "recoverable" is not "wanted". Clean moves
                  everything to Quarantine first, so nothing here is
                  unrecoverable -- but being signed out of every site is
                  not a surprise a cleaning tool should spring on anyone.
                  None of these is ticked by default; this says why. */}
              {item.risky && (
                <span className="text-[8.5px] font-mono uppercase tracking-wider px-1 rounded bg-[color:var(--warning-soft)] text-[color:var(--warning)] border border-[color:var(--warning)]/25 shrink-0">
                  Loses data
                </span>
              )}

              {/* On the name's own line rather than under it. This is what
                  buys the density back: BleachBit's rows are one line
                  because they say nothing but the name, and these stay one
                  line while still saying what the rule does. */}
              {item.description && (
                <span className="text-[11px] text-[color:var(--text-muted)] truncate min-w-0 flex-1">
                  {item.description}
                </span>
              )}
              {!item.description && <span className="flex-1" />}

              <SizeLabel item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Controlled, purely presentational -- selection state lives in the
 * parent (DeepClean.jsx). `categories` is the scanned tree from
 * GET /api/deep-clean/scan: [{ category, items: [{id, name, description,
 * sizeBytes, ...}] }]. `icons` is { category: dataUri } from
 * GET /api/deep-clean/category-icons, and is allowed to be empty or to
 * arrive late -- every heading renders either way. */
export default function DeepCleanTree({ categories, selected, onToggle, onToggleCategory, icons = {} }) {
  return (
    <div className="glass-panel rounded-xl overflow-y-auto min-h-0">
      {categories.map((group) => (
        <CategorySection
          key={group.category}
          category={group.category}
          items={group.items}
          iconSrc={icons[group.category]}
          selected={selected}
          onToggle={onToggle}
          onToggleCategory={onToggleCategory}
        />
      ))}
    </div>
  );
}
