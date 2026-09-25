import { useState } from 'react';
import { categorySelectionState, nextCategoryChecked } from '../lib/categorySelection.js';
import { selectionTotal } from '../lib/selectionTotal.js';
import { readCollapsedCategories, writeCollapsedCategories } from '../lib/deepCleanExpansion.js';
import { tileLetter } from '../lib/iconTileLetter.js';
import { tileColor, TILE_INK } from '../lib/programTileColor.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The Deep Clean list.
 *
 * Rebuilt against BleachBit's tree, which is denser than what was here and
 * denser in the ways that matter for 74 rules under 29 headings: one
 * scroll region rather than a stack of cards, a single tri-state checkbox
 * per application rather than two text links, and one line per rule.
 * Before this, six rows of a single application filled the panel.
 *
 * The row content deliberately does not stay as bare as BleachBit's own,
 * though. BleachBit shows a name and nothing else, ever -- no size, and no
 * explanation, so "Cookies" tells a non-expert exactly nothing. This keeps
 * the measured size, the three-way not-installed / needs-admin /
 * real-bytes distinction, and the plain-English description, on the same
 * line as the name rather than a second one -- denser than what it
 * replaced AND more informative than the thing it was modelled on. What IS
 * matched now is the timing: before a rule is measured the row is as bare
 * as BleachBit's own (name and a checkbox), and the description -- along
 * with the size -- reveals itself the moment that specific rule's real
 * result streams in, rather than a wall of explanatory text appearing for
 * 74 rules before anything is known about the machine. See `measured` in
 * CategorySection below.
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
function Checkbox({ state, onChange, label, size = 16, hit = size, className = '', disabled = false }) {
  const filled = state === 'all' || state === 'some';

  return (
    // `hit` is the button (what a pointer can land on), `size` is the box
    // that is drawn inside it. Equal for a rule's own box, which sits in a
    // row that is itself the click target; the category heading's is 28
    // around 16, so the 16 px box is no longer the whole target.
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'all'}
      aria-label={label}
      disabled={disabled}
      // The row a rule's box lives in is clickable too, so this must not
      // bubble or one click would toggle twice and land where it began.
      onClick={(event) => { event.stopPropagation(); onChange(); }}
      style={{ width: hit, height: hit }}
      className={`group flex items-center justify-center shrink-0 ${className}`}
    >
      <span
        data-checkbox-visual
        style={{ width: size, height: size }}
        className={`rounded-[4px] flex items-center justify-center transition-colors border ${
          filled
            ? 'bg-[color:var(--accent-primary)] border-[color:var(--accent-primary)]'
            : 'bg-[color:var(--surface-subtle)] border-[color:var(--control-border)] group-hover:border-[color:var(--control-border-hover)]'
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
      </span>
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
/* The three answer branches below carry `log-line-in` -- the same fade
 * this file's scan log already uses for an arriving line -- so the
 * moment THIS row's real result streams in reads as an arrival, not a
 * silent swap. Paired with the `key` at the call site (item.sizeBytes ===
 * null vs not), which remounts this span exactly once, when the answer
 * first lands, and never again while the value it already has just sits
 * there. The bare dash gets no animation: nothing has arrived yet. */
function SizeLabel({ item }) {
  const { t } = useLanguage();
  if (item.sizeBytes === null) {
    return <span className="font-mono text-[11px] shrink-0 text-[color:var(--text-muted)]">—</span>;
  }
  if (item.accessible === false) {
    // Secondary text and a lock, not the amber that means "loses data" on
    // the badge beside the name: two different meanings do not get one colour.
    return (
      <span className="log-line-in inline-flex items-center gap-1 font-mono text-[11px] shrink-0 text-[color:var(--text-secondary)]">
        <svg data-lock aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {t('deepClean.tree.needsAdmin')}
      </span>
    );
  }
  if (item.present === false) {
    return <span className="log-line-in font-mono text-[11px] shrink-0 text-[color:var(--text-muted)]">{t('deepClean.tree.notInstalled')}</span>;
  }
  return (
    <span className={`log-line-in font-mono text-[11px] shrink-0 ${item.sizeBytes ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-muted)]'}`}>
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
      className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{ background: tileColor(category), color: TILE_INK }}
    >
      {tileLetter(category)}
    </div>
  );
}

