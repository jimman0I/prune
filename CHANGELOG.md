# Changelog

All notable changes to Prune (formerly named unrevo -- rebranded 2026-09-01,
see v1.0.1 below) are documented here.

## v3.0.0

### Added

**Disk Map, like WizTree**

- Choose any local drive; several NTFS drives are scanned under one
  administrator prompt. The fast scan needs no prompt when Prune already
  runs as administrator, and offers a one-click "Restart Prune as
  administrator".
- Tree view shows size on disk (Allocated) beside size; hard-linked files
  are counted once; the scan reports totals so they can be checked against
  the drive. Modified dates come from the MFT and are sortable.
- Excluded folders and file types are honoured by the fast scan too.
- Search by text, `*`/`?` wildcard or `/regex/` over the Tree and File
  views, with matches marked on the map. Export the view as CSV and the map
  as PNG.
- Tree rows and map blocks highlight each other; right-click gains
  Properties and Exclude this folder.
- Save, reopen, delete and compare Disk Map scans.
- The folder walk now runs to completion, shows results as it goes and has
  no time limit.

**Deep Clean, like BleachBit**

- "Overwrite files before deleting" (1 or 3 passes, off by default) for
  Delete now and an uninstall's permanent delete; a **Shred files…** tool
  for files and folders, with confirmation and protected-path guards.
  Overwriting is not reliable on SSDs, and the setting says so.
- Free-space wipe: any local drive, 1 zero pass or 3 random passes.
- Locked files can be deleted at the next restart.
- A `prune-cli` command line (`list`, `preview`, `clean`, `--json`),
  shipped as `prune-cli.cmd` next to Prune.exe.
- Preview lists each rule's biggest files, and the Delete-now confirmation
  names the biggest items.
- **Custom locations**: add your own paths to Deep Clean. **Import a
  BleachBit cleaner (.xml)**; the import reports exactly what it skipped.

**Uninstaller, like Revo**

- A Safe / Moderate / Advanced leftover scan in the uninstall dialog,
  remembered between uninstalls. Leftovers are tiered certain / likely /
  possible; Windows, Microsoft components and other installed programs'
  folders are never offered.
- Scheduled-task leftovers can be removed, with their XML saved first.
- **Forced uninstall** for software that isn't listed.
- **Install with monitoring…** records an install so uninstalling it later
  is exact. **Hunter** identifies a program: drag its small crosshair onto
  any window, as in Revo, and let go.
- Quarantine gains **Backups** (restore registry and task backups) and
  **History** tabs. Browser extensions have a **Copy page address**
  button, since Prune cannot remove them itself: paste the address into
  that browser and remove the extension there. (Prune deliberately never
  starts a browser; launching one with profile arguments made Microsoft
  Defender flag it as `Behavior:Win32/WebBrowserCredAccess.E2`, and a test
  now guards against it.)
- Fixed: program names with an apostrophe broke the leftover scan.

**Cleaner rules**

- **BleachBit parity: 16 new cleaner rules, grounded in a live scan.**
  Rather than trust BleachBit's CleanerML XML at face value, every new
  rule here was checked against a real `bleachbit_console.exe -p` run
  (265/265 cleaner options, each invoked as its own process so deletes
  could be attributed precisely) before being written. Covers
  Brave/Chrome/Edge sync data, Chrome's on-device AI models, Discord
  cookies/history, VS Code local file history, Vim history, Office
  recent-docs, legacy Internet Explorer cookies/history/logs, and four
  Explorer registry traces (typed paths/dialog MRU, Run history,
  shellbags, recent documents). Deliberately skipped: anything already
  covered by an existing rule, anything needing a directory-whole-match
  capability Prune doesn't have yet, and every `claude.*` option, since
  that's real conversation history, not a general-purpose cache.
- **"Clean as administrator" for rules that need it.** A locked file no
  longer forces a full admin relaunch of the app. Deep Clean now shows a
  targeted elevation button only for the specific rules that hit a
  permissions wall, running just those through a one-shot elevated
  helper process instead.

### Changed

- **Hunter is a draggable crosshair, and no longer watches the keyboard.**
  It used to run a 30-second PowerShell script that polled the key and
  pointer state under a click-catching overlay, which is exactly what
  antivirus reads as a keylogger. Now Prune minimizes and opens a small
  always-on-top crosshair; you drag it onto any window and let go. Prune
  reads the pointer once, at the drop, hides the crosshair, and asks
  Windows which window is at that one point. Dropping on the desktop or
  taskbar, on a window of an administrator program Prune cannot read,
  or on Prune itself each get an explanation; Esc or the crosshair's cross
  cancels. A test now fails if the key- or pointer-polling calls come back.
- **Opt-in "Always run as administrator"** (Settings, General, off by
  default). It sets Windows' own per-program "Run this program as
  administrator" flag for this copy of Prune, so the fast Disk Map scan,
  machine-wide leftovers and scheduled tasks need no extra prompts. The
  help text lists what it costs: a UAC prompt on every start, no
  drag-and-drop from a normal Explorer window, no silent start at sign-in,
  and full rights for every action. It takes effect from the next start
  (with a button to restart now) and warns if Prune also starts with
  Windows. Turning it off removes only that flag and leaves any other
  compatibility flags alone.
- **The sidebar is icons only until you point at it.** It rests at 72px
  and widens over the page, with a short transition, when the pointer
  enters it or keyboard focus lands in it, then folds back. It widens
  over the content rather than pushing it, so no screen re-lays-out as
  you pass the mouse across. Icons never move while it opens. This
  replaces the old behaviour where the labelled sidebar appeared only
  in windows 1100px or wider.
- **Deep Clean scans automatically instead of waiting for Preview.**
  Opening the screen now starts the scan immediately; Preview still
  exists for re-scanning after changing settings, but the
  scan-then-clean two-step for a first look is gone. (Once a scan has been
  remembered, opening the screen no longer starts one; see below.)
- **Deep Clean scans once, remembers it, and then just cleans, like
  BleachBit.** The last complete scan is kept across restarts, so the
  screen opens already measured, with "Last measured 3 hours ago" beside
  Rescan, and Clean works straight from it with no scan first. The
  confirmation says the sizes are from the last scan; Clean still measures
  each rule again as it runs and reports what actually happened. Only the
  sizes are kept (not file lists or paths), and a remembered scan is
  ignored and a new one made when your exclusions, the recent-files window,
  custom locations, imported cleaners, the rule list or the app version
  have changed since. Rescan always measures again and refreshes it. A
  rule's biggest-files list needs a fresh scan, and says so.
- **Deep Clean no longer rescans after every clean.** The rows are brought
  up to date from what the clean reported: a rule that was emptied reads
  0 B, one with locked files keeps what is left, and a rule where what
  remains cannot be worked out (a browser database edited in place, a
  profile search that stopped short) reads "Cleaned — rescan to measure"
  instead of a guess. The same goes for "Clean as administrator". The
  default rules are also no longer ticked again on the rows you just
  cleaned.

### Fixed

- **Disk Map's fast scan works on drives with millions of files.** The scan
  result was one JSON string, and with the added size-on-disk and modified
  fields a large drive passed V8's ~512 MB string limit ("Invalid string
  length"). Every folder is still listed, but each keeps only its 200
  largest files; the rest appear as one "N smaller items" row with exact
  totals, and file-type totals stay exact for the whole drive. On very
  large drives, search finds only files that are not folded. A drive too
  large even so says so plainly instead of showing a raw error.
- "Restart Prune as administrator" is offered only once Prune has confirmed
  it is not already elevated.
- **Prune no longer sometimes opens in English.** Two causes. The screen
  painted English until the settings request came back and stayed English
  if that request failed (the backend still starting); the last language
  is now remembered locally, as the theme is, and used until settings
  answer. And settings were saved by writing the file in place with no
  queue, so a read landing mid-save saw a half-written file, fell back to
  English defaults, and the next save could write those defaults over your
  real choices; saves are now queued and written atomically, which also
  stops two overlapping saves from losing one of the changes.
- **Minimize, maximize and close stay aligned with the title bar when you
  zoom** (Ctrl+minus, Ctrl+plus, Ctrl+scroll). Windows draws those buttons
  at a fixed height that knew nothing about the app's own zoom, so any
  zoom other than 100% left them off-centre against the bar.
- **The 16 new cleaner rules now have names and descriptions in all 39
  languages** instead of showing English.
- **Deep Clean's Recent Items rule no longer deletes Quick Access pins.**
  The rule was a bare folder-exists delete that happened to sweep up the
  same jump-list file File Explorer uses to remember pinned Quick Access
  folders. The shared delete path now supports excluding specific
  filenames by name, and Recent Items uses it.
- **Stopping Deep Clean mid-run no longer wipes the saved selection.**
  Stop now leaves whatever was checked intact and reports "stopped"
  rather than quietly resetting the screen to its defaults.
- **The nav rail's active-page mark no longer drifts from its icon at
  fractional display scaling** (confirmed at 150%). The mark was a
  Framer Motion shared-layout animation computing its own position from
  measured pixels, which could desync from its statically-laid-out
  sibling under a non-integer DPR; replaced with a plain opacity toggle
  that can't drift.
- **The "scan to see results" hint no longer points at a screen reader
  element that's already gone** once the automatic scan has finished.
