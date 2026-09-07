/** The window's own title bar.
 *
 * Windows draws minimize, maximize and close into the right-hand end of
 * this strip (see electron/main.cjs -- `titleBarOverlay`), and the app
 * owns everything else in it. What the app puts there is the one thing a
 * default Windows title bar could not: the product's mark and name, at a
 * readable size, on the app's own ground rather than the system's.
 *
 * This is also where the logo belongs. It used to sit at the top of the
 * nav rail, alone, because a 72px rail has no room for a wordmark beside
 * it -- the rail's own comment says so. A full-width bar does, so the mark
 * and the name are together here and the rail gets its 52px back for the
 * things it is actually for.
 *
 * DRAGGING is the part that is easy to get wrong. The strip is a drag
 * region, which in a Chromium window means every element inside it stops
 * being clickable unless it opts back out -- so anything interactive added
 * here later needs `no-drag` on it, or it will move the window instead of
 * responding. Nothing here is interactive today, which is why the whole
 * bar can be one region.
 */

/** Where the app's own content has to stop, so it does not run under the
 * buttons Windows draws over this bar.
 *
 * The Window Controls Overlay spec exposes the DRAGGABLE area, not the
 * buttons: `titlebar-area-width` is how much of the strip belongs to the
 * app, so what the buttons occupy is the rest of the width. Measured in
 * the real window, that is 137px of 1280 at this DPI -- and it is a
 * measurement rather than a constant, which is the reason to ask for it
 * instead of hard-coding: it changes with display scaling and with the
 * system language.
 *
 * An earlier version of this line asked for `titlebar-area-inset-right`,
 * which is not a thing. env() falls back silently when the name is
 * unknown, so the 140px fallback was doing all the work while the comment
 * above it claimed the browser was being consulted -- close enough to
 * right on this machine to look correct and wrong everywhere else.
 * Caught by reading the computed padding back out of the running window
 * and finding 148px where 145px was expected.
 *
 * The fallback still matters, for the dev server in an ordinary browser
 * tab where there is no overlay at all. */
const CONTENT_INSET = 'calc(100% - env(titlebar-area-width, calc(100% - 137px)))';

export default function TitleBar() {
  return (
    <header
      // 40px, matching titleBarOverlay.height in main.cjs. The two are
      // separate numbers describing one strip: if they disagree, either
      // the buttons overhang the app's content or the bar has a dead
      // band under them.
      className="h-10 shrink-0 flex items-center gap-2.5 pl-4 select-none border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-base)]"
      style={{
        WebkitAppRegion: 'drag',
        paddingRight: `calc(${CONTENT_INSET} + 8px)`
      }}
    >
      {/* "./logo.png", not "/logo.png". A root-relative path resolves
          against the filesystem root once packaged (file:///C:/logo.png),
          because the app loads over file:// and Vite's base:'./' only
          rewrites what it processes itself -- not a string literal in JSX.
          The nav rail learned this the hard way; see NavRail.jsx. */}
      <img src="./logo.png" alt="" width={20} height={20} className="w-5 h-5 shrink-0" />
      <span className="text-[12.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-primary)]">
        Prune
      </span>
      {/* The window title proper is the product name alone. Anything
          else -- the current screen, a file name -- would be a second
          navigation indicator competing with the rail, which already
          says where you are and does it better. */}
    </header>
  );
}
