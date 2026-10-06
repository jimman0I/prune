import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { SCREEN_ORDER } from '../lib/screenOrder.js';

/** Each item's catalog key, kept apart from ITEMS below because `t()`
 * needs the current language from context and ITEMS is built once, at
 * module load, before any component has rendered. */
const NAV_KEYS = {
  dashboard: 'nav.dashboard',
  diskmap: 'nav.diskMap',
  applications: 'nav.applications',
  quarantine: 'nav.quarantine',
  settings: 'nav.settings',
  startup: 'nav.startup',
  duplicates: 'nav.duplicates',
  deepclean: 'nav.deepClean'
};

const ITEMS = [
  // A gauge: an open arc with a needle. The Dashboard used to share a
  // four-tile grid glyph with the Disk Map (a tiled treemap), and two
  // near-identical squares one row apart is exactly what an icon rail must
  // not have -- the reading here is "how healthy is this PC", which a dial
  // says and a grid does not.
  { id: 'dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.6 17a9 9 0 1 1 16.8 0"></path>
      <path d="M12 15l4-5"></path>
      <path d="M12 15v.01"></path>
    </svg>
  ) },
  { id: 'diskmap', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="10" height="10" rx="1.5"></rect>
      <rect x="15" y="3" width="6" height="6" rx="1.5"></rect>
      <rect x="15" y="11" width="6" height="10" rx="1.5"></rect>
      <rect x="3" y="15" width="10" height="6" rx="1.5"></rect>
    </svg>
  ) },
  { id: 'applications', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1"></rect>
      <rect x="3" y="10" width="18" height="4" rx="1"></rect>
      <rect x="3" y="16" width="18" height="4" rx="1"></rect>
    </svg>
  ) },
  { id: 'quarantine', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 4v5c0 4.5-3.2 8.4-8 9.5-4.8-1.1-8-5-8-9.5V7l8-4z"></path>
      <path d="M12 8v5"></path>
      <path d="M12 16.5v.01"></path>
    </svg>
  ) },
  { id: 'startup', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10"></path>
      <path d="M18.4 6.6a9 9 0 1 1-12.8 0"></path>
    </svg>
  ) },
  // Two overlapping sheets: the one glyph that reads as "copies" without
  // needing a label, which matters in a 72px rail.
  { id: 'duplicates', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  ) },
  // A broom. It has been a mouse cursor and then a paintbrush, and both
  // named the wrong action for the one screen in the app that deletes the
  // most at once -- the pointer read as "select", and the brush read as
  // paint, which is the opposite of removing something.
  //
  // The head FLARES WIDER toward the bottom, which is the whole difference
  // between a broom and a bucket. A first attempt tapered it inward and
  // read unmistakably as a bucket -- rendered at 20px and looked at, not
  // guessed.
  //
  // The handle is vertical rather than angled for the same reason. An
  // angled handle is more broom-like on paper and was the version I
  // expected to win; rasterised at the 20px this actually ships at, the
  // angle collapses into a stubby off-centre mark and the extra bristle
  // strokes merge into noise. Straight survives the size.
  { id: 'deepclean', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5v7.5"></path>
      <path d="M8.8 10h6.4l2.8 10.5H6z"></path>
      <path d="M7.8 14.2h8.4"></path>
      <path d="M12 14.2v6.3"></path>
    </svg>
  ) }
];

/** Settings lives in the rail's footer, below the update button, rather than
 * in the run of destinations. It is still a screen (Ctrl+8, and Ctrl+, opens
 * it directly), just not one of the places you go to work. */
const SETTINGS_ITEM = { id: 'settings', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ) };

/** The rail's glyphs by screen id, for anywhere else that points at a screen
 * (the What's new dialog), so a screen has one icon in the whole app. */
export const NAV_ICONS = Object.fromEntries([...ITEMS, SETTINGS_ITEM].map((item) => [item.id, item.icon]));

