# Deep Clean Tree: BleachBit Checkbox Alignment + Selection-to-Output Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Move each row's checkbox in `DeepCleanTree.jsx` to the row's right edge, matching real BleachBit's own layout. (2) When a Clean run starts, animate the tree/log split from "tree wide, log narrow" to "tree narrow, log wide," and while narrow, show only the selected items (a live receipt of what's being cleaned) instead of the full browsable list.

**Architecture:** (1) is pure JSX reordering in `DeepCleanTree.jsx`. (2) is a layout change in `DeepClean.jsx` (CSS Grid -> Flexbox with an animated `width` on the tree column, driven by the existing `cleaning` boolean) plus a new `receiptMode` filtering prop on `DeepCleanTree.jsx`.

**Tech Stack:** React, Vitest + Testing Library.

**Specs:**
- `docs/superpowers/specs/2026-09-17-deepclean-tree-checkbox-alignment-design.md`
- `docs/superpowers/specs/2026-09-17-deepclean-selection-to-output-transition-design.md`

---

### Task 1: Move the checkbox to the end of each row

**Files:**
- Modify: `frontend/src/components/DeepCleanTree.jsx`
- Modify: `frontend/src/components/DeepCleanTree.render.test.jsx`

- [ ] **Step 1: Read the current file in full**

Read `frontend/src/components/DeepCleanTree.jsx`'s full current content, and `frontend/src/components/DeepCleanTree.render.test.jsx`'s full current content (its real render-helper function name, its real fixture category/item names, its real existing test structure -- e.g. `headingBox()` helper).

- [ ] **Step 2: Write a new failing test proving the checkbox is now last in each row**

Add a new describe block to `DeepCleanTree.render.test.jsx` proving: (a) the category heading checkbox is the LAST interactive/button element in its row container, not the first; (b) an item row's checkbox is the LAST child in its row container, not the first. Use the file's REAL existing render helper and REAL fixture names (read the file first). If finding "the row container" needs `.closest()` on something other than a plain `div`, inspect the actual rendered output to target the right ancestor.

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd frontend && npx vitest run src/components/DeepCleanTree.render.test.jsx -t "checkbox"
```

Expected: FAIL -- checkbox is currently first, not last, in both row types.

- [ ] **Step 4: Move the checkbox in the category heading row**

In `DeepCleanTree.jsx`'s `CategorySection`, the heading row currently renders (in order): `<Checkbox .../>`, then the expand `<button>` containing chevron+icon+label+count. Reorder so the expand button comes first and `<Checkbox>` comes last. Confirm the expand button keeps whatever flex-grow class lets its label still truncate correctly.

- [ ] **Step 5: Move the checkbox in the item row**

In the same file's item-row JSX, currently renders (in order): `<Checkbox>`, name `<span>`, risky badge (conditional), description/flex-spacer, `<SizeLabel>`. Reorder so `<Checkbox>` becomes the LAST element in the row (after `<SizeLabel item={item} />`), with the name span now first.

- [ ] **Step 6: Run it, confirm it passes**

```bash
npx vitest run src/components/DeepCleanTree.render.test.jsx
```

Expected: all pass, including the new checkbox-alignment tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DeepCleanTree.jsx frontend/src/components/DeepCleanTree.render.test.jsx
git commit -m "feat(deepCleanTree): move each row's checkbox to the right edge, matching BleachBit's own layout"
```

---

### Task 2: `receiptMode` -- filter the tree to selected items only

**Files:**
- Modify: `frontend/src/components/DeepCleanTree.jsx`
- Modify: `frontend/src/components/DeepCleanTree.render.test.jsx`

- [ ] **Step 1: Write the failing tests**

