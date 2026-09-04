# Prune

A Windows uninstaller and disk cleaner. It removes programs and the mess they
leave behind, shows what is actually using the disk, and cleans the caches that
accumulate on their own.

## Register

Product. Design serves the task: this is a tool someone opens because something
is wrong — the drive is full, a program will not uninstall, the machine takes a
minute to sign in. Nobody browses it. The interface should disappear into the
job and be trusted while it deletes things.

## Users

One person, on their own machine, who knows what a registry key is. They already
use Revo Uninstaller Pro, BleachBit, WizTree and CrystalDiskInfo and are
replacing all four with this. That sets the bar: they will notice immediately if
a number here disagrees with what those tools report, and they will check.

Not an enterprise fleet, not a novice being protected from themselves. The
audience is technical enough to want the real path, the real key name and the
real byte count rather than a reassuring summary.

## Product Purpose

Answer four questions and act on the answers:

- What is installed, and how do I get rid of it completely?
- What is using my disk, and where exactly?
- What junk can I clear, and what will I lose if I do?
- What runs at sign-in, and is any of it dead?

The thing that separates it from the four apps it replaces is that they are four
apps. The value is one tool where the disk map, the uninstaller and the cleaner
know about each other.

## Brand Personality

**Accountable.** This app deletes things. Every number is measured rather than
estimated, every removal is reversible, and anything it could not determine says
so instead of showing a plausible zero. The tone is a competent colleague
telling you what they found, including the parts that are inconvenient.

Precise, quiet, and unhurried. It never celebrates. Clearing 40 GB gets a number,
not a confetti animation.

## Anti-references

- **Not a 2005 Windows utility.** No dense grey toolbars, beveled buttons, 11px
  system font, cramped tables or icon strips. The category's own worst habit.
- **Not a generic SaaS dashboard.** No stat-card grid as a landing screen, no
  gradient hero, no rounded-everything marketing polish on a destructive tool.
- **Not a toy.** No mascots, no emoji as iconography, no bouncy motion, no
  celebratory language. It is holding a knife.

## Design Principles

1. **Measured, not estimated.** Show what was actually read. "Not measured" is a
   valid and frequently correct answer, and is never rendered as 0.
2. **Reversible by default.** Removal moves things to quarantine. Anything that
   cannot be undone says so before it happens, in the row that will do it.
3. **The dangerous thing is never the easy thing.** Destructive actions are
   explicit, named, and never the default focus.
4. **Density is a feature.** This user wants the whole table. Do not paginate,
   summarise or hide detail for tidiness — hide it only when it is genuinely
   irrelevant to the machine in front of them.
5. **Say where the number came from.** A figure that disagrees with Task Manager
   or WizTree must be explainable, not just correct.

## Accessibility & Inclusion

Desktop Electron, keyboard and mouse. WCAG AA contrast is the floor for all text
including muted labels and placeholders. Every interactive element needs a
visible focus state — this app is operated by people who tab. Respect
`prefers-reduced-motion`. No colour-only status: every state that matters carries
a word as well as a hue.