function CategorySection({ category, items, allItems = items, iconSrc, selected, onToggle, onToggleCategory, activeId, receiptMode = false, collapsed, onToggleCollapsed, filtering = false }) {
  const { t } = useLanguage();
  // receiptMode -- and a filter that has matches in this category -- force
  // it open without touching the remembered collapse itself: a collapse the
  // user made while browsing has to still be there, exactly as they left
  // it, once Clean finishes or the filter is cleared.
  const isExpanded = receiptMode || filtering || !collapsed;
  // The heading reflects, and acts on, what is VISIBLE: while a filter
  // shows only some of a category's rules, ticking the heading must never
  // tick (or raise a risky-rule dialog for) rules the user cannot see.
  // Unfiltered, `items` is the whole category.
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
        {/* Ticking this can land on 'some' rather than 'all', and that is
            correct rather than a stuck control: a risky rule is not ticked
            by the heading, it is QUEUED for its own warning dialog
            (lib/categoryTickPlan.js), and stays unticked until the user
            says yes. The box reports what is actually ticked. */}
        <button
          type="button"
          onClick={() => onToggleCollapsed(category)}
          aria-expanded={isExpanded}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[color:var(--text-muted)] shrink-0"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <CategoryIcon category={category} src={iconSrc} />
          <span className="text-[12.5px] font-medium text-[color:var(--text-primary)] truncate">{category}</span>
          <span className="text-[10.5px] text-[color:var(--text-muted)] font-mono shrink-0">{allItems.length}</span>
        </button>
        {/* Negative margins so the 28 px target costs the row nothing: it
            is the same 28 px tall row and the drawn box sits where it did. */}
        <Checkbox
          state={state}
          size={16}
          hit={28}
          className="-my-1.5 -mr-1.5"
          disabled={receiptMode}
          label={t('deepClean.tree.selectCategoryAriaLabel', category)}
          onChange={() => {
            const checked = nextCategoryChecked(state);
            if (filtering) onToggleCategory(category, checked, items.map((item) => item.id));
            else onToggleCategory(category, checked);
          }}
        />
      </div>

      {/* Plain conditional, not the 0fr/1fr height transition this used to
          animate. With every category expanded by default and 29 of them
          in one scroll region, animating a collapse moves everything below
          it -- the cost is paid by rows the user was not looking at. The
          chevron still turns, which is the part that reads as a state
          change. */}
      {isExpanded && (
        <div>
          {items.map((item) => {
          const measured = item.sizeBytes !== null && item.sizeBytes !== undefined;
          return (
            <div
              key={item.id}
              // The whole row toggles the rule -- the box alone is 14 px.
              // Focus goes to the row's own checkbox first because a click
              // on a plain div focuses nothing, and a risky rule opens a
              // dialog that hands focus back to whatever was focused when
              // it opened: without this it would return to <body>.
              //
              // Not in receiptMode: that list is drawn from the frozen
              // snapshot taken when Clean started, while onToggle reads the
              // live selection, so a click could toggle the wrong thing or
              // open a risky-rule dialog in the middle of a clean.
              onClick={receiptMode ? undefined : (event) => {
                // preventScroll: focusing must not scroll the row under the
                // sticky category heading; the scroller's scroll-padding
                // covers keyboard focus.
                event.currentTarget.querySelector('[role="checkbox"]')?.focus({ preventScroll: true });
                onToggle(item.id);
              }}
              className={`flex items-center gap-2.5 pl-[38px] pr-3 py-[3px] transition-colors duration-300 ${
                receiptMode ? '' : 'cursor-pointer hover:bg-[color:var(--surface-subtle)]'
              } ${
                // The row a scan or a clean is working on right now -- the
                // same "what is it doing" question the log line beside the
                // tree already answers, put on the tree itself. A tint
                // rather than a border: side-stripe accents read as a
                // decoration bolted onto a card, not as the row itself
                // being highlighted.
                item.id === activeId
                  ? 'bg-[color:var(--accent-primary)]/[0.08] row-processing'
                  : ''
              }`}
            >
              {/* A rule for software that is not here reads muted rather than
                  faded: opacity dropped the whole row, its live checkbox
                  included, below legible contrast. */}
              <span className={`text-[12px] shrink-0 ${item.present === false ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--text-primary)]'}`}>{item.name}</span>

              {/* Marked because "recoverable" is not "wanted". Clean moves
                  everything to Quarantine first, so nothing here is
                  unrecoverable -- but being signed out of every site is
                  not a surprise a cleaning tool should spring on anyone.
                  None of these is ticked by default; this says why. */}
              {item.risky && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1 rounded bg-[color:var(--warning-soft)] text-[color:var(--warning)] border border-[color:var(--warning)]/25 shrink-0">
                  {t('deepClean.tree.losesData')}
                </span>
              )}

              {/* On the name's own line rather than under it. This is what
                  buys the density back: BleachBit's rows are one line
                  because they say nothing but the name, and these stay one
                  line while still saying what the rule does.

                  Held back until THIS rule is actually measured, though --
                  BleachBit's own list is bare (name and a checkbox, nothing
                  else) until Preview has run, and showing every rule's full
                  explanation before anything is known about the machine is
                  a wall of grey text nobody asked to read yet. `measured`
                  is per-ROW, not gated on the scan as a whole finishing:
                  each line reveals its own description the moment ITS OWN
                  streamed result lands, the same rule-at-a-time reveal the
                  size column and the scan log already do. Never gates the
                  risky-rule badge above -- that is a safety warning, not
                  descriptive text, and hiding it before a scan would let
                  someone tick something that loses data before the app has
                  said so. */}
              {measured && item.description && (
                <span className="log-line-in text-[11px] text-[color:var(--text-muted)] truncate min-w-0 flex-1">
                  {item.description}
                </span>
              )}
              {!(measured && item.description) && <span className="flex-1" />}

              <SizeLabel key={item.sizeBytes === null ? 'pending' : 'measured'} item={item} />

              <Checkbox
                state={selected.has(item.id) ? 'all' : 'none'}
                size={14}
                disabled={receiptMode}
                label={item.name}
                onChange={() => onToggle(item.id)}
              />
            </div>
          );
          })}
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
export default function DeepCleanTree({ categories, selected, onToggle, onToggleCategory, icons = {}, activeId = null, receiptMode = false }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => readCollapsedCategories(window.localStorage));

  const needle = receiptMode ? '' : query.trim().toLowerCase();
  const filtering = needle !== '';

  const toggleCollapsed = (category) => {
    // The list is forced open in these two modes, so a toggle would change
    // nothing on screen while silently rewriting what is remembered.
    if (receiptMode || filtering) return;
    const next = new Set(collapsed);
    if (next.has(category)) next.delete(category); else next.add(category);
    setCollapsed(next);
    writeCollapsedCategories(window.localStorage, next);
  };


  /* The filter is a VIEW. It narrows which rows are drawn and does nothing
   * else: it never reads or writes the selection, so a ticked rule that is
   * filtered out is still ticked, still counted in the header and the
   * footer, and still cleaned. The heading of a category that stays on
   * screen keeps describing the whole category for the same reason.
   *
   * receiptMode is the narrow sidebar Clean shows while running: a live
   * receipt of only what's actually being processed, not the full browsable
   * list. A category left with nothing selected in it is dropped entirely
   * rather than shown empty. */
  const visibleGroups = receiptMode
    ? categories
        .map((group) => ({ ...group, items: group.items.filter((item) => selected.has(item.id)) }))
        .filter((group) => group.items.length > 0)
    : filtering
      ? categories
          .map((group) => {
            // A match on the category's own name keeps all of its rules.
            if (group.category.toLowerCase().includes(needle)) return { ...group, allItems: group.items };
            const items = group.items.filter((item) =>
              item.name.toLowerCase().includes(needle) || (item.description ?? '').toLowerCase().includes(needle));
            return { ...group, allItems: group.items, items };
          })
          .filter((group) => group.items.length > 0)
      : categories;

  const total = categories.reduce((sum, group) => sum + group.items.length, 0);
  // selected.size, the same number the footer shows and Clean acts on.
  const ticked = selected.size;
  const measured = selectionTotal(categories, selected);
  const summary = `${t('deepClean.tree.selectedOfTotal', ticked, total)}${measured.anyMeasured ? ` · ${formatBytes(measured.bytes)}` : ''}`;
  const placeholder = t('deepClean.tree.filterPlaceholder');

  return (
    <div className="glass-panel rounded-xl min-h-0 flex flex-col overflow-hidden">
      {!receiptMode && (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-[color:var(--border-subtle)] shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); } }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="flex-1 min-w-0 text-[12.5px] px-3 py-1.5 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)]/50"
          />
          <span className="text-[11.5px] font-mono text-[color:var(--text-secondary)] shrink-0">{summary}</span>
        </div>
      )}

      <div className="overflow-y-auto min-h-0 flex-1 scroll-pt-[30px]">
        {filtering && visibleGroups.length === 0 && (
          <p className="px-4 py-6 text-center text-[12.5px] text-[color:var(--text-muted)]">{t('deepClean.tree.filterNone')}</p>
        )}
        {visibleGroups.map((group) => (
          <CategorySection
            key={group.category}
            category={group.category}
            items={group.items}
            allItems={group.allItems ?? group.items}
            iconSrc={icons[group.category]}
            selected={selected}
            onToggle={onToggle}
            onToggleCategory={onToggleCategory}
            activeId={activeId}
            receiptMode={receiptMode}
            collapsed={collapsed.has(group.category)}
            onToggleCollapsed={toggleCollapsed}
            filtering={filtering}
          />
        ))}
      </div>
    </div>
  );
}
