# Apple design pass: whole-UI findings and the decisions taken

Source: four read-only reviews of every screen, run with the `apple-design` skill
(`C:\Users\jimmanol\.claude\skills\apple-design\`) against 56 real screenshots (dark and light,
1280 and 900 wide, plus modals, scan states, keyboard focus and forced-colors) and the real code,
plus in-page measurements. Motion was reviewed and fixed separately
(`2026-09-24-motion-restraint-design.md`); this pass is everything else.

Apple's guidance is applied as principles. This is a Windows/Electron app, so where Windows
differs (sentence case, settings inside the app, no menu bar) the Windows convention wins.

## Decisions (made by the user)

1. **Nav rail:** icons only below 1100 px window width; from 1100 px up the rail widens to about
   200 px with text labels. New distinct gauge icon for Dashboard. Settings moves to the rail's
   footer beside the update button. Add Ctrl+1 to Ctrl+8 to jump between screens and show the key in
   each tooltip; delete the "Cmd works in place of Ctrl" line (Windows has no Cmd).
2. **Capitalization:** sentence case everywhere in English UI strings ("Minimize to tray",
   "Delete permanently", "Recent activity"). Keep proper names capitalized: Prune, Quarantine,
   Deep Clean, Disk Map, Windows, Defender, WinRAR, Recycle Bin. English strings only; other
   languages keep their own conventions.
3. **Naming:** page heading equals rail label. "Disk Usage" becomes "Disk Map", "Runs at sign-in"
   becomes "Startup", "Installed applications" becomes "Applications". The descriptive part moves
   into the subtitle line so no information is lost.
4. **Auto-remove leftovers:** the "automatically remove everything found" checkbox is offered only
   when the leftover destination is Quarantine. Hidden for Recycle Bin and permanent delete.
5. **Size color (Applications):** sizes use a neutral-to-amber ramp and never `--danger` red.
   Red keeps meaning broken or destructive.
6. **Theme control:** replace the single flip button with a System / Light / Dark choice in
   Settings > General. "System" follows Windows again.
7. **Restore points:** move the "before a forced removal" switch from Cleanup to Settings >
   Uninstall next to "before uninstalling". Behaviour and stored setting keys unchanged.
8. **Dashboard:** keep only the Deep Clean action button in the row; drop Disk Map and
   Applications (the rail has them).

Not doing, on purpose: a drive picker for Disk Map (new feature), a Startup impact column (would
need data Prune does not have and must not fake), a "Browse..." button for Duplicates (new IPC).
Listed so nobody re-raises them as bugs.

## Guardrails for every workstream

- Keep Prune's character: dark aurora-glass surfaces, serif page titles, mono numbers, honest
  wording ("up to N s left", "stopped early", "needs admin", "not measured"). Never invent a number.
- Do not undo the reduced-motion layers, the honest-progress rules, or the Stop button.
- Every new user-visible string gets all 40 languages in `frontend/src/i18n/catalog.js` in the same
  commit plus a Greek test where the screen already has one. Casing/naming changes are English only.
- Existing tests that assert old English text or old classes are updated, not deleted.
- TDD with real assertions; prove the important ones load-bearing by revert-and-confirm-fails.
- `frontend/src/index.css` and `catalog.js` are shared by every workstream: edit them with one quick
  read-modify-write and commit just that file straight away. Stage only your own files by name; never
  `git add -A`, `stash`, `checkout --` or `reset`. Do not push, tag, bump versions or publish.
- Windows shell: heredocs halve backslashes; write files containing them with Write/Edit.
- Tokens introduced by workstream 1 (`--control-border`, forced-colors and reduced-transparency
  blocks, scrollbar corner) are used by the others; do not redefine them.

## Workstream 1: foundations (runs first, alone)

- `index.css`: add `--control-border` (dark `rgba(255,255,255,0.36)` about 3.3:1, light
  `rgba(28,25,23,0.5)` about 3.35:1). Use it for the unticked checkbox border in
  `DeepCleanTree.jsx` (about line 53) and `StartupItems.jsx` (about line 58), and the off-state ring
  of `Toggle.jsx`.
- `index.css`: `@media (forced-colors: active)` block: Toggle track gets `border:1px solid
  ButtonText`, checked track `background:Highlight; forced-color-adjust:none`, thumb `ButtonText`,
  the rail's active item `outline:2px solid Highlight`, the storage bar track and fill
  `forced-color-adjust:none` with `Highlight` for the fill, selected Settings tab and selected filter
  chips get a visible outline. Verify each in `state-dark-1280-ForcedColors*.png` terms.
- `index.css`: `@media (prefers-reduced-transparency: reduce)`: `.glass-panel`, `.diskmap-tooltip`
  lose `backdrop-filter` and use `var(--bg-panel)`; `body::before/::after` hidden.
- `index.css`: `::-webkit-scrollbar-corner{background:transparent}` and a token for the thumb hover
  colour (currently hard-coded `#3f3f46`); remove the dead `#e8624f` usages or replace with tokens.
- Delete `focus:outline-none` from the Settings inputs/selects (`SettingsPage.jsx` about lines 254,
  395, 458, 483, 506; `AutomationSettings.jsx` about 31; `CookieKeepListSettings.jsx` about 92) so
  the global `:focus-visible` ring shows.
- `AutomationSettings.jsx` about line 58: give the Toggle `label={t('settings.automation.title')}`
  (it currently has no accessible name). Add a test.
- Electron zoom: `win.removeMenu()` (`electron/main.cjs` about 235) also removed the built-in text
  zoom keys, so the 9 px text cannot be enlarged. Restore Ctrl+`=`/`+`, Ctrl+`-`, Ctrl+`0` and
  Ctrl+wheel through `webContents.on('before-input-event')` / `zoom-changed` calling `setZoomLevel`,
  clamped to a sane range. Put the pure key-to-delta decision in its own small `.cjs` module with
  `node --test` tests (main.cjs itself has no tests). Persist the level with the window state if it
  is clean, otherwise say why not. List the keys in `SHORTCUTS` (`hooks/useKeyboardShortcuts.js`).
- Toasts (`ToastHost.jsx`, `useToasts.jsx`, `toastQueue.js`): warnings do not auto-dismiss
  (`ttl: 0`); expiry pauses while a toast is hovered or focused; danger toasts use `role="alert"`.
- Casing and naming pass over the English (`en`) catalog strings only, per decisions 2 and 3.
  Update every English render test that asserted the old text.

## Workstream 2: Dashboard and shell

Files: `NavRail.jsx`, `Dashboard.jsx`, `ResourceMonitor.jsx`, `App.jsx`, `TitleBar.jsx`,
`useKeyboardShortcuts.js`.

- Nav rail per decision 1, including a cross-file alignment test between TitleBar and NavRail that
  reads their width numbers (it will need updating for the wide rail). Add the 3 px active pill.
  Keep the `layoutId` indicator, `aria-current`, focus-visible names.
- Gauge track strokes: `Dashboard.jsx` about 80 and `ResourceMonitor.jsx` about 47 use hard-coded
  white alpha, invisible in light mode. Use `var(--surface-strong)`.
- 900 px layout: `Dashboard.jsx` about 297 replace the fixed 268 px monitor beside the health panel
  with a grid that stacks below 1100 px; `ResourceMonitor.jsx` drop `w-[268px]`. SMART labels must not
  truncate at 900.
- Health ring: colour from the score's own band (75 and up good, 50 and up caution, below that
  problem), show "/100", reword the breakdown line so "Errors 100" cannot read as a count.