- **Deep Clean no longer tells an administrator to run as administrator.**
  Folders Windows refuses to list even when elevated (Defender's, owned by
  SYSTEM and protected by tamper protection) kept showing "needs
  administrator access" and a "Clean as administrator" button. When Prune is
  already elevated they now read "protected by Windows", with no button.

## v2.9.2

### Added

- **Report a bug now includes the installed-programs count.** Within about
  a second of launch, the report lists a 4th fact, "Installed programs
  found: N" -- never a fresh read of its own, so the dialog stays instant.
  Translated into all 39 languages, with the "nothing else is collected"
  line reworded to stay accurate.
- **Low power mode (Settings -> General).** Pauses the background
  animation, flattens the glass panels to solid ones, and shortens
  transitions to near-instant -- the same treatment `prefers-reduced-
  transparency`/`prefers-reduced-motion` already get, reused rather than
  reinvented. Turned on automatically, once, the first time Prune is
  installed on a PC with under 8 GiB of RAM, under 4 logical cores, or a
  GPU Chromium itself falls back to software compositing on -- generous
  thresholds on purpose. A real choice made afterwards, in Settings or by
  a file that already recorded one, is never silently overridden later.
  Translated into all 39 languages.

### Changed

- **Five Applications-only reads no longer run on every screen.** Icon
  extraction (around 90 executables), binary versions, install dates,
  browser extensions and the running-process poll used to fire the moment
  the app opened, including a session that never visits Applications at
  all -- the running-process poll was the worst of these, repeating every
  15 seconds for as long as the app stayed open. All five now wait until
  Applications has actually been opened once. Dashboard's own space
  breakdown and largest-programs list still load immediately, since
  nothing about them changed.
- **Six screens and the Applications list no longer load until opened
  either.** Icon extraction aside, Deep Clean, Disk Map, Settings,
  Startup, Duplicates, Quarantine and Applications together were over
  5,000 lines of JavaScript bundled into the one file every launch had to
  parse before Dashboard could show anything, whether or not that
  session ever opened them. Deep Clean's own 754 KB and Disk Map's 294 KB
  alone cut about 1.1 MB off the initial bundle. Dashboard itself is
  unaffected -- it's the one screen every launch shows regardless.

### Fixed

- Cleared 6 Dependabot alerts, all a nested `undici` only ever reachable
  while installing build tooling (downloading Electron's binary,
  compiling native modules), never shipped in the built app.
- **The installer's "who should this be installed for?" page was stuck in
  English for 19 of Prune's 40 languages**, even though the person had
  just picked their own language on the screen before it -- electron-
  builder ships its own translations for this page, but only for about
  20 languages. Patched the missing 19 by hand, matching how Windows'
  own installers and UAC prompts phrase "all users / just me / admin
  credentials" in each.

## v2.9.1

### Fixed

- **Applications no longer trusts an empty program list at face value.**
  Reported live: a fresh Windows 10 install showed Applications as
  completely empty. A real Windows machine always has dozens of Uninstall
  registry entries, so an empty result from the primary read is now
  retried once, then handed to a fallback that reads the same three
  registry hives through `reg.exe`'s own text output instead of
  PowerShell's `Get-ItemProperty` -- a different code path for a different
  failure mode. If it still comes back empty, Applications says so
  plainly with a Retry button, instead of "Nothing matches", which used
  to blame a filter that was never set. Translated into all 39 languages.
- **Removed competitor names from user-visible text.** The Delete now
  label and Deep Clean's delete-mode subtitle named BleachBit in every
  language, and the README named BleachBit, WizTree and Revo. Reworded
  without naming any of them, keeping the same facts.

## v2.9.0

A design pass over the whole app. The Dashboard now answers one question,
the dangerous choice is never the easy one (a safer right-click menu, Clean
that waits for a Preview, leftovers left unticked), colour is kept for what
you click, and everything is reachable and readable from the keyboard.
Deep Clean now works like BleachBit too: an opt-in Delete now mode that frees
space straight away, Deep scan rules, and a free-space wipe.

### Added

- **A Delete now mode for Deep Clean, like BleachBit.** Settings › Cleanup has a
  new choice, When Deep Clean removes files: Move to Quarantine (the default, and
  what Prune has always done) or Delete now, which removes files outright so the
  space is free straight away. The choice is read from your settings by the
  backend, never from a request. Exclusions, the recent-files guard and locked
  files still apply, rules that lose data still ask first, and scheduled cleans
  always go to Quarantine. Deep Clean says which mode is on beside Clean, and the
  confirm reads Delete 37 items (15.7 GB)? This can't be undone. with a red
  Delete button. Auto-Quarantine is switched off, with the reason beside it, while
  Delete now is chosen.
- **A Deep scan category, mirroring BleachBit's.** Backup files, Office temporary
  files, Vim swap files, .DS_Store files and Thumbs.db files, found anywhere
  under your user folder with BleachBit's own patterns. The search is bounded
  (entry, depth, match and time limits), never follows a junction out of your
  profile or enters Prune's own folders, streams what it is doing while it runs,
  and stops when you press Stop. A search that hit a limit is labelled partial
  instead of being shown as a total. Backup, Office temp and Vim swap files are
  marked as losing data and none of these is ticked by default.
- **Free disk space, BleachBit's system.empty_space.** Overwrites the drive's
  free space with zeros and deletes the filler so earlier deletions cannot be
  recovered. It is never recommended, never reached by Select everything, never
  remembered from a previous session, and asks every time with the drive, how much
  will be written and a time estimate from a one-second write test. It always
  leaves the larger of 2 GB and 2% of the drive free, stops at once on Stop,
  deletes its filler even after an error, and removes anything a crashed run left
  behind on the next start. It frees no space, does nothing useful on an SSD with
  TRIM and adds write wear, which is why it is off by default.

### Changed

- **The Dashboard now answers one question: where is my space going?** One bar
  splits the drive into installed programs, everything else and free, with every
  figure repeated as text, and the five largest programs sit under it, each a
  link into Applications. Drive health, junk files and programs left behind are
  one quiet row instead of three cards, and the glowing Deep Clean button is
  gone. Nothing is drawn until it is measured: the program split waits for the
  program sizes rather than appearing and then changing, and Junk files has its
  own Measure button that walks the recommended cleaners and shows the total.
  The health ring and SMART table are behind a Drive details toggle.
- **The right-click menu no longer starts on Uninstall.** It opens with focus
  on the menu itself, so pressing Enter straight after the right-click does
  nothing. Down and Up step in from the first and last choice, and Uninstall
  is now the last item, set apart in red, below Open folder and Copy
  uninstall command.
- **Clean waits for a Preview.** Deep Clean's Clean button stays off until a
  Preview has measured something you have ticked, and says so beside it.
  Until then Preview is the highlighted button; afterwards Clean is.
- **Leftovers are no longer ticked by default on new installs.** The review
  after an uninstall opens with nothing ticked and you choose. Installs that
  already have the setting keep whatever they had; it is still under
  Settings, Uninstall, "Tick every leftover by default".
- **Cyan now marks only what you click.** The NEW badge and its "new in 7
  days" count, the sorted column heading, the Recommended tag on the Disk Map
  chooser, leftover notes and the reclaimable size, sizes in the scan log,
  a running batch item and info toasts use neutral text instead.
- **Bigger click targets and a larger minimum text size.** Every Deep Clean
  checkbox and category heading is now at least 24 by 24 pixels (the boxes
  look the same), and no text anywhere is smaller than 11 pixels.
- **Applications rows can be reached with the keyboard.** One row is in the
  Tab order, the arrow keys, Home and End move between rows, and a focused
  row shows its Folder and Uninstall buttons and a focus ring, as hovering
  does.
- **The Applications count follows your search and filter.** Under a search
  or a filter the heading reads, for example, "1 of 210 shown · 105.3 GB"
  instead of the total for the whole machine.
- **Long startup paths can be read and copied.** Selecting a launch path
  opens the whole thing wrapped on its own line, with a Copy path button. It
  is a button, so the keyboard and screen readers reach it too.
- **Deep Clean descriptions wrap to two lines** instead of being cut
  mid-word, and its scan and clean logs name each rule with its category
  ("Brave · Cache"), so three rules all called Cache can be told apart.
- **Unused says what it means.** Selecting the filter shows a line saying
  Prune keeps no launch history, and the filter is only offered when
  something is flagged, since nothing on this machine could be.
- **Clearer settings and wording.** The two restore-point switches now say
  what each covers (before an uninstaller runs, and before leftovers are
  removed), the registry backup no longer quotes a size from the author's
  machine, the About text no longer says "one-click", and the state named
  Broken on Applications is now "Left behind" to match the Dashboard.
- **Startup states the scheduled-task explanation once** at the top of the
  group instead of on every row.

- **New wording, including Delete now, Deep scan and the free-space wipe, is translated in all 39 languages**, using each language's
  existing terms for Left behind, Junk files, Drive details and the rest.

### Fixed

- **Deep Clean no longer says Freed for files it only moved.** Clean moves files
  into Quarantine by default, which frees nothing until Quarantine is emptied,
  yet the result said Freed 15.7 GB. Results now keep deleted bytes and moved
  bytes apart: Freed appears only for space that is really back, and a move reads
  Moved 15.7 GB to Quarantine. The space comes back when you empty it. with an
  Open Quarantine button. The same applies to the Recycle Bin and to the
  sandbox self-test.

- **Bug reports name the Windows version.** The report says "Windows 11
  (build 26200)" instead of "Windows_NT 10.0.26200".

## v2.8.2

