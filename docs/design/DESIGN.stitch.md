# Design System: Prune

A Windows uninstaller, disk map and cleaner for one technical person on their own machine. This file describes the system as it ships, marks where it deliberately departs from the Stitch design-taste defaults (and why), and lists the adjustments proposed after running those rules against the app. Sections marked **Proposed** are not applied yet.

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
- **Instrument Cyan** (#06b6d4) - the one accent. Means "the thing you click" and nothing else.

Status colours (semantic, never decorative, always paired with a word): **Fault Rose** #ec5162, **Caution Amber** #f59e0b, **Running Green** #5db872.

Light
- **Warm Paper** (#f7f6f4) ground, **Pure Surface** (#ffffff) panel, **Ink** (#1c1917) text, **Stone** (#57534e) secondary, **Taupe** (#6b655f) third tier, **Deep Cyan** (#0e7490) accent.

**Proposed:**
- Lower the accent's saturation. Instrument Cyan is 94% saturated (Deep Cyan 82%); the rule is under 80%. **#18a9c2** (dark, 7.10:1 on the ground) and **#11728d** (light, 5.10:1) keep the hue and pass contrast.
- Remove the purple and blue ambient colours. The aurora backdrop mixes violet (16%) and blue (10%) with cyan, which is the purple-blue neon look the rules ban, and the extension badge (purple) and one size band (blue) add accents that mean nothing to the task. Aurora tinted from the single accent only; badges and size bands in the neutral and status ramps.

## 3. Typography Rules

- **Display:** Geist at 600 weight, used for page titles and the one question per screen. Was IBM Plex Serif; compared live against this alternative and resolved in favour of Geist -- one typeface read as more of a piece with itself on a cockpit-dense instrument panel than a second, editorial voice did. See index.css's own notes on both the original departure and the reversal.
- **UI body:** Geist, regular and medium, 12.5 to 13px for controls and rows, 11 to 11.5px for column headers and metadata. Nothing is below 11px.
- **Data:** JetBrains Mono for every number, path, registry key and size; tabular figures.
- **Banned here:** Inter, generic system fonts for UI, light weights at small sizes.

**Proposed:** Geist is loaded through a Google Fonts import (`index.css` line 1). An offline desktop cleaner should not make a network call at launch; bundle Geist, Plex Serif and JetBrains Mono with the app.

## 4. Component Stylings

- **Buttons:** Primary is accent-filled with dark ink (text 8.19:1). Secondary is a ghost with a visible edge. Destructive is rose-tinted, never the default focus, and named for what it does. **Proposed:** remove the accent glow shadows on the primary button and the scan-progress bar; depth from a 1px edge and a -1px active translate only.
- **Cards and panels:** Glass panel with a hairline border, used for dialogs and the Dashboard's single actions. **Proposed:** in Settings, replace one-card-per-toggle with rows separated by hairline dividers; and replace the Dashboard's three-up Drive health / Junk files / Left behind strip with three list rows (it is already one bordered panel, but it reads as the stat-card row the brief forbids).
- **Inputs:** Label above, hint or error below, accent focus ring (2px, 8.19:1 on the ground). The exclusions field accepts a folder, a file type or a registry key.
- **Tables:** Sticky header, 11px mono column labels, tinted row hover, a per-row action revealed on hover or focus. **Proposed:** show the row Uninstall button faintly at rest on the focused row; hover-only is the weakest discovery path.
- **Badges:** 11px mono, uppercase, bordered. One meaning each: STORE, NEW, RUNNING, LEFT BEHIND, LOSES DATA. **Proposed:** neutral outline for LOSES DATA; reserve amber for irreversible mode and real faults.
- **Loaders:** Determinate progress with counters where the work is countable. **Proposed:** replace the circular spinners (Deep Clean header, Disk Map scan, Duplicates) with a progress line and skeleton rows that match the layout.
- **Empty states:** Say what is missing and the next action. **Proposed:** Duplicates, today a single field above a blank screen, gets a composed empty state with a Browse button and recent folders.

## 5. Layout Principles

A 72px navigation rail (labels on hover or focus) beside one scrolling content column, content capped near 1400px. CSS Grid for page structure. No overlapping elements. The root shell uses fixed viewport height with its own scrolling regions, which is correct for a windowed Electron app; the mobile-browser rule against `h-screen` does not apply. Desktop only: keyboard and mouse, focus visible everywhere, 11px minimum text, 28px minimum control height.

## 6. Motion & Interaction

Transform and opacity only. The rail's active mark slides on the compositor. A slow aurora drift pauses when the window is inactive, and every animation collapses under reduced motion. Nothing loops to attract attention.

## 7. Anti-Patterns (Banned)

No emojis (none in the UI today). No Inter. No pure black or pure white grounds. No neon or outer-glow shadows. No gradient text. No custom cursors. No overlapping elements. No three equal stat cards. No second accent that is not a status. No celebratory or marketing copy ("Elevate", "Seamless", "Unleash"). No fake round numbers; an unmeasured value says "Not measured", never 0. No native `title=` hover text.
