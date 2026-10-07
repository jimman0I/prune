# Design System: Prune

A Windows uninstaller, disk map and cleaner for one technical person on their own machine. This file describes the system as it ships, marks where it deliberately departs from the Stitch design-taste defaults (and why), and lists the adjustments proposed after running those rules against the app. Sections marked **Proposed** are not applied yet; **Considered, declined** sections were weighed against an existing, deliberate decision and left as they were, with the reasoning given.

## 1. Visual Theme & Atmosphere

A restrained, cockpit-dense instrument panel on an obsidian ground. Quiet and unhurried: it reports what it measured and never celebrates. Machine output (sizes, paths, counts, registry keys) is set in monospace so it reads as data, while headings carry the only editorial note. Dark is the home theme; a warm paper-white theme exists for daylight and is held to the same contrast floor.

- Density: **9 / 10, Cockpit Dense.** The whole table is shown. Nothing is paginated or summarised for tidiness.
- Variance: **3 / 10, Predictable Symmetric.** A fixed navigation rail and a single content column. There is no hero, so the asymmetric-hero rules do not apply.
- Motion: **2 / 10, Static Restrained.** State changes and one sliding active mark on the rail. No bounce, no celebration. This overrides the skill's default of spring physics and perpetual micro-loops: the brief for a tool that deletes things is explicitly "holding a knife".

## 2. Color Palette & Roles