A second, deeper pass over every translation. Every language now uses one
word for each feature everywhere, and a review that translated each string
back to English without the original caught wrong meanings that a normal
read-through misses.

### Fixed

- **Scheduled runs said the wrong thing in about ten languages.** "Due" was
  translated as "overdue", "expired" or "payable", and "missed" as
  "skipped".
- **Wrong quantities and wrong words.** Russian said the Deep Clean
  measuring takes "about half an hour" instead of half a minute, Vietnamese
  turned "a dozen others" into "dozens", Lithuanian translated "Open in File
  Explorer" as "Open in the browser", and Serbian's "Sandbox test failed"
  read as "sand test". Several languages called the disk index a "registry"
  and the app's own Dashboard "Control Panel".
- **The Windows folder name "System Volume Information" had been
  translated** in about ten languages, so users would not recognise it on
  disk. It is the literal name again.
- **"Clear selection" buttons read like the Clean or Delete action** in
  Spanish, French, Italian and Indonesian. They now say what they do.
- **The same feature had different names in different places.** Deep Clean,
  Quarantine, Disk Map, Startup, scan, leftovers, restore, cleaner and
  uninstaller each now have one term per language, page titles match the
  side bar labels, and the grammar around every changed word was corrected.
  A few side bar labels changed where the old name was the odd one out
  (Deep Clean in Polish, Slovak, Turkish, Romanian, Hungarian, Serbian,
  Lithuanian, Indonesian and Malay; Startup in Thai, Indonesian and
  Vietnamese; Quarantine and Dashboard in Vietnamese).
- **Plurals and counts.** "1 copies", "1 programs" and similar were fixed in
  most languages, including proper forms for Slavic, Baltic, Arabic and
  Hebrew counts, and a Greek verb form.

## v2.8.1

Every language reads better, and Deep Clean now speaks yours: its rule names,
descriptions and scan log were English in every language until now.

### Fixed

- **Translations were stiff, literal or inconsistent.** About 120 strings
  from 2.8 (Report a bug, the Disk Map chooser, the batch uninstaller,
  Quarantine settings, theme and shortcut labels) were reviewed in all 39
  languages and rewritten where they read as translated rather than
  written. Page titles now match the side bar labels, the "scan for
  leftovers" action has one name in both uninstall dialogs, the Quarantine
  settings no longer read as "undo", counts like "1 copies" are grammatical,
  and Serbian's Latin-script strings inside the Cyrillic text are Cyrillic.
- **The Report a bug label in the side bar was cut off in longer
  languages.** Side bar labels now wrap to two lines instead of truncating.
- **The Thumbnail Cache rule described itself as "a deeper pass than Smart
  Cleanup"**, a feature that no longer exists. It is now just "Thumbnail
  Cache", with a plain description.

### Added

- **Deep Clean is translated.** All 87 rule names and descriptions and the
  31 category labels are in 39 languages; product names (Brave, Discord,
  Steam and so on) stay as they are. A rule that is ever missing in a
  language falls back to English rather than showing blank, and the filter
  box finds a rule by its translated name or its English one.
- **Deep Clean's scan and clean log is translated too**: the status words
  (empty, not installed, needs admin, locked, skipped) and the Delete,
  Recycle, Clear, Compact and Trim verbs.

## v2.8.0

Prune now remembers where you left it, uninstallers that never opened now
do, the Disk Map shows real progress while it scans, Deep Clean gains
Windows Defender and WinRAR cleaners, and every screen has been reviewed
against Apple's Human Interface Guidelines for legibility, keyboard and
screen-reader access, and safer destructive actions.

### Fixed

- **The Dashboard's health score is now only about your drive.** It used to
  blend in free space and broken apps, so a healthy SSD on a nearly full disk
  scored badly; those already have their own cards. A drive that reports
  media or uncorrected errors now lands in the red band whatever its wear
  life. The live CPU and memory gauges are gone too: Prune is a storage tool.
- **Deep Clean listed and ticked cleaners for software you never had.**
  Slack, Teams, Zoom, Vivaldi, Telegram and other rules for programs that
  aren't installed were shown, and a saved selection could tick them again.
  Hiding cleaners that don't apply is now on by default, and a remembered
  selection is checked against what is actually installed before it is
  restored.
- **Disk Map's first screen was a wall of text.** Choosing between the fast scan and walking folders is now two side-by-side options, aligned with the page, with the fast scan marked recommended and each one's catch in a single line.
- **At high zoom the Deep Clean footer covered the list.** The page now
  scrolls inside its own area and the footer wraps its controls.
- **Page descriptions were a narrow block on wide windows.** Deep Clean,
  Disk Map, Duplicates and Startup now use the width they have.
- **The Uninstall button on a hovered row looked like an alarm.** It is now a quiet outlined button with a bin icon that turns red only when you point at it.
- **An uninstall could be hidden by pressing Escape while it was still
  running.** Escape and Close are now off while an uninstall, leftover scan
  or removal is in progress, so the work can't carry on with no window.
  If a vendor's own uninstaller stalls for 30 seconds, the single-program
  dialog says so and can then be closed (Prune does nothing further after
  that); a batch stays open and puts "Stop after this one" in front.
- **The leftover review's buttons could sit off-screen** at the smallest
  window size. The dialog now scrolls and keeps its buttons in view.
- **Text couldn't be made larger.** Removing the window menu had also
  removed Ctrl+Plus, Ctrl+Minus, Ctrl+0 and Ctrl+mouse wheel. They work
  again, and the zoom level is remembered.
- **In Windows high-contrast themes, switches, the current page in the
  side bar, selected tabs and the storage bar disappeared.** They now draw
  with the system's own colours.
- **Small text and small targets.** Text under 10 px is gone from the whole
  app, the tiny checkboxes in Applications and Deep Clean can be clicked
  from the whole row, unticked boxes and off switches are visible in light
  mode, and disabled or not-installed rows are readable again.
- **Startup lost its Status column below about 1000 px**, taking the
  "Invalid" marker with it. It stays visible now.
- **Disk Map's folder table could only be used with a mouse.** Its rows are
  keyboard-operable, treemap labels meet contrast, and stopping a scan
  shows one message instead of two.
- **Deleting a Quarantine batch could be confirmed by a double-click.**
  The confirm button ignores clicks for half a second.

- **Uninstallers whose path contains a space never started at all.**
  Clicking Uninstall on VALORANT (and any program whose registered
  uninstall command is a quoted path with a space in it, which includes
  everything under Program Files) launched nothing: Windows' command
  processor rejected the command as "not recognized" before any
  uninstaller ran, and Prune reported the uninstall as done anyway. This
  is the real cause of "the uninstaller doesn't open"; 2.7.0's fix for it
  addressed a window that was never being created. The command is now
  handed over exactly as the program registered it.
- **Batch uninstall could report "Uninstalled" while the program was
  still fully installed.** Selecting programs and choosing "Uninstall N
  programs" scanned for leftovers the instant each uninstaller's process
  exited. Some uninstallers hand the real work off and exit almost
  immediately -- Riot's VALORANT uninstaller, confirmed live, returned
  within seconds while its 32 GB install was never touched -- so Prune
  reported success and cleaned a few small leftovers while the program
  itself stayed exactly where it was. Batch uninstall now waits for you
  to confirm the uninstallers are done before it scans, the same step
  the single-program uninstall already had.
- **The "Read the whole drive" card's text now stays inside the card.**
  Long lines wrap within a centred card of bounded width instead of
  running to the edge, and the two buttons wrap onto a second row rather
  than overflowing when the window is narrow.
- **With "hide cleaners that don't apply" on, Deep Clean no longer hides
  the browser history, cookie and autofill rules before a scan.** Those
  rules were reported as not present until a scan had run, because the
  check looked only at the older single-path rule form. Folders that
  exist but that Windows won't let a normal user read (Defender's) now
  count as present too.

### Added

- **Report a bug from inside Prune.** A "Report a bug" button in the side bar
  and in Settings > About opens a prefilled issue on GitHub in your browser.
  Prune sends nothing itself: you see the whole report first, and it holds
  only what you write plus the Prune version, Windows version and
  architecture (no file paths, scan results or user name). Reports on
  GitHub are public and need a free GitHub account.
- **A labelled side bar.** From 1100 px of window width the rail widens to
  show each screen's name; below that it stays icons only. Dashboard has
  its own gauge icon, Settings sits at the bottom, and Ctrl+1 to Ctrl+8
  jump between screens. Page headings now match their names in the bar
  (Disk Map, Startup, Applications).
- **Choose System, Light or Dark.** "System" follows Windows again after
  you've picked a theme by hand.
- **Deep Clean can be filtered**, shows "N of M selected", remembers which
  categories you collapsed, and the whole row is the click target. While a
  clean is running, rows are read-only.
- **Applications: a right-click menu** (Uninstall, Open folder, Copy
  uninstall command), an Uninstall button that stays reachable in a narrow
  window, and sizes that no longer turn red -- red is kept for broken
  programs and destructive actions.
- **"Stop after this one" for a batch uninstall**, and the "automatically
  remove everything found" option is only offered when leftovers go to
  Quarantine, so the one-click path is always undoable.
- **Toasts wait for you.** Warnings stay until dismissed, and hovering or
  tabbing to a message pauses its timer.
- **Dashboard:** a health ring coloured by its own score and shown out of
  100, free space as the storage headline, and a layout that stacks
  instead of cutting off drive details at the smallest window size.