Add to `DeepCleanTree.render.test.jsx` (use the file's real render helper/fixtures -- this shows the SHAPE of what's needed, adapt names to what's actually there):

```js
describe('receiptMode', () => {
  it('shows only selected items within a category, forced expanded', () => {
    // Using this file's real fixture categories/items, pick one category
    // with at least 2 items, select only one of them.
    const selected = new Set(['<one real item id from the fixtures>']);
    renderTree({ receiptMode: true, selected }); // adapt to the real render helper's real signature

    expect(screen.getByText('<that item's real name>')).toBeInTheDocument();
    expect(screen.queryByText('<a sibling item in the same category, NOT selected>')).not.toBeInTheDocument();
  });

  it('omits a category entirely when nothing in it is selected', () => {
    const selected = new Set(); // nothing selected anywhere
    renderTree({ receiptMode: true, selected });

    // None of the fixture categories' names should render.
    // (adapt: assert on a specific known category heading text being absent)
  });

  it('shows a category forced-expanded in receiptMode even if the user had collapsed it', async () => {
    // Render normally first (receiptMode: false), collapse a category by
    // clicking its expand chevron, then re-render/re-trigger with
    // receiptMode: true and that category having a selected item --
    // its item(s) must still be visible, not hidden behind the collapsed state.
    // Adapt exactly to how this test file already drives expand/collapse
    // elsewhere (grep the file for an existing collapse test to copy its pattern).
  });

  it('is a no-op when receiptMode is false or omitted -- unchanged current behavior', () => {
    // Confirms the new prop doesn't change anything when absent, protecting
    // every EXISTING test in this file from a silent behavior change.
  });
});
```

Write the actual concrete assertions using this test file's REAL fixture data (categories/items/ids) rather than the placeholders shown -- read the file's existing fixtures first (there is already a `categories` array of `{category, items: [...]}` used across every existing test in this file; reuse it).

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/components/DeepCleanTree.render.test.jsx -t "receiptMode"
```

Expected: FAIL -- `receiptMode` prop doesn't exist yet, so nothing filters.

- [ ] **Step 3: Implement it**

In `DeepCleanTree.jsx`'s default export (`DeepCleanTree`), accept a new `receiptMode = false` prop. Before mapping `categories` to `CategorySection`s, when `receiptMode` is true, transform each category to keep only items where `selected.has(item.id)`, and drop any category left with zero items:

```js
const visibleGroups = receiptMode
  ? categories
      .map((group) => ({ ...group, items: group.items.filter((item) => selected.has(item.id)) }))
      .filter((group) => group.items.length > 0)
  : categories;
```

Pass `receiptMode` down to `CategorySection` as a new prop. Inside `CategorySection`, when `receiptMode` is true, force `expanded` to `true` regardless of the component's own `expanded` state (e.g. `const isExpanded = receiptMode || expanded;` and use `isExpanded` everywhere `expanded` currently gates rendering/the chevron's rotation) -- the user's own collapse/expand clicks during normal browsing must still work exactly as before when `receiptMode` is false, and must resume from wherever they left it once `receiptMode` goes back to false (so don't overwrite the underlying `expanded` STATE itself, only what's used to decide what renders while receiptMode is on).

Map `visibleGroups` (not the raw `categories` prop) in the default export's render.

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/components/DeepCleanTree.render.test.jsx
```

Expected: all pass, including every pre-existing test (confirming the no-op-when-false guarantee actually holds) and the new `receiptMode` tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DeepCleanTree.jsx frontend/src/components/DeepCleanTree.render.test.jsx
git commit -m "feat(deepCleanTree): add receiptMode, filtering the tree to only what's selected"
```

---

### Task 3: Animate the tree/log split on `cleaning`

**Files:**
- Modify: `frontend/src/components/DeepClean.jsx`
- Test: `frontend/src/components/DeepClean.render.test.jsx` (check the real filename -- if it doesn't exist yet, check whatever existing test file already renders `<DeepClean />` under a QueryClient/mocked-hooks setup, e.g. search for an existing DeepClean test file and use its exact setup pattern)

- [ ] **Step 1: Read the current layout code precisely**

Read `DeepClean.jsx`'s full current content around its tree/log grid (currently `<div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 min-h-0">`, tree column as its first child, `<ScanLog>` as its second/last child). Read `index.css` for the app's existing global `prefers-reduced-motion` rule (referenced in this project's own prior motion work) to confirm it will cover this new transition automatically without a separate opt-out.

- [ ] **Step 2: Write the failing test**

Add a test (in whichever file already renders `<DeepClean />` -- find it first) proving: when `cleaning` is true (mock `useDeepCleanExecute` to return `cleaning: true`, matching however other tests in this file already mock that hook), the tree column's rendered wrapper has an inline `width` style of `260px`; when `cleaning` is false, it does NOT have that value (either absent or the wide-state value). Use whatever DOM query already works in this file's existing tests to reach the tree's own wrapper element (e.g. a `data-testid` if the file's convention uses one, or the wrapper's own distinguishing class -- check first, add a `data-testid="deep-clean-tree-column"` to the wrapper div in Step 3 if nothing else reliably targets it, since testing an inline style needs a stable handle on the right element).

- [ ] **Step 3: Run it, confirm it fails**

```bash
npx vitest run <the real test file> -t "width"
```

Expected: FAIL -- the current grid has no such per-state width at all.

- [ ] **Step 4: Implement the layout change**

Replace the grid container:

```jsx
<div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 min-h-0">
```

with a flex row:

```jsx
<div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
```

Give the tree column wrapper (currently `<div className="flex flex-col min-h-0 pr-1">`) an inline width driven by `cleaning`, plus a smooth, ease-out transition and a stable test handle:

```jsx
<div
  data-testid="deep-clean-tree-column"
  className="flex flex-col min-h-0 pr-1 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:shrink-0"
  style={{ width: cleaning ? '260px' : 'calc(100% - 380px)' }}
>
```

The `lg:shrink-0` matters: without it, flexbox would let this explicitly-widthed column shrink below its set width to make room for `<ScanLog>`, undoing the very width you just set. Only apply the explicit width at the `lg` breakpoint and above (mirroring the grid's own prior `lg:` gate) -- on narrow layouts (`flex-col`, stacked), an explicit pixel width on a full-width stacked block does not make sense; use a conditional className (e.g. only apply the `style` when a `lg`-equivalent check is true, OR simpler: wrap the width in a `w-full lg:w-[...]`-style Tailwind arbitrary class keyed off `cleaning` instead of inline `style`, if that turns out cleaner given how the rest of this file already expresses responsive widths -- check the file's existing conventions and pick whichever reads more consistently, but the inline-style approach shown here is required at the `lg` breakpoint specifically for the transition to animate, since Tailwind's own arbitrary-value width classes swapping between renders would not transition smoothly the way a single element's inline style change does).

Give `<ScanLog>`'s own wrapper (or `<ScanLog>` itself, whichever currently receives layout classes) `flex-1 min-w-0` so it fills whatever space the tree column isn't using, in both states, with no explicit width or transition of its own needed -- confirm by reading `<ScanLog>`'s current className whether this is already implicit via `glass-panel flex flex-col min-h-0 overflow-hidden` (no width classes currently, meaning it's implicitly sized by the grid track today) and add `flex-1 min-w-0` if not already effectively equivalent once the grid becomes a flex row.

