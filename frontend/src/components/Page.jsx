/** The one outer wrapper for a screen: the same gutters and the same
 * maximum width everywhere, so the left edge of every page title lines up
 * with the next screen's when you switch between them.
 *
 * The screens used to choose for themselves and had drifted to 1400px,
 * 1600px and no limit at all. Hard-coded numbers in nine files is how that
 * happens; one component is how it stops.
 *
 * `className` is for what a screen adds on top -- a screen that owns its own
 * scrolling region, say, adds `h-full flex flex-col min-h-0` -- and never
 * for the gutters or the width, which belong here. */
export default function Page({ className = '', children }) {
  return <div className={`px-12 py-10 max-w-[1400px] ${className}`.trim()}>{children}</div>;
}