/** One place in the rail.
 *
 * The rail is icons only at rest and widens over the page on hover (see
 * NavRail below), so each row is ONE layout used in both states: the button
 * always fills the row, the icon always sits 14px in from the row's left
 * edge, and the label is always there at a fixed width, revealed by opacity.
 * Nothing about the icon moves while the rail grows -- its centre is x=36
 * collapsed and expanded, which is also where the title bar's logo
 * (TitleBar.jsx) sits over it. TitleBar.render.test.jsx reads these numbers
 * out of this file and fails if the two ever disagree.
 *
 * The label has a fixed width on purpose. Left to size itself it would
 * re-wrap on every frame of the width transition.
 *
 * The flyout carries only the Ctrl+N key: the name is already printed in
 * the row the moment the pointer or keyboard focus reaches the rail. */
/** The in-row label. Fixed width (see NavItem), faded in by the rail's own
 * hover or keyboard focus, and `pointer-events-none` because at rest it
 * overflows the 72px column invisibly and must never catch a click meant
 * for the page underneath. */
const LABEL_CLASS = 'relative w-[118px] shrink-0 pointer-events-none text-left text-[13px] leading-[1.15] font-medium [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100';

function NavItem({ item, screen, onNavigate, label }) {
  const active = screen === item.id;
  const number = SCREEN_ORDER.indexOf(item.id) + 1;
  const shortcut = `Ctrl+${number}`;
  return (
    // The label is a real element, not a `title` attribute -- this
    // codebase does not use native hover text anywhere. It sits OUTSIDE
    // the rail's own bounds, so it needs the group to be positioned and
    // the label to escape via translate rather than by widening anything.
    <div className="relative group">
      <motion.button
        // Press only. Nav items are hit constantly, so no hover motion
        // (HIG, Motion: avoid motion on frequent interactions) and a
        // quick, non-bouncing tap. The sliding indicator below is the
        // purposeful motion here.
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => onNavigate(item.id)}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        aria-keyshortcuts={`Control+${number}`}
        className={`peer relative w-full h-11 rounded-xl flex items-center justify-start gap-3 pl-[14px] pr-3 transition-colors ${
          active ? 'text-[color:var(--accent-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
        }`}
      >
        {/* The active tint and the edge pill below, always mounted and
            toggled by opacity rather than a shared layoutId.

            Used to be `layoutId`-animated so framer-motion would slide the
            mark down the rail between buttons instead of fading. Dropped:
            that mechanism measures each element's rect with
            getBoundingClientRect() and bakes the result into a `transform`
            matrix to FLIP from the old position to the new one, and under
            fractional OS display scaling (confirmed broken at Windows'
            150%) that measurement can land on a different sub-pixel
            boundary than the icon beside it, which stays in plain static
            layout and is rounded by the browser's own layout engine
            instead -- the two drift apart, visibly. inset-0 already pins
            this element exactly to its own button's box in ordinary CSS,
            with no JS-measured rect in between; opacity cannot desync
            from that the way a transform can. Behind the glyph and
            aria-hidden: it is decoration for a state `aria-current`
            already reports. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-xl bg-[color:var(--accent-primary-soft)] transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* The 3px pill at the rail's edge: the tint alone is a faint wash
            in light mode, and this is the mark that survives squinting. */}
        <span
          aria-hidden="true"
          className={`absolute -left-[8px] top-3 h-5 w-[3px] rounded-full bg-[color:var(--accent-primary)] transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-0'}`}
        />
        <span className="relative">{item.icon}</span>
        <span aria-hidden="true" className={LABEL_CLASS}>
          {label}
        </span>
      </motion.button>

      {/* The key chip, beside the widened rail. Hover on the whole item,
          and keyboard focus via `peer-focus-visible` -- not
          `group-focus-within`: clicking a nav button focuses it, that focus
          outlives the pointer leaving, and the chip of whichever screen you
          had just opened sat over the content until you clicked elsewhere.
          `:focus-visible` is what Chromium already draws the mouse/keyboard
          distinction with. It hangs off `peer` rather than the wrapper's
          `group` because only the button can be focused. The name is not
          here: the row already prints it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md whitespace-nowrap font-mono text-[11px] text-[color:var(--text-muted)] bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] shadow-lg opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-150 z-flyout"
      >
        {shortcut}
      </span>
    </div>
  );
}

/** "Report a bug", in the footer beside Settings.
 *
 * An action, not a place: it opens a dialog, so it has no Ctrl+N key, no
 * route and no active state, and is left out of SCREEN_ORDER. It borrows the
 * rail rows' geometry (same 44px button, same icon centre at x=36) so the
 * footer reads as one column. No key chip: there is no chord to show. */
// A beetle: legs, antennae and a split shell. The first version was a chat
// bubble with a "!", which reads as "message" or "alert" rather than "bug".
const REPORT_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 2 1.88 1.88"></path>
    <path d="M14.12 3.88 16 2"></path>
    <path d="M9 7.13v-1a3 3 0 1 1 6 0v1"></path>
    <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path>
    <path d="M12 20v-9"></path>
    <path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path>
    <path d="M6 13H2"></path>
    <path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path>
    <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"></path>
    <path d="M22 13h-4"></path>
    <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"></path>
  </svg>
);

function ActionItem({ icon, label, onClick }) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-haspopup="dialog"
        className="peer relative w-full h-11 rounded-xl flex items-center justify-start gap-3 pl-[14px] pr-3 transition-colors text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]"
      >
        <span className="relative">{icon}</span>
        <span aria-hidden="true" className={LABEL_CLASS}>
          {label}
        </span>
      </button>
    </div>
  );
}

