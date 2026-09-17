# Deep Clean: Aesthetic Transition From Selection to Output

## Context

Extends the checkbox-alignment spec (`2026-09-17-deepclean-tree-checkbox-alignment-design.md`, same day). While grounding that spec against real BleachBit, a second, related gap surfaced: `DeepClean.jsx`'s tree/log split is a static CSS Grid (`minmax(0,1fr)_360px`) that never changes proportion -- the tree keeps the majority of the width whether someone is browsing 74 rules to decide what to clean, or watching a clean actually run. Real BleachBit inverts this: a narrow, fixed input sidebar (~210px in the reference screenshot) and a large output pane, because once you've picked what to clean, the interesting thing to watch is what's happening, not the list you already decided on.

User's own ask, verbatim: after selecting what to clean, transition aesthetically to the output, while still showing the input (what was selected).

## What's changing

**Trigger:** the existing `cleaning` boolean (`useDeepCleanExecute`'s own state, already true for the whole duration of an actual Clean run -- not Preview/scan, which is a different phase with a different purpose: browsing/deciding, not watching a result).

**Layout:** `DeepClean.jsx`'s tree/log split changes from a static CSS Grid to a flex row where only the tree column's `width` is driven by `cleaning` and transitions between two states:
- **Browsing** (`cleaning` false): tree wide (`calc(100% - 380px)`, matching the outgoing "tree gets the majority" proportion), log narrow (`flex: 1 min-w-0` fills the remainder, ~380px in practice).
- **Cleaning** (`cleaning` true): tree narrow (`260px`, close to BleachBit's own real sidebar width), log wide (still `flex: 1 min-w-0`, which now fills the much larger remaining space automatically -- no separate transition needed on the log side, since a flex sibling reflows every frame as the other side's width animates).

Both tree-width values are `calc()`/`px` expressions (never `fr`), specifically because CSS reliably interpolates a `width` transition between two lengths that resolve to pixels, but does NOT reliably interpolate `grid-template-columns` across mismatched track types (`minmax(...)` vs a plain length) -- confirmed by reasoning through how each engine handles grid track animation, not assumed. This is why the layout mechanism changes from Grid to Flexbox as part of this work, not left as Grid with a mid-transition value swapped in.

**What "still showing the input" means concretely:** while `cleaning` is true, the tree does NOT keep rendering all 74-ish rows squeezed into 260px (unreadable, and mostly irrelevant -- nobody re-decides their selection while a clean neither pauses nor waits for further input). Instead `DeepCleanTree` gets a new `receiptMode` boolean prop: when true, it renders ONLY the categories/items that are actually selected (`selected.has(item.id)`), with every remaining category forced expanded (a collapsed chevron hiding the one thing being watched right now would defeat the point). This turns the narrow sidebar into a live, compact confirmation of exactly what's being processed -- and since `activeId` already highlights whichever row a clean is currently working on, that highlight now does its job in a list that's short enough to see the whole thing at once, instead of scrolling to find the active row in a full 74-row list.

**What's NOT changing:** checkbox click handlers stay wired exactly as they are today (no new disabling of interaction during a clean -- out of scope, and current behavior of what happens if you toggle mid-clean is unchanged by this work either way). The risky-badge, size label, and description rendering inside a kept row are unchanged. Preview/scanning's layout is unaffected -- this only triggers on `cleaning`, not `scanning`. Motion respects the project's existing global `prefers-reduced-motion` rule (already collapses all animation/transition durations app-wide; confirmed by reading `index.css`'s existing rule rather than re-implementing a per-component opt-out).

## Testing

A real render test proving: when `cleaning` is true, `DeepCleanTree` receives only the selected items (a category with zero selected items is absent from what's passed/rendered, a category with some selected items shows only those, forced-expanded even if the user had collapsed it before Clean was clicked). A render test confirming the tree wrapper's inline width style differs between `cleaning: true` and `cleaning: false` (proving the state actually drives a different value, not just that the code compiles). No test asserts on the animation itself (jsdom doesn't run transitions) -- covered by a manual visual check instead, same as other motion work this project has shipped.