- **Duplicates says what actually happens.** Files go to Quarantine and are
  freed when you empty it; each copy is marked Keep or To quarantine, and a
  new search clears earlier ticks.
- **Real progress while the Disk Map walks folders.** The scan now streams
  what it has done so far: a live count of files scanned and bytes
  processed, and an animated bar. On a whole-drive scan of C: the bar
  carries a percentage, and it is a real one -- bytes read divided by the
  bytes Windows says are in use on the drive -- held at 99% until the scan
  actually finishes, because the two figures never match exactly. For a
  single folder, or another drive, no total is known, so there is no
  percentage at all: a moving bar and the counters.
- **Time left, worded honestly.** A folder walk shows "up to N s left":
  the walk has a 30-second time limit that the app reports and counts down
  to, but a small folder finishes long before it, so it is an upper
  bound, and at the limit it says the scan stopped early rather than
  sitting on zero. The fast scan (admin) cannot report progress (it runs
  in a separate elevated process that only hands back its result at the
  end), so it estimates from how long your last fast scan took ("about N s
  left, based on your last scan") and says so if it runs longer; the first
  time, with nothing to base it on, it shows no estimate, only the time so
  far. Finished scans draw a checkmark and offer "Scan again"; one that
  ran out of time says it stopped early (with a warning mark, not a
  checkmark) and offers the same; a failed one offers "Retry".
- **A Stop button on the folder walk.** It asks the scanner to stop and
  shows what was measured so far, worded as stopped early. The fast scan
  (admin) has no Stop: it runs in a separate elevated process that cannot
  be interrupted part-way. While a real percentage is showing, the card
  shows only the bar and the counters; the spinner and rings appear only
  when the length of the wait is unknown.
- **Motion, kept restrained and off under Windows' reduce-motion
  setting.** Buttons and nav items press in briefly when clicked and do
  nothing on hover (the primary button lifts 1px), with no bounce; switching
  tabs is a quick 160 ms fade instead of a slide; toggle switches slide on a
  spring; the scan counters count up to their value instead of jumping. The
  background glow stops drifting while the window is unfocused or hidden.
- **Windows Defender and WinRAR cleaners in Deep Clean**, matching what
  BleachBit offers for both. Defender: its scan history, temporary files
  and logs, plus its Quarantine and its definition-update backups.
  Those last two are marked as losing data and are off by default --
  Quarantine is how Defender restores a file it caught by mistake, and
  the backup is what it rolls back to after a bad update. WinRAR: the
  archive names, extract paths and search terms it remembers, and stray
  `.tmp` files. Defender's folders need administrator access, so
  without it those rules say "needs admin" instead of quietly showing
  nothing. Whether an elevated Prune can move files out of Defender's
  folders while its Tamper Protection is on has not been verified.
- **The window reopens where you left it** -- same size, same position,
  maximized if it was. If the monitor it was on is no longer connected,
  it opens centred on one that is, rather than somewhere off-screen.
- **Settings reopens on the tab you last used**, instead of always
  General.
- **Deep Clean remembers what you ticked.** The selection is kept across
  relaunches instead of resetting to the defaults every time.

## v2.7.1

Fixes a real Deep Clean false positive: a game could show up as
cleanable on a machine that never had it installed.

### Fixed

- **A game/launcher rule (Steam, Epic Games Launcher, Riot Client,
  League of Legends) could report itself as cleanable even when that
  program was never installed.** These 8 rules only ever checked whether
  a folder existed, not whether the program itself was actually
  installed -- and a launcher can create its own placeholder folders for
  titles it merely lists, not titles you've installed. They're now
  cross-checked against the same real, registry-based installed-programs
  list that already powers the Applications screen, so a rule can no
  longer claim a game is here when it isn't.

## v2.7.0

Fixes a real uninstaller bug (some uninstallers' own windows never came
to the front), plus two new screens: a real "Cookies to Preserve" picker
and a composite Dashboard health score.

### Fixed

- **Some uninstallers' own confirmation window never came to the front.**
  A program's uninstaller (Riot's VALORANT uninstall dialog, confirmed
  live) could genuinely open and sit there, hidden behind Prune's own
  window, with no sign anything had happened -- Windows' own
  focus-stealing prevention was refusing to let a background-spawned
  process's window become the foreground window. Prune now grants that
  right before spawning any uninstaller.
- Deep Clean and Disk Map's own "still working" indicators no longer
  borrow a generic loading pulse -- the row a scan or clean is currently
  reading now sweeps, and Disk Map's file-type bars grow into their
  measured width as the numbers actually arrive, instead of snapping to
  a value that was already final.

### Added

- **Cookies to Preserve** (Settings → Cleanup): scan for the real cookie
  domains on this machine and choose which ones survive a Deep Clean,
  instead of always losing every cookie on a browser's cookie rules. The
  keep-list engine has existed since Deep Clean's rebuilt cleaning engine
  landed in 2.6.0 -- this is the screen to actually use it.
- **A composite System Health score on the Dashboard**, replacing the
  ring that only ever showed drive wear. It now combines drive health,
  free disk space, broken/orphaned installs and hardware errors into one
  number, with a breakdown line underneath so it's never a mystery figure
  -- and it stays blank rather than guess until the real reads it depends
  on have actually come back.
- Uninstalling now matches Revo Uninstaller's own two-step flow: a
  manual "Scan" step once the uninstaller has actually finished (instead
  of racing into a leftover scan the moment its process exits, which can
  race real background cleanup some uninstallers keep doing), and an
  optional "automatically remove everything found" checkbox that skips
  the review screen -- still fully undoable through Quarantine either
  way.
- More hover and click feedback across the app: every button that wasn't
  already using one of the app's three named button styles now
  acknowledges a click, and checkboxes press with a distinct feel of
  their own.

## v2.6.1

Fixes an update-checker bug from 2.6.0 that could get stuck nagging
forever with no way to clear it.

### Fixed

- **The update-checker could get stuck offering an update that was
  already installed.** Two separate files track Prune's own version --
  one that electron-updater bakes into the installed app, and a second
  one Settings and the update-checker actually read -- and 2.6.0 only
  bumped the first. Anyone who installed 2.6.0 kept seeing an "update
  available" banner for a version they already had, and clicking it
  always failed with "GitHub is offering nothing newer than this
  version." The two are now kept in sync, and a check catches it before
  a future release can make the same mistake.

## v2.6.0

Deep Clean's cleaning engine rebuilt to match BleachBit's own real
behavior instead of always deleting the whole file, plus a Disk Map
freeze fixed, a locked-file uninstall gap closed, and Deep Clean's
input/output redesigned around BleachBit's own layout.

### Added

- **A real cleaning engine, not just whole-file deletes.** Deep Clean's
  rules can now target exactly what BleachBit itself targets instead of
  removing an entire file: a database gets `VACUUM`ed to reclaim space
  with zero data loss (`sqlite.vacuum`), a single registry key is removed
  cleanly (`winreg`), one key comes out of a JSON preferences file while
  the rest survives (`json`), and cookies/history/autofill/search-engine
  entries are edited in place rather than deleted wholesale. Every edit
  is quarantined first, same as everything else Deep Clean touches --
  nothing here breaks the "put it back" promise.
- **Chrome, Brave and Edge's history and cookie rules now use the new
  engine.** Clearing history keeps a bookmarked site's own entry instead
  of forgetting it the moment you visit it again; a future "sites to stay
  signed into" list (not yet in Settings) will use the same mechanism
  cookies already have, with today's default behavior unchanged.
- **Two new rules per browser**: "Search engines you've added" (clears
  custom search shortcuts, leaves Chrome/Brave/Edge's own built-in ones
  alone) and "Form-fill suggestions" (clears typed-before form
  suggestions specifically, without touching saved addresses, cards or
  passwords the way the existing "Autofill and form history" rule does).
- **Delete locked files on next restart** (Settings → Uninstall, off by
  default, needs administrator): a leftover file another program still
  has open is scheduled for deletion the next time you restart, instead
  of only being reported as skipped.
- Deep Clean's tree now matches BleachBit's own row layout (checkbox at
  the right edge of each row, not the left), and starting a Clean
  narrows the list to a live receipt of exactly what's being processed
  while the output panel takes the rest of the screen -- what you were
  browsing shrinks to what you're actually doing.

### Fixed

- **Disk Map could freeze the whole app** on a drive with a very large
  number of files -- confirmed on this machine's own C: drive at over
  three million files. The size/extension/largest-files calculations
  now run on a background thread instead of blocking the window.
- Minimize-to-tray now defaults to off: closing the window quits Prune,
  matching what most people expect from an X button.
- A hardcoded rule could report League of Legends present on a machine
  that never had it installed, if Windows wasn't on the C: drive.

### Changed

- Deep Clean's scan output now streams live during an actual clean, not
  just during Preview -- the row being worked on highlights, and Stop
  replaces Cancel once a clean is running.

## v2.5.1

The installer's language dialog now actually reaches the app on an
upgrade, not just a fresh install.

### Fixed

- **Picking a language in the installer did nothing on an upgrade.**
  Reported directly: choosing Greek while upgrading from 2.4.1 left the
  app in English. The installer writes its language choice to the same
  one-line file as the separate "check for updates" answer, and that
  file's write was gated entirely on the Updates page having been shown
  -- which it deliberately is not on an upgrade (anyone with an existing
  settings.json keeps whatever update-check preference they already
  set). The language choice got caught by the same gate by accident:
  it is a real, deliberate choice made in the installer's own language
  dialog on every non-silent run, fresh or upgrade, and has nothing to
  do with the separate reasoning that protects the update-check
  preference. The two are now written independently -- language on
  every interactive install, the update-check answer only when its own
  page was actually shown.