export default function NavRail({ screen, onNavigate, footer = null, onReportBug = null }) {
  const { t } = useLanguage();
  return (
    // The <nav> only RESERVES the 72px column the page lays out beside.
    // The panel inside it is what grows, absolutely positioned so it widens
    // OVER the page: animating the width of something in the flow would
    // re-lay-out every screen, tables and treemap included, on every frame
    // of every hover. Opens on pointer hover or on keyboard focus
    // (`:focus-visible`, not `:focus-within` -- see the key chip in
    // NavItem), and closes the moment both are gone.
    <nav className="relative z-flyout w-[72px] shrink-0" aria-label={t('nav.landmark')}>
      <div className="group/rail absolute inset-y-0 left-0 w-[72px] hover:w-[200px] has-[:focus-visible]:w-[200px] flex flex-col items-stretch gap-2 py-6 px-[12px] transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]">
        {/* The glass is a background LAYER here, not the container itself.
            `backdrop-filter` establishes a containing block and clips
            absolutely positioned descendants to its own border box, so with
            .glass-panel on this element the key chips were sliced off at
            the rail's edge. A chip does not need a portal; it needs the
            blurred surface to be a sibling rather than an ancestor. */}
        <div className="glass-panel absolute inset-0" aria-hidden="true" />
        {/* The mark lives in the window's title bar (TitleBar.jsx), which is
            full width and has room for the wordmark; the rail's 72px does
            not. */}
        {ITEMS.map((item) => (
          <NavItem key={item.id} item={item} screen={screen} onNavigate={onNavigate} label={t(NAV_KEYS[item.id])} />
        ))}
        {/* Pushed to the bottom, below every destination: the update button
            (App passes it in, a slot rather than the button itself so the
            rail makes no requests of its own) and Settings beneath it. The
            slot is nudged 2px so its 44px button's icon lands on the same
            x=36 centre as the rows above (12px gutter + 2). */}
        <div className="relative mt-auto flex flex-col items-stretch gap-2">
          {footer && <div className="flex flex-col items-start pl-[2px]">{footer}</div>}
          {onReportBug && <ActionItem icon={REPORT_ICON} label={t('nav.reportBug')} onClick={onReportBug} />}
          <NavItem item={SETTINGS_ITEM} screen={screen} onNavigate={onNavigate} label={t(NAV_KEYS.settings)} />
        </div>
      </div>
    </nav>
  );
}
