# Security

Prune uninstalls programs, deletes files, writes to the registry and asks
Windows for administrator rights. A bug in it costs more than a bug in
most desktop apps, so this page says where to send one and what is worth
sending.

## Reporting a vulnerability

**Use GitHub's private reporting**, not a public issue:
[Report a vulnerability](https://github.com/jimman0I/prune/security/advisories/new).
That opens a private thread visible only to you and the maintainer, so
nothing is disclosed while it is still exploitable.

If private reporting is unavailable to you for any reason, open a public
issue saying only that you have found a security problem and asking for a
private channel. Do not include the details.

Please include, if you have them:

- What an attacker gains — read a file they could not read, delete one
  they could not delete, run code, get administrator.
- Whether it needs the attacker to already be running code on the machine
  as that user. If it does, say so; it changes the severity a great deal
  (see below).
- The steps, and the Prune version from Settings.

### What to expect

Prune is written by one person. There is no security team and no
on-call rotation, so an honest answer rather than a flattering one: expect
a first reply within about a week. If a report is valid and I can fix it,
a release follows as soon as it is ready and the advisory is published
with it. If I cannot fix it, or decide not to, I will say which and why
rather than leaving the thread to go quiet.

Credit in the advisory and the changelog if you want it, and not if you
do not.

## Supported versions

The latest release only. Prune is a single-developer project with no
long-term support branches; a fix ships in the next version, and older
ones are not patched.

## What is in scope

These are the parts where a bug does real damage. All of them are things
Prune does on purpose, so the vulnerability would be in the guard rather
than in the capability.

- **The local API.** The backend listens on `127.0.0.1:3101`, and
  loopback is not the protection it sounds like: every web page the user
  has open can reach it too. A `localOnly` guard checks the `Host` header
  before the body is parsed, and CORS reflects rather than wildcards.
  Anything that gets a request past that guard is in scope — it would let
  any site the user is browsing list their installed programs, toggle
  startup entries, run a Deep Clean, or empty the quarantine and destroy
  every undo the app holds.
- **Path handling in the cleaner and the quarantine.** Deep Clean and the
  leftover sweep both delete by rule, and every deletion is guarded by an
  exclusion list that no rule may override (`lib/cleanGuards.js`). A path
  that escapes those guards, or a quarantine restore that writes outside
  the directory it was captured from, is in scope.
- **Command construction.** Uninstalling runs the program's own
  registered uninstall command, and several features shell out to
  `powershell.exe` and `reg.exe`. An injection that turns registry-derived
  or user-supplied text into an extra command is in scope.
- **Elevation.** Some operations raise a UAC prompt. Anything that gets
  more done under that elevation than the prompt described, or that
  elevates without one, is in scope.
- **Quarantine integrity.** Removed files are moved and registry keys
  exported so a bad match can be undone. Anything that makes a restore
  write the wrong thing, or to the wrong place, is in scope.

## What is out of scope

Not because these do not matter, but because they are known, deliberate,
or not something a report can change:

- **The unsigned installer and the SmartScreen warning.** Prune ships
  without a code-signing certificate, on purpose, and the README explains
  what that warning means and how to verify the download instead. This is
  a documented limitation, not a finding.
- **Anything that assumes the attacker already runs code as that user.**
  If they do, they can delete the same files Prune can, without Prune. A
  report needs to show a gain over what the attacker already has.
- **Antivirus flagging the binary.** Expected for an unsigned program that
  deletes files in bulk and spawns PowerShell. Tell me anyway — it is
  useful — but as an issue, not a vulnerability.
- **Dependency advisories with no path to exploitation here.** A CVE in a
  package is a starting point, not a finding. Say how it is reached
  through Prune.
- **Findings from automated scanners, pasted unread.** Anything that
  cannot say what an attacker gains will be closed.

## What Prune does not do

Stated because it removes a whole category of question, and because it is
verifiable rather than a promise: **nothing Prune does leaves the
machine.** There is no telemetry, no update check, no crash reporting and
no analytics.

The only HTTP in the app is the window talking to its own backend on
`127.0.0.1:3101`. There is no `autoUpdater`, and no code path anywhere —
backend, frontend or Electron main — that opens a connection to a host
that is not loopback. Grep for it: the sole non-loopback URL in the
Electron shell is `http://localhost:5174`, the Vite dev server, used only
when running from source.
