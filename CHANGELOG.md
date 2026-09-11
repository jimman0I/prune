# Changelog

All notable changes to Prune (formerly named unrevo -- rebranded 2026-09-01,
see v1.0.1 below) are documented here.

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
