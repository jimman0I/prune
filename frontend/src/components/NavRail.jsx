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

/** One place in the rail.
 *
 * TWO LAYOUTS FROM ONE ELEMENT, chosen by window width in CSS rather than
 * in JavaScript: icons only below 1100px, and from 1100px a ~200px rail
 * with the label written out beside each icon. Class-based (`min-[1100px]:`)
 * because the breakpoint is about the window and needs no resize listener,
 * no state, and no first-paint flash of the wrong rail.
 *
 * The icon's centre is x=36 in BOTH states -- centred in the 72px column
 * when narrow, and 12px gutter + 14px inset + half the 20px glyph when
 * wide -- so the title bar's logo (TitleBar.jsx) sits over it either way.
 * TitleBar.render.test.jsx reads these numbers out of this file and fails
 * if the two states ever disagree.
 *
 * The flyout is for the icon-only state (a glyph alone is a memory test)
 * and carries the name and the Ctrl+N key; from 1100px the name is printed
 * in the row, so the flyout keeps only the key. */
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
        className={`peer relative w-11 h-11 rounded-xl flex items-center justify-center min-[1100px]:w-full min-[1100px]:justify-start min-[1100px]:gap-3 min-[1100px]:pl-[14px] min-[1100px]:pr-3 transition-colors ${
          active ? 'text-[color:var(--accent-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
        }`}
      >
        {/* The active tint is its own element with a shared layoutId, so
            framer-motion animates it BETWEEN buttons rather than fading
            one out and another in -- the mark slides down the rail to the
            tab you picked. Only one of these exists at a time, which is
            what makes the shared layout work.

            Behind the glyph and aria-hidden: it is decoration for a state
            `aria-current` already reports. */}
        {active && (
          <motion.span
            layoutId="nav-active"
            aria-hidden="true"
            className="absolute inset-0 rounded-xl bg-[color:var(--accent-primary-soft)]"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        {/* The 3px pill at the rail's edge: the tint alone is a faint wash
            in light mode, and this is the mark that survives squinting. It
            slides with the tint on its own layoutId. Positioned with
            explicit offsets, NOT a -translate-y-1/2 class: framer writes
            `transform` on layout animations and would clobber it. */}
        {active && (
          <motion.span
            layoutId="nav-pill"
            aria-hidden="true"
            className="absolute -left-[10px] min-[1100px]:-left-[8px] top-3 h-5 w-[3px] rounded-full bg-[color:var(--accent-primary)]"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
        )}
        <span className="relative">{item.icon}</span>
        <span aria-hidden="true" className="relative hidden min-[1100px]:block text-[13px] font-medium truncate">
          {label}
        </span>
      </motion.button>

      {/* Shown on hover AND on keyboard focus: someone tabbing the rail
          needs the name at least as much as someone pointing at it.
          `pointer-events-none` so it can never sit between the cursor and
          the button underneath it.

          The keyboard half is `peer-focus-visible`, not
          `group-focus-within`, and the difference was a real bug: clicking
          a nav button focuses it, and that focus outlives the pointer
          leaving, so the label of whichever screen you had just opened sat
          there over the content until you clicked something else.
          `:focus-within` cannot tell those apart -- it is `:focus`, which a
          mouse sets. Chromium already draws the distinction we want
          (measured live: after a click, `:focus-within` true,
          `:focus-visible` false), so asking for `:focus-visible` keeps the
          label for the tabbing user and drops it for the clicking one.

          It hangs off `peer` rather than the wrapper's `group` because the
          group is a div: only the button can be focused, and only an
          element that matches the pseudo-class can drive a variant. Hover
          stays on the group, which is the whole target area.

          In the wide rail the label is already printed in the row, so the
          flyout drops the name (`min-[1100px]:hidden` on it) and keeps only
          the key: a small chip beside the rail on hover or focus. Putting
          the key IN the row instead reserved ~38px the label needed -- at
          200px it truncated "Applications". */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded-md whitespace-nowrap text-[11.5px] font-medium bg-[color:var(--bg-panel)] text-[color:var(--text-primary)] border border-[color:var(--border-subtle)] shadow-lg opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-150 z-flyout"
      >
        <span className="min-[1100px]:hidden">{label}</span>
        <span className="ml-2 min-[1100px]:ml-0 font-mono text-[10.5px] text-[color:var(--text-muted)]">{shortcut}</span>
      </span>
    </div>
  );
}

export default function NavRail({ screen, onNavigate, footer = null }) {
  const { t } = useLanguage();
  return (
    <nav className="relative flex flex-col items-center min-[1100px]:items-stretch gap-2 py-6 w-[72px] min-[1100px]:w-[200px] min-[1100px]:px-[12px] shrink-0" aria-label={t('nav.landmark')}>
      {/* The glass is a background LAYER here, not the container itself.
          `backdrop-filter` establishes a containing block and clips
          absolutely positioned descendants to its own border box, so with
          .glass-panel on the <nav> every flyout label was sliced off at
          the rail's edge -- visible as "Deep Cle". The same property
          already caught this codebase once, in the treemap tooltip, which
          escapes via a portal. A nav label does not need a portal; it
          needs the blurred surface to be a sibling rather than an
          ancestor. */}
      <div className="glass-panel absolute inset-0" aria-hidden="true" />
      {/* The mark used to be here, alone, because a 72px rail is too
          narrow for the wordmark beside it without shrinking one or
          wrapping the other. The window's own title bar is full width and
          has room for both, so the logo moved there (TitleBar.jsx) and
          the rail got the 52px back for the things it exists for. Two
          copies of the same mark, one directly above the other, was the
          alternative and said nothing twice. */}
      {ITEMS.map((item) => (
        <NavItem key={item.id} item={item} screen={screen} onNavigate={onNavigate} label={t(NAV_KEYS[item.id])} />
      ))}
      {/* Pushed to the bottom of the rail, below every destination: the
          update button (App passes it in, a slot rather than the button
          itself so the rail makes no requests of its own) and Settings
          beneath it. The slot's left edge is nudged 2px in the wide rail so
          its 44px button lines up with the rows above (12px gutter + 2 =
          the 14px the icons' buttons start at). */}
      <div className="relative mt-auto flex flex-col items-center min-[1100px]:items-stretch gap-2">
        {footer && <div className="flex flex-col items-center min-[1100px]:items-start min-[1100px]:pl-[2px]">{footer}</div>}
        <NavItem item={SETTINGS_ITEM} screen={screen} onNavigate={onNavigate} label={t(NAV_KEYS.settings)} />
      </div>
    </nav>
  );
}
