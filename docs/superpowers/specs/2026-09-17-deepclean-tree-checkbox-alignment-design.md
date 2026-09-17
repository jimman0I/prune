# Deep Clean Tree: Match BleachBit's Checkbox Alignment

## Context

Per the 2.6.0 backlog's item 3 ("I want the input and the output of BleachBit"), the output side (live per-action log, active-row highlight, Stop/Cancel) was matched already. The input side -- `DeepCleanTree.jsx`'s own selection tree -- was previously rebuilt for BleachBit's *density* (one scroll region, tri-state checkboxes, one line per rule instead of cards) but not checked against BleachBit's actual row layout since. Asked the user directly which remaining gap to close; they chose matching BleachBit's checkbox-tree layout specifically (not the panel-width split in `DeepClean.jsx`, which stays as-is -- Prune's rows carry a size and description BleachBit's never do, and need the room).

Grounded against the real, installed BleachBit app (screenshotted live, not from memory or a mockup): every row -- both an application heading (`Brave`, `Claude`, ...) and each rule under it (`Cache`, `Cookies`, ...) -- puts its checkbox in a single aligned column at the row's **far right edge**. The disclosure triangle and the label sit at the left, at every indentation level. Prune's current rows do the opposite: `Checkbox` renders **first**, before the chevron/icon/label, on both the category heading row and each item row.

## What's changing

`DeepCleanTree.jsx`'s `CategorySection` component: move the `Checkbox` to the end of each row (category heading row and item row alike), pushed to the row's right edge, instead of its current position as the row's first child.

**Category heading row** (currently: checkbox, chevron+icon+label+count as one button): the checkbox stays a sibling of the expand button, not inside it (unchanged -- the checkbox and the expand/collapse toggle are two different actions and must stay two different click targets). Only its position in the row moves from first to last.

**Item row** (currently: checkbox, label, risky badge, description, size): checkbox moves to last, after the size label. The label stays first (left-aligned), matching BleachBit's own left-to-right reading order (name first, then whatever else, checkbox at the very end).

**What's NOT changing:**
- No change to `DeepClean.jsx`'s panel-width split (tree gets `minmax(0,1fr)`, log stays a fixed `360px`) -- that's a different question (how much of the SCREEN the tree gets) from the one asked (how the tree's OWN rows are laid out), and Prune's rows need the extra width BleachBit's bare ones don't.
- No change to the tri-state category checkbox's own selection logic (`categorySelectionState`/`nextCategoryChecked`), the risky-rule badge, the size label, the description reveal timing, or the active-row highlight -- purely a visual repositioning of one existing element per row.
- No change to `Checkbox`'s own component (size, colors, tick/dash rendering) -- only where it's placed in its parent's flex layout.
- Existing tests query by `getByRole('checkbox', {name})`, which is DOM-order-independent -- no test should need behavioral changes, only (if any) a snapshot/order-sensitive assertion would need updating, and a grep of the test file found none.

## Testing

Real render tests (`DeepCleanTree.render.test.jsx`, already exists) confirming: the checkbox is still reachable and clickable at its new position for both a category heading and an item row, and (new) a DOM-order assertion proving the checkbox is now the LAST interactive element in its row rather than the first -- this is the one thing worth a new regression test, since it's the entire point of the change and nothing currently pins it down.