Pass `receiptMode={cleaning}` (from Task 2) to the existing `<DeepCleanTree>` call.

- [ ] **Step 5: Run it, confirm it passes**

```bash
npx vitest run <the real test file>
```

Expected: all pass, including the new width-per-state test and every pre-existing test in the file (confirming the layout change didn't silently break Preview/browsing behavior).

- [ ] **Step 6: Run the full frontend suite**

```bash
npx vitest run
```

Expected: all pass.

- [ ] **Step 7: Visual check via the dev server**

Start the frontend dev server, open Deep Clean, run Preview, select a few items across at least 2 categories, click Clean (or trigger whatever real/mocked path reaches `cleaning: true` in this environment), and screenshot: confirm the tree column visibly narrows while the log visibly widens, confirm the narrowed tree shows ONLY the items that were selected (receipt), confirm a category with nothing selected in it is entirely absent from the narrowed view, confirm the transition is smooth (not an instant snap) and reduced-motion (toggle it, or check the global rule) makes it instant instead. If a real Clean run isn't practical to trigger in this environment, describe honestly what you could and couldn't verify -- don't fabricate a screenshot check that didn't happen.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/DeepClean.jsx <the test file you modified>
git commit -m "feat(deepClean): animate the tree/log split when a clean runs, showing only what's selected"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: all green (backend modulo the 3 pre-existing elevation-gated failures needing an elevated shell -- known/accepted).

- [ ] **Step 2: Cross-check against both specs**

Confirm: `categorySelection.js`'s tri-state selection logic was NOT touched by either task, no checkbox click-handler behavior changed (only visual position and, for receiptMode, which rows render at all), Preview/scanning's own layout is unaffected (only `cleaning` drives the new width/receiptMode, not `scanning`).
