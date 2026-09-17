# Deep Clean Tree: Match BleachBit's Checkbox Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move each row's checkbox in `DeepCleanTree.jsx` from the row's first (left) position to its last (right) position, on both category-heading rows and item rows -- matching real BleachBit's own row layout (checkbox at the row's far right, name/disclosure at the left), grounded via a live screenshot of the installed app.

**Architecture:** Pure JSX reordering inside `DeepCleanTree.jsx`'s `CategorySection` -- no new components, no logic changes, no prop changes.

**Tech Stack:** React, Vitest + Testing Library (existing `DeepCleanTree.render.test.jsx`).

**Spec:** `docs/superpowers/specs/2026-09-17-deepclean-tree-checkbox-alignment-design.md`

---

### Task 1: Move the checkbox to the end of each row

**Files:**
- Modify: `frontend/src/components/DeepCleanTree.jsx`
- Modify: `frontend/src/components/DeepCleanTree.render.test.jsx`

- [ ] **Step 1: Read the current file in full**

Read `frontend/src/components/DeepCleanTree.jsx`'s full current content (already shown once this session, but re-confirm the exact current JSX before editing -- the category header row's markup around the `Checkbox`/expand-button pair, and the item row's markup around its `Checkbox`/label/badge/description/size).

- [ ] **Step 2: Write a new failing test proving the checkbox is now last in each row**

Add to `frontend/src/components/DeepCleanTree.render.test.jsx` (match the existing file's real render-helper name and fixture shape -- check what's already imported/used at the top of the file, e.g. however categories/selected/onToggle are set up in existing tests, and reuse that same setup rather than inventing a new one):

```js
describe('checkbox alignment', () => {
  it('places the category heading checkbox after its label, not before it', () => {
    renderTree(); // use this file's real existing render helper + fixture data
    const row = headingBox('Brave').closest('div'); // adjust to whatever the real heading row's container actually is
    const children = Array.from(row.querySelectorAll('button'));
    const checkboxIndex = children.indexOf(headingBox('Brave'));
    // The checkbox must be the LAST button in its row, not the first.
    expect(checkboxIndex).toBe(children.length - 1);
  });

  it('places an item row checkbox after its label and size, not before them', () => {
    renderTree();
    const checkbox = screen.getByRole('checkbox', { name: 'Cookies' });
    const row = checkbox.closest('div');
    const children = Array.from(row.children);
    const checkboxIndex = children.indexOf(checkbox);
    expect(checkboxIndex).toBe(children.length - 1);
  });
});
```

Adapt the exact selectors/helpers to what the real test file already has (its own `renderTree`-equivalent function name, its own fixture category/item names -- `Brave`/`Cookies` are guesses based on the design spec's own examples; use whatever fixture data the file actually defines). If the real file's row structure means `.closest('div')` grabs the wrong ancestor (e.g. there's a nested wrapper), adjust to find the actual immediate row container -- inspect the real rendered DOM if unsure, don't guess blindly.

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd frontend && npx vitest run src/components/DeepCleanTree.render.test.jsx -t "checkbox alignment"
```

Expected: `FAIL` -- checkbox is currently first, not last, in both rows.

- [ ] **Step 4: Move the checkbox in the category heading row**

In `DeepCleanTree.jsx`'s `CategorySection`, the heading row currently renders (in order): `<Checkbox .../>`, then the expand `<button>` containing chevron+icon+label+count. Change the order so the expand button comes first and `<Checkbox>` comes last, and add `ml-auto` (or equivalent -- match whatever spacing utility class this codebase already uses for "push to the end of a flex row," check an existing example like a settings row) to the `Checkbox`'s wrapper if needed to pin it to the right edge given the expand button no longer has `flex-1` pulling it -- confirm the expand button still keeps `flex-1 min-w-0` so its own label still truncates correctly and the checkbox doesn't get pushed off-screen by a long category name.

- [ ] **Step 5: Move the checkbox in the item row**

In the same file's item-row JSX, currently renders (in order): `<Checkbox>`, name `<span>`, risky badge, description/flex-spacer, `<SizeLabel>`. Change the order so `<Checkbox>` moves to be the LAST element in this row (after `<SizeLabel item={item} />`), with everything else shifting up to fill the now-vacated first position. The name `<span>` becomes the row's first element.

- [ ] **Step 6: Run it, confirm it passes**

```bash
npx vitest run src/components/DeepCleanTree.render.test.jsx
```

Expected: all pass, including the 2 new checkbox-alignment tests.

- [ ] **Step 7: Run the full frontend suite**

```bash
npx vitest run
```

Expected: all pass -- no other test in the suite should reference checkbox DOM position (only `getByRole`/`getByLabelText`-style queries, which are order-independent), but confirm this is actually true rather than assuming it.

- [ ] **Step 8: Visual check via the dev server**

Start the frontend dev server (or the packaged app), open Deep Clean, run a Preview, and take a screenshot confirming: category headings show their checkbox at the right edge, item rows show their checkbox at the right edge, long category/rule names still truncate correctly rather than pushing the checkbox off-screen, and the tri-state category checkbox and risky-rule badges still render correctly in their new position. Compare side-by-side against the real BleachBit screenshot's row shape (chevron+label at left, checkbox at right) to confirm this genuinely now matches.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/DeepCleanTree.jsx frontend/src/components/DeepCleanTree.render.test.jsx
git commit -m "feat(deepCleanTree): move each row's checkbox to the right edge, matching BleachBit's own layout"
```

---

### Task 2: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: all green (backend modulo the 3 pre-existing elevation-gated failures).

- [ ] **Step 2: Cross-check against the spec**

Confirm: `DeepClean.jsx`'s panel-width split was NOT touched (git diff should show zero changes to that file), the tri-state category selection logic (`categorySelection.js`) was NOT touched, only `DeepCleanTree.jsx` and its render test changed.