## v2.5.0

The whole app, not just the installer, in 40 languages — and updates
that install themselves.

### Added

- **Every screen translated into all 40 installer languages.** Not just
  the installer: Dashboard, Disk Map, Applications, Quarantine, Startup,
  Duplicates, Deep Clean, Settings, the uninstall and batch-uninstall
  flows, and every small piece of chrome around them (keyboard shortcuts,
  the theme toggle, toast notifications, the update button, the nav
  rail). Follows Windows' own display language by default, with a picker
  in Settings for anyone who wants another. Every string is real in
  every language — nothing falls back to English by omission.
- **One-click updates.** With the update check on, a button appears at the
  bottom of the side bar when a newer release exists. One click downloads
  it, installs it silently and reopens Prune on the new version — no
  release page, no second installer to click through. Nothing is
  downloaded before that click. This replaces the tile in the corner.
- **Install updates automatically** (Settings → General, off by default,
  and only with the update check on): a new release downloads in the
  background and installs the next time Prune closes. The side-bar button
  becomes a restart for anyone who would rather not wait.
- **The installer in 40 languages**, opening in Windows' own display
  language, with a picker for anyone who wants another.
- **An "Updates" page in the installer** that asks whether to check for
  updates, unticked unless you tick it. Shown on a fresh install only;
  upgrades, and the updater's own silent installs, keep whatever you chose
  before.

### Fixed

- **Deep Clean's "Select everything" button never worked at all.**
  `selectableIds` was called but never imported, so the button threw the
  instant it was clicked. No test had ever pressed it; one does now.
- **Deep Clean's "Freed X" success banner could never actually appear.**
  The state that shows it was set, then cleared again in the same
  synchronous tick by the rescan that follows every clean — React batched
  both into one commit, so only the clear ever painted. The banner now
  survives that rescan and clears on the next manual Preview instead.
- **A handful of real cache folders Deep Clean never measured.**
  `component_crx_cache` and `extensions_crx_cache`, which every
  Chromium-based browser (Chrome, Brave, Edge, Opera, Vivaldi) keeps
  directly under its `User Data` folder rather than inside a profile,
  were outside every existing rule's reach — confirmed non-trivial on a
  real machine (60+ MB on Brave alone) before fixing it.
- **A dark flash on launch for anyone on a light theme.** Two separate
  causes: the page's own CSS painted its dark defaults before the theme
  attribute was set, and the native window's background and title-bar
  buttons started dark unconditionally, correcting only after the app
  had finished booting. Both now start from the right palette immediately
  — the CSS one from a script that runs before the stylesheet does, the
  native one from Windows' own light/dark preference.
- **The logo and the nav icons below it didn't line up.** Ten pixels off,
  from two numbers picked independently that were meant to agree.

### Changed

- **The installer is now `Prune-Setup-<version>.exe`**, with hyphens. The
  old name had spaces, which GitHub turned into dots on the release page,
  and which the updater cannot follow.
- **2.4.1 and earlier cannot update themselves.** The updater arrives in
  this release, so this one version has to be downloaded and installed by
  hand. Every release after it installs from the side-bar button.
- **Prune opens faster.** Starting the backend and creating the window
  used to happen strictly one after the other, with the window waiting
  out the backend's own startup and first health check before it even
  appeared. They now run at the same time.
- **A small loading spinner during a Deep Clean scan**, next to the
  existing counter and progress bar — both of which are silent between
  updates, so a scan that paused for a moment looked identical to one
  that had stopped.

## v2.4.1

Text selection that behaves like a desktop app's, and the first release
built by GitHub Actions.

### Changed

- **Click-and-drag no longer highlights the whole window.** Labels,
  headings, numbers and buttons can't be selected any more, the way they
  can't in other Windows apps. What is worth copying still can be: file
  and registry paths (leftovers, Quarantine, Duplicates, the Disk Map's
  largest files), startup launch paths, the uninstall command, a Store
  app's package name, and the text of errors, toasts included. Text boxes
  are unaffected.

### Release

- **Built and attested by GitHub Actions.** The installer and the zip were
  built by the repository's own workflow rather than on a developer's
  machine, and each carries a signed attestation naming the commit and the
  workflow that produced it. Check a download with
  `gh attestation verify Prune.Setup.2.4.1.exe --repo jimman0I/prune`.

## v2.4.0

Revo-style uninstall options, an opt-in update check, and a Prune.exe that
looks like Prune.

### Added

- **An Uninstall tab in Settings**, modelled on Revo Uninstaller's options:
  - **Where leftover files go:** Quarantine (the default, restorable in
    Prune), the Recycle Bin, or Delete permanently. Registry keys are
    backed up before they are removed whichever you pick. Permanent
    deletion has its own guard — it refuses Windows, drive roots, Program
    Files itself, your profile's own folders and Prune's quarantine,
    whatever the scan found — and the review says where things will go
    before you confirm.
  - **Before uninstalling:** optionally create a System Restore point,
    and optionally back up the registry (`HKLM\SOFTWARE` and
    `HKCU\Software`, about 140 MB; the newest three are kept). If a
    registry backup you asked for can't be made, the uninstall doesn't
    run.
  - **After uninstalling:** turn the leftover scan off, start the review
    with nothing ticked, or stop keeping an uninstall history.
- **An opt-in update check** (Settings → General, off by default). Turned
  on, Prune asks GitHub once a day whether a newer release exists, and a
  tile in the corner of the window offers the download page when one
  does. Nothing is downloaded or installed, and it is the only request
  Prune ever makes beyond this machine.
- **Show free space on the Disk Map** (off by default): the drive's free
  space as one more block, like WizTree's.
- **Reset warning confirmations** in Settings → Cleanup, to bring back the
  "this loses data" questions you had told not to ask again.

### Changed

- **Your excluded folders now apply to the leftover scan too**, so a
  folder you told Prune never to touch is no longer offered after an
  uninstall.
- **Prune.exe shows its own icon and name** in Explorer, Task Manager and
  its Properties, instead of Electron's.

### Fixed

- **The About panel said v2.2.0** for five releases. It now shows the
  version you are running.
- **A failed uninstall no longer carries on to a leftover scan** as if it
  had worked.

## v2.3.4

A fix to what the batch dialog says, and a newer build toolchain.

### Fixed

- **The batch dialog no longer promises things a Store app does not
  get.** Its first lines said each program's own uninstaller would run
  and a leftover scan would follow. A Store app is removed through
  Windows and is not scanned, so a batch of only Store apps now says
  exactly that, and a mixed batch says which programs are which.
- **"No leftovers found — clean uninstall" only appears after a scan
  that ran.** It used to appear after a batch of only Store apps, where
  no scan runs, and after a batch where every uninstall failed — under
  the list of failures. Those now end with a plain Done instead.

### Changed

- **Built with electron-builder 26.** The build tools had ten known
  vulnerabilities in the archive extractor they use while building. None
  of them were ever in the app you install, and nothing about how Prune
  installs, runs or uninstalls has changed — the new installer was
  installed, launched and removed again before release to make sure.

## v2.3.3

Store apps can now be removed in a batch, alongside everything else.

### Changed

- **Store apps can be ticked for batch uninstall.** They were left out
  because they used to be removed through Windows. Since 2.3.0 Prune
  removes them itself, and now a batch can too.
- **Only the ones Windows says may be removed.** A Store app Windows marks
  as part of the system cannot be ticked, and neither can one Windows has
  not said either way about. A batch runs without anyone watching each
  removal, so it takes only the apps it has been told are safe to take.
  The checkbox says why an app is left out.
- **The confirm step says a Store app cannot be brought back.** Everything
  else a batch removes goes to Quarantine and can be restored. A Store app
  does not: removing it takes the app's saved data too, and getting it
  back means reinstalling it from the Store. When a batch includes one,
  that is said before anything runs.
- **No leftover scan after a Store app.** The scan matches on publisher,
  and most Store apps are published by Microsoft — a search for that would
  turn up a large part of Windows. The other programs in the same batch
  are still scanned as before.

### Fixed

- **Removing a single Store app is now recorded in the dashboard's
  history**, like every other removal. It had been missing since 2.3.0.

## v2.3.2

Chrome and Brave now uninstall silently in a batch — as long as they are
closed.

### Changed

- **Chromium browsers uninstall without their dialog when they are
  closed.** Chrome, Brave and other Chromium-based browsers used to stop a
  batch on their own "are you sure" window. Prune now uses the browser's
  own silent option, but only after checking that the browser's own
  uninstaller actually supports it.
- **An open browser is never closed for you.** The silent option also
  closes every running window of the browser, without asking — so Prune
  checks first, and if the browser is open, or Prune cannot tell whether it
  is, the browser's own dialog appears instead, just as before. Losing a
  window full of tabs to an uninstall you started from another app is not
  a trade Prune makes on your behalf.
- **Microsoft Edge and the WebView2 runtime always show Microsoft's own
  dialog.** Edge is Windows' own browser, and WebView2 is a shared
  component other programs draw their windows with — Windows Search among
  them. Neither is ever removed silently.

Your browsing data is kept either way. A browser deletes it only when you
tick that option in its own dialog, and a silent uninstall never does.

