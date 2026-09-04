/** The shape of the table that is about to arrive, rather than a spinner
 * where the table will be.
 *
 * A spinner in the middle of content says "something is happening
 * somewhere". A skeleton says "a table with these columns is coming, and
 * it will start here" -- the page does not jump when the data lands,
 * because the space was already the right size and shape.
 *
 * Deliberately not animated with a sweeping shimmer. A shimmer is motion
 * that conveys nothing this app does not already say with the row count
 * beneath it, and this is a tool people open when something is wrong; a
 * loading state that draws attention to itself is the wrong instinct. The
 * rows breathe once, slowly, and stop being interesting.
 */
export default function TableSkeleton({ columns, rows = 8, label }) {
  return (
    <div className="glass-panel overflow-hidden" aria-busy="true" aria-live="polite">
      {/* The real column headers, not grey blocks. They are already known
          -- withholding them to look "loading" would be pretending to know
          less than we do. */}
      <div
        className="grid gap-3 px-5 py-2 border-b border-[color:var(--border-subtle)] bg-white/[0.02]"
        style={{ gridTemplateColumns: columns.map((c) => c.width).join(' ') }}
      >
        {columns.map((col) => (
          <span
            key={col.key}
            className="text-[10.5px] font-mono uppercase tracking-[0.13em] text-[color:var(--text-muted)]"
          >
            {col.label}
          </span>
        ))}
      </div>

      <div className="divide-y divide-[color:var(--border-subtle)]">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid gap-3 px-5 py-2.5 items-center skeleton-row"
            style={{
              gridTemplateColumns: columns.map((c) => c.width).join(' '),
              // Staggered so the block reads as a list settling rather than
              // one rectangle pulsing. Capped low: past a few hundred ms the
              // last row looks broken rather than late.
              animationDelay: `${Math.min(row, 8) * 45}ms`
            }}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="h-[9px] rounded-full bg-white/[0.07]"
                // Varied widths, seeded off the row and column rather than
                // random: a re-render must not reshuffle the bars, which
                // would read as content changing.
                style={{ width: `${45 + ((row * 7 + col.key.length * 11) % 45)}%` }}
              />
            ))}
          </div>
        ))}
      </div>

      {label && (
        <div className="px-5 py-2.5 border-t border-[color:var(--border-subtle)] text-[11.5px] font-mono text-[color:var(--text-muted)]">
          {label}
        </div>
      )}
    </div>
  );
}