- Colour discipline: storage bar and Disk gauge stop using `--accent-primary` (reserved for actions);
  use `--text-secondary`, switching to `--warning` only when free space is under 10% or a gauge is at
  85% or more.
- Storage card: free space becomes the headline, used/total secondary.
- "Recent activity" header: 28 px minimum height, `aria-expanded`, a rotating chevron instead of
  the Hide/Show word.
- Dashboard `h1` 30 px like every other screen; introduce one shared `Page` wrapper for gutters and
  max width where screens currently differ (1400, 1600, none).
- Action row per decision 8. Remove the "which is the point of having them here" clause
  (`catalog.js` about 716).
- Ctrl+1 to Ctrl+8 shortcuts wired in `useKeyboardShortcuts.js`, shown in tooltips and the
  shortcuts modal.

## Workstream 3: Applications, uninstall flow, Quarantine

Files: `ProgramList.jsx`, `UninstallModal.jsx`, `BatchUninstallModal.jsx`, `LeftoverReview.jsx`,
`StoreRemoveDialog.jsx`, `ModalOverlay.jsx`, `QuarantineManager.jsx`, `App.jsx` (the modal wiring only).

Correctness first (these are the most consequential):
- Escape closes an uninstall dialog while it is still running (`App.jsx` about 155 to 188 never pass
  `dismissible`). Lift busy state through an `onBusyChange` callback and pass `dismissible={!busy}` to
  all three overlays; disable the single-program Close button in `UninstallModal.jsx` while
  uninstalling/scanning/removing. Each overlay's close also refreshes programs and invalidates the
  quarantine query, so the uninstalled program leaves the list.
- Single-program leftover review can push "Remove selected"/"Skip" off-screen at 900x600: cap the
  dialog height, make the body scroll, and make the action bar sticky in `LeftoverReview.jsx`.
- Auto-remove checkbox per decision 4.
- Progress bar: `UninstallModal.jsx` about 361, 379, 386 pass invented `progress={45|85|95}`. Replace
  with an indeterminate bar (or none). Replace the hard-coded `#e8624f` with a token.
- Batch cannot be stopped once started: add "Stop after this one" (new string, 40 languages); the
  loop breaks and remaining programs are marked skipped.
- Delete confirmations: 500 ms arm delay on the confirm buttons in `QuarantineManager.jsx` so a
  double-click cannot confirm a permanent delete; specific button text ("Delete batch", "Delete all N").
- Batch outcome tone from counts (all/some/none succeeded); Cancel button beside "Start
  uninstalling"; restore success feedback line in Quarantine.