## v2.3.1

A fix to batch uninstall: it no longer removes a launcher before the games
that uninstall through it.

### Fixed

- **A batch uninstalls a game before the launcher it depends on.** Some
  programs are removed by asking another program to do it — a Steam game's
  uninstaller is Steam itself, a Ubisoft game's is Ubisoft Connect, and
  Overwolf apps and browser-installed web apps work the same way. A batch
  used to run in whatever order you ticked things, so selecting Steam first
  removed Steam, and the games queued after it were left with an uninstaller
  that no longer existed. They failed, and stayed behind as broken entries.
  Prune now runs the game first and the launcher after it.
- **The confirm list says when it has moved something.** A list that comes
  back in a different order from the one you ticked looks like a mistake
  unless it explains itself, so the program that moved reads "runs before
  Steam". Everything else keeps the order you gave it.

Prune only reorders when a program's uninstall command clearly names it to
another program. If it cannot tell, the batch runs in the order you chose,
exactly as before.

## v2.3.0

Batch uninstall that actually runs unattended, and Store apps you can
remove without leaving Prune.

### Added

- **Store apps can be removed from inside Prune.** They used to be listed
  and nothing more — every row opened Windows' own Installed Apps page. They
  now have an Uninstall button like every other row. Two apps on a typical
  machine keep the old behaviour: Windows marks the Security interface and
  the app installer as part of the system, and Prune will not offer to
  remove either — the check happens before anything is run, not by letting
  Windows refuse.
- **The removal dialog tells you it cannot be undone.** Everything else
  Prune removes goes to Quarantine and can be put back. A Store app cannot:
  removing one takes the app and its saved data, and getting it back means
  reinstalling from the Store. The dialog says that before you confirm
  rather than asking a generic "are you sure".

### Changed

- **Batch uninstall no longer stops on a wizard for every program.** Nine
  programs in ten now uninstall silently, up from seven in ten. Prune reads
  the silent command the vendor publishes in the registry where there is
  one — about one program in seven has it, and Prune was ignoring it — and
  otherwise uses the right flag for MSI, NSIS and Squirrel installers.
- **NSIS uninstallers are recognised by what is inside them, not by their
  name.** Plenty of uninstallers called `uninstall.exe` are not NSIS, and
  sending one of them the NSIS silent flag could make it do something else
  entirely. Prune checks the file itself; anything it cannot positively
  identify runs exactly as before, with its own wizard.
- **MSI uninstalls no longer restart the machine unasked.** They now also
  pass `/norestart`, so a package that decides it wants a reboot cannot
  take one in the middle of a batch you have walked away from.

## v2.2.1

A maintenance release. Nothing in the app looks or behaves differently;
this exists because 2.2.0 shipped a dependency with two open advisories
in it, and because the project needed a licence before anyone else could
legally run it.

### Fixed

- **A vulnerable version of `qs` no longer ships.** 2.2.0's installer
  contained `qs` 6.15.3, which has two moderate advisories against it: an
  array-limit bypass via bracket-key comma parsing, and a denial of
  service through an attacker-controlled `isBuffer`. Both are fixed in
  6.16.0. `npm audit fix` reached only half of it — Express 4.22.2 is the
  last of its line and pins `qs` to a range that excludes the fix, so
  getting there needed an explicit override.

  Real exposure was low and it is worth saying why rather than implying a
  narrow escape: Prune's server listens on 127.0.0.1 only, behind a guard
  that checks the `Host` header before a request body is ever parsed, so
  nothing off the machine can reach the parser at all.

### Added

- **Prune is MIT licensed.** There was no licence at all before, which
  under default copyright meant nobody had permission to use, copy or
  redistribute it — including the people downloading the installer.
- **A security policy**, with a private way to report a flaw rather than
  a public issue, and a plain statement of what is in scope: the local
  API, the cleaner's path guards, how commands are built around the
  uninstall string, the elevation path, and quarantine restore.
- **Contributing and release documentation**, including the rule this
  project actually runs on — break your own test before sending it, and
  say so in a comment when something genuinely cannot be tested.

### Changed

- **The tests no longer collide with each other.** A handful of them
  create and delete a real registry key, and every one used the same
  name, so two test runs on one machine tore down each other's fixture
  and produced twelve failures that looked like bugs in the quarantine
  code. The key is now unique per process.

## v2.2.0

A light theme, the app's own title bar, motion throughout, a much fuller
startup list, a rebuilt Deep Clean list, and application icons wherever a
row is an app.

### Added

- **A light theme.** Aurora Deck in daylight, and a real palette rather
  than the dark one inverted: the accent darkens so buttons can keep white
  text, the ambient washes drop to a third of their strength, and every
  text tier was measured against the surfaces it actually sits on. Every
  screen was checked in both themes and every piece of text meets WCAG AA.
  Prune follows your system setting until you pick one in Settings >
  Appearance, and remembers your choice after that.
- **Prune draws its own title bar**, with the mark and name where Windows
  used to put a small icon and the word "Prune". The window buttons are
  still Windows' own, so Snap Layouts and edge-snapping behave exactly as
  they always did, and they repaint to match the theme.
- **Motion.** Screens fade and rise as you switch tabs, the marker in the
  sidebar slides to the tab you picked, the dashboard's counts settle
  instead of snapping into place, loading rows shimmer, and the glow
  behind everything drifts slowly. All of it stops if your system asks for
  reduced motion.

- **The startup screen now shows scheduled tasks, automatic services and
  the startup tasks Windows Store apps register.** It listed 15 things and
  now lists 55. The three new kinds are read-only: each one is switchable,
  but in Task Scheduler, in Services, or in the app's own settings rather
  than through the record Windows keeps for sign-in entries, so each row
  says where to go instead of offering a switch that would not work.
  Windows' own tasks and services are left out -- with them the list is
  283 rows, nearly all of it the operating system describing itself.
- **Every Deep Clean heading now carries its application's icon.** The list
  groups 74 rules under 29 headings, and the headings were the one place in
  the app where a row is an application and had nothing but its name --
  "Chrome", "Edge", "Opera" and "Vivaldi" are four headings of nearly
  identical shape. Twenty of the twenty-nine resolve on a typical machine;
  the rest are software that is not installed, and those keep a lettered
  tile.
- **The Startup and Deep Clean screens load their icons before you open
  them.** Both were read only once you clicked the tab, so the first visit
  showed a table of lettered tiles that swapped to real icons a second or
  two later. They are now read while the app is idle, so the tab opens with
  them already there.

### Changed

- **The Deep Clean list is much denser.** Rows went from about 48px in
  their own card to 24px, and from roughly six visible at once to nineteen.
  One scrolling list instead of a stack of panels, and one tri-state
  checkbox per application instead of a pair of "Select All / Deselect All"
  links. Nothing was dropped to get there: the measured size, the
  not-installed / needs-admin distinction and the plain-English description
  are all still on the row, now on a single line.
- **Category headings stay put while their rules scroll past**, so it is
  always clear which application you are looking at.
- **The Deep Clean tab has a new icon** -- a broom rather than a
  paintbrush.
- **Ticking an application in Deep Clean now selects everything under it**,
  asking about each rule that loses data as it goes. It used to skip those
  rules silently, which meant ticking a browser gave you two of its seven
  cleaners and a half-filled box that looked broken. Every warning is
  still shown and still answered one at a time; declining one moves on to
  the next rather than giving up on the rest.
- **Deep Clean knows which cleaners apply to your machine before you scan.**
  "Hide cleaners that don't apply" had nothing to work with until a full
  scan had finished, so the list opened showing Firefox, Opera and Vivaldi
  to people who have none of them. The check costs a fraction of a second
  and runs as the list loads.

### Fixed

- **Discord's startup entry shows Discord's icon.** It runs through a
  launcher stub that contains no icon at all, so the row fell back to a
  lettered "D" while the real icon sat one directory away. Prune now
  follows the stub to the program it launches, which fixes this for every
  app that installs the same way -- Slack, GitHub Desktop, Signal and Teams
  among them.
- **A hover label no longer sticks after you click.** Clicking a tab in the
  sidebar left that tab's name floating over the page until you clicked
  something else. The same fix applies to the buttons that fade in on a
  program row.

## v2.1.3

More fixes and hardening from a second audit, this time of the frontend
only. No new features.

### Fixed

- **A second click on a destructive button no longer starts a second
  operation.** Removing a folder from the Disk Map, uninstalling, batch
  uninstalling and removing leftovers all relied on their button
  disappearing to stop a double-click, which only works if the screen
  redraws faster than you can click twice. The Disk Map one showed: a
  successful removal was followed by an error saying the folder was not
  there, because the second click had gone looking for what the first had
  already moved.
- **The Disk Map's tooltip stays on screen.** Near the right or bottom
  edge it ran off the window, taking the full path — the part worth
  reading — with it. It now flips to the other side of the cursor.
- **The Startup list re-reads the machine after a switch is toggled**, so
  entries that changed as a side effect of the one you touched are no
  longer left showing stale states. A row also stays marked busy until
  its own change finishes, rather than until the next row is toggled.

### Accessibility

- **The Disk Map can be used without a mouse.** Folder blocks take focus
  and open with Enter or Space, and focusing one shows the same tooltip
  hovering does. Blocks that cannot be opened are skipped rather than
  becoming tab stops that lead nowhere.
