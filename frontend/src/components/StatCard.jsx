/** Shared shell for the Dashboard's top stat tiles -- the glass-panel card
 * + uppercase micro-label every tile already repeated verbatim, factored
 * out so a future stat doesn't mean copy-pasting the wrapper again.
 *
 * `value`/`sublabel` are ReactNode, not plain strings -- each existing tile
 * has its own value typography (Installed Apps' big display-heading number,
 * Total Storage's two-line used/total text, Junk Files' plain secondary-text
 * placeholder), and a fixed one-size style here would flatten that
 * difference. `children` renders below value/sublabel, for extras like
 * Total Storage's usage bar. */
export default function StatCard({ label, value, sublabel, children }) {
  return (
    <div className="glass-panel lift p-6">
      <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-[0.1em] font-medium mb-2">{label}</div>
      {value}
      {sublabel}
      {children}
    </div>
  );
}
