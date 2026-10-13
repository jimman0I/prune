#!/usr/bin/env node
// Read-only audit: for every program in the real uninstall registry, reports
// which of the known risk categories it falls into -- the same categories
// the MIR Spiro (/I verb) and SQLiteStudio (hidden window) bugs came from --
// without running a single uninstaller. Nothing here writes to the registry,
// the filesystem, or spawns anything other than the PowerShell reads the app
// already does to build the Applications list.
//
// Run it with the real machine's own node, from backend/:
//   node scripts/audit-uninstallers.mjs

import { listInstalledPrograms } from '../src/services/programs.js';
import { detectInstallerKind } from '../src/services/silentUninstall.js';

const programs = await listInstalledPrograms();

const byKind = new Map();
const verbSwapped = [];
const orphaned = [];
const noUninstallString = [];
const unknownKind = [];

for (const p of programs) {
  if (!p.uninstallString) {
    noUninstallString.push(p.name);
    continue;
  }
  const kind = detectInstallerKind(p.uninstallString);
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);

  // Same bug class as MIR Spiro: an MSI entry whose UninstallString names
  // the Install verb (/I{GUID}) instead of Uninstall (/X{GUID}). Fixed in
  // silentUninstall.js's useUninstallVerb(), but this is what tells you
  // how many OTHER programs on this machine actually had it.
  if (kind === 'msi' && /(^|\s)\/I\{[^}]*\}/i.test(p.uninstallString)) {
    verbSwapped.push(p.name);
  }

  // Runs exactly as registered -- its own real GUI, if it has one. Most
  // exposed category to the "window opens behind Prune" bug class, now
  // covered by uninstall.js's foreground hunt, but the category itself is
  // worth seeing the size of.
  if (kind === 'unknown') unknownKind.push(p.name);

  if (p.health?.orphaned) orphaned.push(`${p.name} — ${p.health.reason}`);
}

console.log(`\n${programs.length} programs in the uninstall registry.\n`);

console.log('By installer kind:');
for (const [kind, count] of byKind) console.log(`  ${kind}: ${count}`);

console.log(`\nMSI entries with the Install-verb bug (/I{GUID} instead of /X{GUID}), the same class as MIR Spiro: ${verbSwapped.length}`);
verbSwapped.forEach((n) => console.log(`  - ${n}`));

console.log(`\n"unknown" installer kind — runs its own real GUI uninstaller unchanged, protected by the foreground hunt: ${unknownKind.length}`);
if (unknownKind.length <= 40) unknownKind.forEach((n) => console.log(`  - ${n}`));
else console.log(`  (${unknownKind.length} — too many to list; these are the ones a normal uninstall would show a visible wizard for)`);

console.log(`\nOrphaned (no working uninstaller at all — normal path can't run, Forced Uninstall is the only option): ${orphaned.length}`);
orphaned.forEach((n) => console.log(`  - ${n}`));

console.log(`\nNo UninstallString registered at all: ${noUninstallString.length}`);
noUninstallString.forEach((n) => console.log(`  - ${n}`));
console.log('');