Dark (default)
- **Obsidian Ground** (#09090b) - page background. Never pure black.
- **Panel Graphite** (#131316) - panels and raised surfaces.
- **Paper Ink** (#fafafa) - primary text, 17.8:1 on panels.
- **Zinc Mist** (#a1a1aa) - secondary text, 7.2:1 on panels.
- **Quiet Slate** (#85858f) - third tier: column headers, placeholders, units. 5.1:1 on panels; chosen to clear 4.5:1 on every ground it sits on.
- **Hairline** (rgba(255,255,255,0.06)) - panel borders. Control edges that must be found use rgba(255,255,255,0.36) (about 3.3:1).
- **Instrument Cyan** (#18a9c2) - the one accent. Means "the thing you click" and nothing else. Was #06b6d4 at 94% saturation, over the rule's own 80% ceiling; lowered to 78%, same hue, 7.10:1 on the ground.

Status colours (semantic, never decorative, always paired with a word): **Fault Rose** #ec5162, **Caution Amber** #f59e0b, **Running Green** #5db872.

Light
- **Warm Paper** (#f7f6f4) ground, **Pure Surface** (#ffffff) panel, **Ink** (#1c1917) text, **Stone** (#57534e) secondary, **Taupe** (#6b655f) third tier, **Deep Cyan** (#11728d) accent. Was #0e7490 at 82% saturation; lowered to 78%, 5.10:1 on the page ground.

The ambient backdrop and two list badges used to carry purple and blue that meant nothing: the aurora mixed violet (16%) and blue (10%) in with the accent (the purple-blue neon look the rules ban), and the Applications list coloured its Store and browser-extension badges the same way. The aurora now tints from the single accent only, varying in opacity across its three layers rather than in hue; both badges are neutral outline. Purple and blue still mark genuinely categorical data -- the disk map's file types, the icon tiles -- where a hue tells two categories apart rather than decorating one.

## 3. Typography Rules

- **Display:** Geist at 600 weight, used for page titles and the one question per screen. Was IBM Plex Serif; compared live against this alternative and resolved in favour of Geist -- one typeface read as more of a piece with itself on a cockpit-dense instrument panel than a second, editorial voice did. See index.css's own notes on both the original departure and the reversal.
- **UI body:** Geist, regular and medium, 12.5 to 13px for controls and rows, 11 to 11.5px for column headers and metadata. Nothing is below 11px.
- **Data:** JetBrains Mono for every number, path, registry key and size; tabular figures.
- **Banned here:** Inter, generic system fonts for UI, light weights at small sizes.

Geist and JetBrains Mono are bundled with the app (`@fontsource`, imported in `main.jsx`), not loaded from a Google Fonts network call -- an offline desktop cleaner has no business depending on fonts.googleapis.com being reachable just to render its own text. Plex Serif was bundled the same way while it still carried the display headings; dropped once Geist took that role over.

## 4. Component Stylings

- **Buttons:** Primary is accent-filled with dark ink (text 7.10:1). Secondary is a ghost with a visible edge. Destructive is rose-tinted, never the default focus, and named for what it does. No accent-tinted outer-glow shadow on the primary button, the scan-progress bar, or the disk-map treemap's hover highlight -- depth from a 1px edge, an ordinary black drop shadow, and a translate on press, not a simulated light source.
- **Cards and panels:** Glass panel with a hairline border, used for dialogs and the Dashboard's single actions. Settings' General tab and the Dashboard's quiet row (Drive health / Junk files / Left behind) moved from one-card-per-toggle and a three-up strip to rows in a single panel, separated by hairline dividers -- three-up at any width still reads as the stat-card shape the brief forbids, chrome or no chrome.
- **Inputs:** Label above, hint or error below, accent focus ring (2px, 7.10:1 on the ground). The exclusions field accepts a folder, a file type or a registry key.
- **Tables:** Sticky header, 11px mono column labels, tinted row hover, a per-row action revealed on hover or focus. **Considered, declined:** showing the row Uninstall button faintly at rest. The current invisible-at-rest treatment is a deliberate, tested decision from an earlier apple-design pass (dense-table hover convention), and the row is already keyboard-focusable with the action revealed on focus-within -- the discoverability gap this would have closed is already closed for keyboard use; reversing the mouse-rest behaviour on top of that risked 212 rows of visible red Uninstall buttons for a marginal gain.
- **Badges:** 11px mono, uppercase, bordered. One meaning each: STORE, NEW, RUNNING, LEFT BEHIND. LOSES DATA and the Deep Clean tree's "takes a long time" badge are neutral outline now; amber is reserved for irreversible mode (Delete now) and real faults.
- **Loaders:** Determinate progress with counters where the work is countable. Duplicates' spinner became three skeleton group-cards (a hash scan has no total until it finishes, so a real progress bar would have to lie about one -- skeleton rows say "results shaped like this are coming" without claiming a percentage). **Considered, declined** for the other two named: Disk Map's breathing rings and Deep Clean's header dot are both already honest alternatives to a lying bar, not stand-ins for one -- Disk Map's own test suite documents "a real progress bar would have to lie" for a directory walk with no knowable total, and Deep Clean's dot is a liveness heartbeat beside an already-determinate bar+counter, covering the gap between discrete rule updates that a static bar can't.
- **Empty states:** Say what is missing and the next action. Duplicates gained a native folder-browse button (the same chooser Forced Uninstall already used) so the field no longer requires a hand-typed path. **Proposed, not yet done:** a composed empty state with recent folders.

## 5. Layout Principles

A 72px navigation rail (labels on hover or focus) beside one scrolling content column, content capped near 1400px. CSS Grid for page structure. No overlapping elements. The root shell uses fixed viewport height with its own scrolling regions, which is correct for a windowed Electron app; the mobile-browser rule against `h-screen` does not apply. Desktop only: keyboard and mouse, focus visible everywhere, 11px minimum text, 28px minimum control height.

## 6. Motion & Interaction

Transform and opacity only. The rail's active mark slides on the compositor. A slow aurora drift pauses when the window is inactive, and every animation collapses under reduced motion. Nothing loops to attract attention.

## 7. Anti-Patterns (Banned)

No emojis (none in the UI today). No Inter. No pure black or pure white grounds. No neon or outer-glow shadows. No gradient text. No custom cursors. No overlapping elements. No three equal stat cards. No second accent that is not a status. No celebratory or marketing copy ("Elevate", "Seamless", "Unleash"). No fake round numbers; an unmeasured value says "Not measured", never 0. No native `title=` hover text.
