/** Picking installed programs by name, the way Revo's RevoCmd does.
 *
 * RevoCmd takes `/m "Microso*"`: `*` stands for any run of characters, `?` for
 * exactly one, and the pattern must match the WHOLE name, not a part of it. So
 * `Microso*` finds "Microsoft Edge" and `Edge` finds nothing. That strictness
 * is the point -- a script that asks for one program should not also get the
 * three that merely contain its name -- and it is what the `programs` command
 * of prune-cli does too. Matching ignores case, as Windows does.
 *
 * Pure: no registry, no PowerShell, so it is tested on plain arrays. */

/** A pattern as an anchored, case-insensitive regular expression. Every
 * character except the two wildcards is matched literally, so a program called
 * "C++ Builder (x64)" can be asked for by its own name. */
export function wildcardToRegExp(pattern) {
  const source = String(pattern)
    .split('')
    .map((ch) => {
      if (ch === '*') return '.*';
      if (ch === '?') return '.';
      return ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`, 'i');
}

/** The programs whose name matches the pattern, in the order given. No pattern
 * (undefined, null, empty or only spaces) means every program. */
export function matchPrograms(programs, pattern) {
  const list = Array.isArray(programs) ? programs : [];
  const text = typeof pattern === 'string' ? pattern.trim() : '';
  if (text === '') return [...list];
  const regex = wildcardToRegExp(text);
  return list.filter((program) => typeof program?.name === 'string' && regex.test(program.name));
}

/** One program as the command line reports it. The install location and the
 * uninstall command are opt-in, like RevoCmd's /i and /u, because most callers
 * want the list and the rest is long. */
export function describeProgram(program, { installLocation = false, uninstallCommand = false } = {}) {
  const row = {
    name: program.name,
    version: program.version || '',
    publisher: program.publisher || '',
    installDate: program.installDate ?? null,
    sizeBytes: program.sizeBytes ?? null,
    architecture: program.architecture ?? null,
    source: program.source === 'store' ? 'store' : 'registry'
  };
  if (installLocation) row.installLocation = program.installLocation || null;
  if (uninstallCommand) row.uninstallCommand = program.uninstallString || null;
  return row;
}