- **Deep Clean announces its scan.** Nineteen seconds whose only progress
  signals were a small counter and a two-pixel bar, neither of which a
  screen reader can see, so the wait was indistinguishable from the app
  having stopped.

## v2.1.2

Bug fixes and hardening from a full audit of the frontend. No new
features, and nothing here changes how anything is used.

### Fixed

- **A Deep Clean rule you enabled through the warning dialog no longer
  disappears when a scan finishes.** The screen narrows its selection
  after every Preview, and that filter was reusing the rule that keeps
  Select All away from data-losing options — so a rule you had
  deliberately confirmed, including one you had permanently
  acknowledged, was quietly unticked. Introduced in 2.1.0 and fixed
  before it reached a second release.
- **A failed startup toggle now returns the row to what it actually
  was.** It reverted by flipping the value instead, which is right for a
  single click and wrong for the second of a quick pair: two fast clicks
  on one row could leave it showing a state it had never been in.
- **A malformed or unexpected reply from the backend no longer takes a
  screen down.** Fourteen readers assumed their payload key was present
  and handed back `undefined` when it was not; the Dashboard's activity
  list crashed the whole screen on one. They now fall back to an empty
  list, which reads as "nothing here" rather than a blank screen.

### Accessibility

- **Animations honour the system's reduce-motion setting.** Three
  components animate through framer-motion rather than CSS, and the
  app's reduced-motion rules only ever governed the CSS ones — so the
  toast slide, the right-click menu and the resource gauges ran at full
  strength for anyone who had asked their machine for less.
- The Duplicates folder box and the Applications search box have real
  labels instead of relying on their placeholder text, which screen
  readers do not reliably announce and which vanishes as soon as you
  type.

### Performance

- **Switching tabs no longer re-renders every screen you have opened.**
  Screens stay loaded so your work survives a tab switch; the cost was
  that each switch re-rendered all of them, including the Disk Map.
  Measured before and after: a hidden Disk Map went from rendering on
  every switch to not rendering at all.
- The global keyboard-shortcut listener is attached once rather than
  rebuilt on every render.

## v2.1.1

Installer metadata only. The app itself is unchanged from 2.1.0 — if you
already have it, there is nothing here worth downloading for.

- **Prune no longer lists itself as "Unknown Publisher."** Its uninstall
  registry entry carried no Publisher, so it appeared that way in its own
  Applications tab, in Windows' Apps & features, and in any other
  uninstaller. Found by installing 2.1.0 from its own release and reading
  back what Windows recorded. It now reads "Prune".

Still missing an InstallLocation, which electron-builder's NSIS target
does not write and offers no setting for. The only thing it costs is
Prune's own "Folder" button doing nothing for its own row.

## v2.1.0

### Deep Clean asks before a rule that loses data is ticked

Sixteen of the seventy-four rules are marked as losing something —
browsing history, cookies, open tabs, autofill and per-site storage across
Brave, Chrome and Edge, plus the Recycle Bin. Until now the whole
protection was a "Loses data" badge and not being selected by default: one
click on a checkbox, and the next Clean signed you out of every site you
use.

Nothing there is unrecoverable — Clean moves everything to Quarantine
first — but recoverable is not the same as wanted, and having to restore a
batch to get your sessions back is still an afternoon interrupted by a
tool that was supposed to help.

So ticking one now opens a dialog naming the rule and what it costs:
"Enable Brave — Cookies", "Signs you out of every site that remembered
you." Cancel is the safe default; "Enable anyway" is the deliberate one.
Ticking a box is not cleaning, and the Clean button's own confirmation
still stands between this and any file moving.

- **Only on the way on.** Unticking cannot lose anything, and a dialog in
  front of the safe direction is how people learn to click through the one
  in front of the unsafe direction.
- **"Remember my choice" is per rule, not per category.** Agreeing to lose
  cookies is not agreeing to lose browsing history. The rules that have
  stopped asking are kept in Settings as `acknowledgedCleanWarnings`.
- **Select All no longer sweeps in a rule that loses data**, unless you
  have already said to stop asking about that one. A single bulk click is
  the opposite of the deliberate choice the dialog exists to capture, and
  five dialogs in a row would train anyone to dismiss them unread. It
  already skipped rules for software this machine does not have; this is
  the same idea applied to rules that need an answer nobody has given.
  What it leaves unticked is visible on the row, wearing the badge.

## v2.0.0

The largest release since 1.0. One feature was removed and replaced, three
screens are new, the whole interface was redesigned, and the API the app
talks to itself over stopped accepting requests from anywhere else.

### Removed

- **Smart Cleanup is gone**, replaced by Deep Clean. Its four hard-coded
  categories (Temp, Thumbnail Cache, Recycle Bin, Browser Cache) were a
  fraction of what is actually reclaimable, and the parts of it that
  genuinely could not be expressed as a rule moved into Deep Clean rather
  than being dropped.

### Deep Clean (new, replacing Smart Cleanup)

- **74 rules across 29 categories** — the browsers split per application
  rather than lumped as "browser cache", plus Discord, Spotify, Steam,
  Epic, Riot, Ubisoft Connect, League of Legends, Overwolf, NVIDIA,
  DirectX, Adobe, JetBrains, VS Code, Office, Teams, Zoom, Slack,
  Telegram, qBittorrent, Malwarebytes and Windows' own caches.
- **The scan streams a rule at a time.** The one-shot version took about
  nineteen seconds and said nothing until it finished, which is
  indistinguishable from being stuck. The tree now fills in as each rule's
  real size is known, in a two-pane layout with live output and a Stop
  button that actually stops the filesystem walk.
- **A rule that cannot be measured says why** — "not installed" or "needs
  admin" — instead of reporting 0 B. Reporting zero for something the app
  could not see is a claim about the machine rather than an admission
  about the scan.
- Rules are marked for whether they are safe to select by default and for
  whether they lose data (saved sessions, logins), so the destructive ones
  are never swept up by a select-all.
- The rule tree is on screen immediately, before any scanning, with sizes
  filled in afterwards — the screen used to be blank until someone ran a
  scan that took half a minute.

### Startup (new screen)

- Lists everything Windows launches at sign-in, across the Run, Run32 and
  Startup-folder locations, grouped by where each entry lives.
- **Reads whether Windows will actually run each entry**, from the
  `StartupApproved` store Task Manager itself writes — not just whether
  the entry exists.
- **Switch entries on and off**, the same way Windows does, writing the
  same 12-byte record. A machine-wide entry raises a UAC prompt, and
  declining it is reported as a decision rather than an error.
- Real icons, resolved through Startup-folder shortcuts to their targets,
  with a lettered tile when a program has none. These entries are named by
  whatever string a program wrote into a registry value, so
  "RtkAudUService" and "vgtray" are the names — the icon is often the only
  thing that says what one actually is.

### Duplicates (new screen)

- Finds duplicate files under a folder you choose, in three passes: group
  by size, then compare a 64 KB sample, then hash in full. Almost nothing
  is read completely — a file with a unique size is never opened at all.
- A folder, never a whole drive by default. Hashing is the expensive part
  and the honest scope for it is somewhere you picked.
- Selection keeps the oldest copy of each group by default, and the scan
  is bounded and abortable.

### Applications

- **A dense, sortable grid** in place of the card list, with the columns a
  Revo-style uninstaller needs, and **batch uninstall** with row selection.
- **Real icons, extracted from each program's own executable** — including
  Windows Installer's own product icons, a file-type fallback for the
  rest, and a lettered tile when there is genuinely nothing to show.
- **The blanks filled in.** Sizes measured from install folders for the
  entries with no recorded size (with Epic and GOG install records read
  directly), versions read off program binaries, and install dates
  recovered from the uninstall key's own write time — two thirds of the
  list had no date at all.
- **Microsoft Store apps and browser extensions**, neither of which the
  uninstall registry mentions anywhere. Both listed and marked for what
  they are, with their own icons and filters, and a button that opens
  Windows' own Installed apps page where a Store app is actually removed.
- **Running programs are detected and flagged**, with a warning before
  uninstalling one — an uninstaller for a running program either fails or
  half-succeeds.
- **Forced removal for orphaned entries** whose own uninstaller is gone,
  and a Folder button that opens any program's install location.
- A New column marking recent installs.

### Disk Map

- **Full-drive scan by reading the NTFS MFT directly**, the way WizTree
  does — a whole drive in seconds instead of a directory walk, behind a
  UAC prompt because reading the MFT requires it.
- One screen, coloured by file type, browsable instantly at a drive root
  instead of crawling.
- **A largest-files view, a folder table, and a breakdown by file type**
  beside the map, plus Windows' own icon for each file type.
- **Right-click to remove**, routed through Quarantine and the path guard
  — never a delete. This is the one removal in the app that acts on
  whatever happened to be under the cursor, so it refuses protected paths
  with a reason rather than a generic failure.
- A truncated scan now says which part of the drive it never reached,
  instead of quietly leaving it out of the answer.

### Quarantine

- **A retention window and a size cap**, both off by default. Over the
  cap the oldest backups go first, and the newest is never dropped even
  when it alone exceeds the limit — otherwise quarantining a 60 GB folder
  under a 5 GB cap would destroy it with the feature meant to keep it
  safe. When the cap cannot hold, the screen says so.
- Both limits are applied where the quarantine actually grows (after a
  removal) and once on start, for a window that expired while the app was
  closed. Every batch removed is named along with which rule took it.
