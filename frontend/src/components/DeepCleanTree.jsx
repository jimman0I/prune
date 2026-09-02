import { useState } from 'react';

/** Custom checkbox -- coral fill + white check when checked, glass border
 * when not. Not a native <input type="checkbox">, same "build the control
 * ourselves" convention SmartCleanup.jsx's own Toggle already establishes
 * for this codebase's bespoke controls. */
function Checkbox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 transition-colors border ${
        checked
          ? 'bg-[color:var(--accent-coral)] border-[color:var(--accent-coral)]'
          : 'bg-white/[0.03] border-[color:var(--border-subtle)] hover:border-white/25'
      }`}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
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
    return <div className="font-mono text-[12px] shrink-0 text-[color:var(--text-muted)]">—</div>;
  }
  if (item.accessible === false) {
    return <div className="font-mono text-[12px] shrink-0 text-[color:var(--warning)]">needs admin</div>;
  }
  if (item.present === false) {
    return <div className="font-mono text-[12px] shrink-0 text-[color:var(--text-muted)]">not installed</div>;
  }
  return (
    <div className={`font-mono text-[12px] shrink-0 ${item.sizeBytes ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-muted)]'}`}>
      {formatBytes(item.sizeBytes)}
    </div>
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

// No framer-motion (or `motion`) dependency exists in this project's
// package.json, and this feature isn't reason enough to add one -- a
// grid-template-rows 0fr/1fr transition is the well-known dependency-free
// way to animate a block from/to its intrinsic height.
function CategorySection({ category, items, selected, onToggle, onToggleCategory }) {
  const [expanded, setExpanded] = useState(true);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="glass-panel overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            className="text-[color:var(--text-muted)] shrink-0 transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: reduceMotion ? 'none' : 'transform 200ms ease' }}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{category}</span>
          <span className="text-[11.5px] text-[color:var(--text-muted)] font-mono">{items.length}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="text-[11.5px] text-[color:var(--text-secondary)] hover:text-[color:var(--accent-coral)] transition-colors"
            onClick={() => onToggleCategory(category, true)}
          >
            Select All
          </button>
          <span className="text-[color:var(--border-subtle)]">·</span>
          <button
            className="text-[11.5px] text-[color:var(--text-secondary)] hover:text-[color:var(--accent-coral)] transition-colors"
            onClick={() => onToggleCategory(category, false)}
          >
            Deselect All
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: reduceMotion ? 'none' : 'grid-template-rows 260ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[color:var(--border-subtle)] divide-y divide-[color:var(--border-subtle)]">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3.5 px-5 py-3">
                <Checkbox checked={selected.has(item.id)} onChange={() => onToggle(item.id)} label={item.name} />
                <div className={`min-w-0 flex-1 ${item.present === false ? 'opacity-45' : ''}`}>
                  <div className="text-[13px] text-[color:var(--text-primary)]">{item.name}</div>
                  {item.description && (
                    <div className="text-[11.5px] text-[color:var(--text-muted)] mt-0.5 truncate">{item.description}</div>
                  )}
                </div>
                <SizeLabel item={item} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Controlled, purely presentational -- selection state lives in the
 * parent (DeepClean.jsx). `categories` is the scanned tree from
 * GET /api/deep-clean/scan: [{ category, items: [{id, name, description,
 * sizeBytes, ...}] }]. */
export default function DeepCleanTree({ categories, selected, onToggle, onToggleCategory }) {
  return (
    <div className="flex flex-col gap-4">
      {categories.map((group) => (
        <CategorySection
          key={group.category}
          category={group.category}
          items={group.items}
          selected={selected}
          onToggle={onToggle}
          onToggleCategory={onToggleCategory}
        />
      ))}
    </div>
  );
}
