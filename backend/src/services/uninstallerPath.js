/** Pulls the executable out of a registry UninstallString.
 *
 * These strings are command lines, not paths, and nothing enforces a
 * format on them -- every installer writes its own. The three shapes
 * that actually occur:
 *
 *   "C:\Program Files\App\uninstall.exe" /S      quoted, the polite case
 *   C:\Apps\thing\uninst.exe /quiet              unquoted, no spaces
 *   C:\Program Files\App\uninstall.exe /S        unquoted WITH spaces
 *
 * The third is genuinely ambiguous -- without quotes there is no way to
 * know where the path ends and the arguments begin, and Windows itself
 * resolves it by trying progressively longer prefixes. Splitting on the
 * first space would truncate it to "C:\Program", so this cuts at the
 * first ` /` or ` -` token instead: a space followed by a switch
 * character is a far better signal of "arguments start here" than a bare
 * space, and a directory named "-something" mid-path is vanishingly rare
 * next to "Program Files" being everywhere.
 *
 * `isMsi` is separate because MSI entries need a different orphan test.
 * Their uninstaller is msiexec.exe, which always exists in System32 --
 * so "does the executable exist" is meaningless for them and would call
 * every MSI-installed program healthy no matter what state it's in. */
export function parseUninstallerPath(uninstallString) {
  if (typeof uninstallString !== 'string' || !uninstallString.trim()) {
    return { executable: null, isMsi: false };
  }
  const trimmed = uninstallString.trim();

  let executable;
  if (trimmed.startsWith('"')) {
    const closing = trimmed.indexOf('"', 1);
    executable = closing === -1 ? trimmed.slice(1) : trimmed.slice(1, closing);
  } else {
    const switchAt = trimmed.search(/\s[/-]/);
    executable = switchAt === -1 ? trimmed : trimmed.slice(0, switchAt);
  }
  executable = executable.trim();

  // Matches both the bare "MsiExec.exe" form and a full path to it. The
  // \b keeps it from matching a program that merely has "msiexec" inside
  // a longer name.
  const isMsi = /(^|[\\/])msiexec(\.exe)?\b/i.test(executable);

  return { executable: executable || null, isMsi };
}