- The screen shows what is held against the limit, and says "at least"
  when a batch carries no recorded size rather than rounding an unknown
  down to zero.
- **Restore and permanent delete work over HTTP at all now.** A manifest's
  `batchDir` is a full absolute path, and joining it onto the quarantine
  root a second time produced a doubled, nonexistent path — so both had
  only ever worked in direct unit tests, never through the app.
- Registry keys that could not be removed are recorded rather than
  swallowed, so a removal cannot report success while an HKLM entry is
  still there.

### Automation (new)

- **A scheduled scan or clean**, daily or weekly, which catches up on a
  run that was missed rather than skipping it — and reports how many were
  missed, because a desktop asleep at 2 AM did not fail its schedule, it
  simply was not there for it.
- It admits what it cannot do: the run happens while Prune is open, since
  there is no headless entry point for a Windows task to invoke.

### Dashboard

- **Real drive health, replacing free-space-as-health.** Free space is not
  health, and presenting it as such was the single most misleading number
  in the app. Reads the drive's own NVMe SMART log and its SMART
  attributes, with an explicit admin unlock for wear data.
- **Live CPU, memory and disk throughput**, from a single streaming
  performance counter rather than a sampled call per request — measured
  first, because the naive version cost 1.7 seconds per reading.
- A broken-entry count, and three cards that each say something.

### Settings

- **Exclusions now cover file types as well as folders**, and both are
  honoured by Deep Clean, the disk scanner and the duplicate finder alike.
- Three guards taken from what Revo and BleachBit ship enabled rather than
  merely offer: leave recently-modified files alone, create a restore
  point first, and hide cleaners for software this machine does not have.
- Controls for both quarantine limits.
- **Two settings that did nothing are wired.** `excludeFolders` and
  `autoQuarantine` were written to disk, shown back, and read by no line
  of behaviour. A control that does nothing is worse than a missing one.

### Design

- **A complete visual redesign** — Aurora Deck, on obsidian, with cyan as
  the one action colour.
- Entrance and hover motion throughout, written in CSS with no animation
  library, and honoured `prefers-reduced-motion`.
- Toasts, global keyboard shortcuts with a shortcut list, breadcrumbs,
  and empty states that say what to do rather than that there is nothing.
- **Accessibility work**: visible focus states, muted text raised to WCAG
  AA contrast, real dialog semantics with a focus trap and Escape, and
  every destructive confirmation as an inline two-step rather than a
  native `window.confirm`.

### Security

- **The API only answers Prune's own window.** It previously sent
  `Access-Control-Allow-Origin: *` and checked nothing, so any website
  open in a browser could read the installed program list and the disk
  contents, toggle startup entries, run a Deep Clean, move a folder
  through quarantine, or empty the quarantine outright. Both the Origin
  and the Host header are now checked — the second defeats DNS rebinding,
  where an attacker's domain resolves to 127.0.0.1 and no Origin is sent
  at all.
- **Uninstalling takes a program id, not a command.** The route used to
  hand a string from the request body to `cmd.exe`. Nothing was reachable
  through it that a local process could not already do directly, but a
  client should not be able to describe a command — only point at a
  program the machine already agrees is installed.
- Errors and unknown paths answer as JSON. A malformed request body used
  to return Express's default HTML error page, which included a stack
  trace naming the install directory and the internals of its
  dependencies.

### Under the hood

- Every read path moved onto TanStack Query, including the two streaming
  scans, with cancellation intact.
- The route layer has tests for the first time — seventeen route files
  had none, which is where validation, trust decisions and error mapping
  all live.
- Four handlers that never answered at all were fixed. An async handler
  that rejects does not reach an Express 4 error handler, so the request
  was left unanswered and the socket open until the client gave up.
- Test files are no longer shipped inside the installer.

### Fixed

- **The leftover file scan never worked.** A space in a search root broke
  it, so it found registry keys and never files — which is most of what a
  leftover scan is for.
- **Steam games all reported the size of Steam itself.** Their uninstall
  string points at Steam's own binary, so every one of them measured the
  same folder.
- The widened registry scan no longer matches other programs' keys.
- Nineteen programs no longer share one meaningless icon, and the
  lettered tile is legible — it was white on coral at 2.5:1 contrast, and
  skips a vendor word the Company column already repeats.
- PowerShell output is forced to UTF-8, so non-Latin program names survive
  the query.
- The Disk Map tooltip follows the cursor again, and the map no longer
  crawls.
- A rule token that silently disabled a Deep Clean rule.

### Known limitations

- Windows only. No macOS/Linux support (the entire feature set is built on
  the Windows registry, `reg.exe`, and `powershell.exe`).
- Microsoft Store apps are listed, dated and sized, but are removed
  through Windows' own Installed apps page rather than by Prune.
- Browser extensions are listed but are removed from the browser itself.
- Leftover scanning is heuristic (name/publisher matching), not a full
  before/after filesystem snapshot.
- Scheduled runs happen while Prune is open. There is no headless entry
  point for a Windows scheduled task to invoke.
- A folder on another drive cannot be quarantined — Windows cannot rename
  across volumes, and copying 40 GB to make it look atomic would be worse.
- The unsigned installer will trigger a Windows SmartScreen warning on
  first run.

## v1.0.1

Rebranded from "unrevo" to "Prune" -- new name, new mark (a navy circle
with a teal geometric leaf, replacing the earlier coral badge), across
every user-visible surface: window title, taskbar/tray icon, tray
tooltip and context menu ("Open Prune"), the sidebar, the installer/
uninstaller, and every package identifier (npm package names,
electron-builder's `appId`/`productName`). No feature changes --
everything documented under v1.0.0 below still applies, just under the
new name.

## v1.0.0

First stable release, shipped as "unrevo". Prune is a local, offline uninstaller and cleanup
utility for Windows: it reads the real Uninstall registry (HKLM 64-bit,
HKLM WOW6432Node, HKCU), runs each program's own registered uninstaller,
then goes further than Windows' own "Apps & features" by scanning for what
that uninstaller leaves behind and giving you a safe, reversible way to
remove it.

### Uninstaller

- Enumerates every installed program across all three Uninstall registry
  hives Windows actually uses, deduplicated where a program's registry key
  collides across hives.
- Runs a program's own registered uninstall command (`MsiExec.exe /X{id}
  /qn` for MSI installs, or the program's own uninstall string), streamed
  live over SSE so the UI shows real progress, not a fake bar.
- Best-effort System Restore checkpoint before a forced removal — not the
  primary safety net (Windows throttles checkpoints to one per 24h), but
  cheap extra protection when available.

### Leftover scan & Quarantine

- After an uninstall, scans for files/folders, registry keys, and
  scheduled tasks left behind — matched heuristically against the
  program's name and publisher across Program Files, AppData, ProgramData,
  and the Start Menu.
- Nothing selected for removal is deleted outright: it's moved into
  Quarantine first (files via atomic rename, registry keys exported to
  `.reg` backups before deletion), so a bad match is always recoverable.
- **Quarantine Manager**: browse every quarantined batch — program name,
  real quarantine date, total size, and each file's original path.
  Restore a batch back to where it came from, or delete it permanently
  (behind a real two-step inline confirmation, never a native
  `window.confirm`). Empty the whole quarantine at once, same
  confirmation gate.

### Disk Map

- Interactive treemap of disk usage, built from a real async, abortable
  filesystem scan — navigate into any folder, see what's actually eating
  space, colored and size-badged by how much each entry holds.

### Smart Cleanup

- One-click junk scan across four real categories: Temp Files, Thumbnail
  Cache, Recycle Bin (sized via the Shell.Application COM object, not an
  estimate), and Browser Cache.
- Toggle categories on or off, see the real reclaimable total update live,
  then clean — quarantined by default (see Settings), so cleanup is
  reversible too.

### Settings

- **Cleanup**: folders to always exclude from Smart Cleanup and the
  leftover scanner; an Auto-Quarantine toggle controlling whether removed
  files go to Quarantine first or are deleted outright.
- **Sandbox Test**: runs the real cleanup engine — the same `scanJunk()`
  and `executeCleanup()` functions Smart Cleanup itself calls — against a
  throwaway temp directory, never your actual Temp, Windows Temp, or
  thumbnail cache, and reports a real per-step pass/fail result. A way to
  prove the destructive logic actually works before trusting it on real
  files.
- **About**: app name, version, and a one-line description.

### Dashboard

- System health gauge (free space as a percentage of total), total
  storage used/free, installed app count, and a Recent Activity log of
  past uninstalls with how much space each one freed.

### Packaging

- Windows NSIS installer and a portable `.zip`, built via `electron-builder`.
- Quarantine data and settings live under the user's real AppData
  directory (`app.getPath('userData')`), never inside the install
  directory — an app upgrade never touches or deletes them.
- The backend has zero native (compiled) dependencies — the registry
  reader and PowerShell COM interop for Recycle Bin sizing both shell out
  to `reg.exe`/`powershell.exe`, binaries already on every Windows
  machine, nothing to bundle or rebuild per-platform.

### Known limitations

- Windows only. No macOS/Linux support (the entire feature set is built
  on the Windows registry, `reg.exe`, and `powershell.exe`).
- Store/UWP apps (`Get-AppxPackage`) are not listed or uninstallable —
  only classic Win32 registry-based installs.
- Leftover scanning is heuristic (name/publisher matching), not a full
  before/after filesystem snapshot.
- The unsigned installer will trigger a Windows SmartScreen warning on
  first run.