Accessibility and layout:
- 9 px text to 10 px in all listed places in `ProgramList.jsx`.
- 24 px hit area for row checkboxes without changing the look; 32 px tall sortable headers; padded
  "Clear".
- Table semantics: `role="table"/"row"/"columnheader"/"cell"`, `aria-sort`, `aria-pressed` on filter
  chips.
- 900 px: the Uninstall action column is off-screen and hover-only. Make it sticky at the right with
  the panel background; hide Version and Website below about 1100 px; add a row context menu
  (Uninstall, Open folder, Copy uninstall command).
- Quarantine: show 5 files per batch with "Show all N files".
- Size colour ramp per decision 5.
- Copy fixes: "Review before purging" becomes "Review before removing"; single-program batch uses the
  single intro; "Start uninstall"/"Start uninstalling" unified; "removed" becomes "uninstalled";
  "click Scan" matches the "Scan for leftovers" button.

## Workstream 4: Deep Clean and Settings

Files: `DeepClean.jsx`, `DeepCleanTree.jsx`, `CleanWarningDialog.jsx`, `SettingsPage.jsx`,
`AutomationSettings.jsx`, `CookieKeepListSettings.jsx`, `ThemeToggle.jsx`, `Toggle.jsx`.

- Whole tree row is the click target (the box is 14x14; header box 16x16): make the row clickable,
  keep the look, give the header box a 28x28 hit area with an inner visual box, stop propagation on
  the checkbox, and keep focus return to the row's checkbox so the risk dialog's focus-return works.
- Risk badge "Loses data" 8.5 px to 10 px (also the 9 px badges in `SettingsPage.jsx` and
  `CookieKeepListSettings.jsx`).
- Not-installed rows: drop `opacity-45` (fails contrast, and the checkbox is live); use the muted text
  token. "needs admin" stops using the warning amber that means "loses data"; use secondary text with
  a small lock glyph.
- Settings sub-tabs: `role="tablist"`/`role="tab"`/`aria-selected` with arrow-key roving.
- Scan log vanishes at 900 px (only side by side at 1024): give it a fixed short height when stacked.
- Confirm button becomes "Move to Quarantine" (40 languages); the confirm prompt stops being red.
- Tree scannability: header shows selected/total and measured size; remember expanded categories;
  add a filter field above the tree.
- Settings layout consistency: descriptions get `max-w-[62ch]`, Automation's switch moves to the
  right-hand slot like every other row, Cleanup regroups into panels the way Uninstall already is,
  section headings match the SCAN OUTPUT label style.
- Theme control per decision 6; restore-point switch per decision 7.
- Copy: empty log line says what to do next; Appearance description trimmed to one actionable
  sentence; "undo" wording for Quarantine becomes "Quarantine".
- Small targets: exclusion remove button, "Select everything"/"Clear" get 24 px hit areas.

## Workstream 5: Disk Map, Duplicates, Startup

Files: `DiskMap.jsx`, `DiskScanProgress.jsx`, `fileTypeColors.js`, `unscannedRemainder.js`,
`Duplicates.jsx`, `StartupItems.jsx`, and `backend/src/services/diskScan.js` / `routes/diskScan.js`
for the `stoppedByUser` flag.

- Folder table rows are keyboard buttons (`role="button"`, `tabIndex`, Enter/Space, an `aria-label`
  with name and size); rows past the treemap's 120-cell cutoff must be reachable.
- Treemap label contrast: dark ink `#09090b` on the 16 type colours (4.9 to 9.7:1), full white only on
  the three neutrals; choose by fill luminance in `fileTypeColors.js`.
- Startup: Status column disappears below about 1014 px (grid needs 806, pane is about 692). Use
  `minmax(0,...)` columns and hide Description below 1100 px so Status and the "Invalid" pill stay.
  Disabled rows: drop `opacity-55` (fails contrast), show "Off" in Status. 9 px pills to 10.5 px and
  tile letter to 11 px. Switch accessible name fixed ("Run X at sign-in") with checkbox semantics.
- Disk Map: `C:` breadcrumb 24 px hit area and `aria-current`; two-column layout at `xl` not `lg`
  (table clipped between 1024 and 1207); context menu and a "..." action on folder-table and
  Largest-files rows; table semantics and `aria-sort`; `role="status"` on scan completion.
- After Stop the screen says "ran out of time" twice and hard-codes English (`UNSCANNED_LABEL`): send
  `stoppedByUser` in the completion event, merge the coverage sentence into the complete/stopped card,
  drop the duplicate banner, translate the string.
- Duplicates: the confirm dialog says "recovered" but Quarantine keeps the copy on the same drive, so
  say "freed when you empty Quarantine"; file name on line one with the folder middle-truncated below,
  "Keep"/"To quarantine" tags, show time as well as date; scan shows an elapsed timer and Stop returns
  a "stopped, nothing compared" note; better placeholder text; singular "1 copy".
- Sizes use text colour, not the cyan that also marks buttons and ticked boxes.
- Polish: "Stopping..." label after Stop is pressed, `h3` to `h2` on the idle card, treemap cell
  `:focus-visible` stroke, investigate the 25,677 vs 25,667 file count mismatch.
