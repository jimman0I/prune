import { runPowerShellText } from './powershell.js';

/** Same three Uninstall hives programs.js's primary enumeration reads,
 * queried with `reg.exe` instead of `Get-ItemProperty`. Used only as a
 * fallback: a completely different code path (no cmdlet pipeline, no
 * computed Select-Object properties) to fall back on when the primary
 * enumeration comes back empty on a real machine, which should never
 * happen — see listInstalledPrograms in programs.js for why that result
 * is treated as a probable failure rather than a genuinely software-free
 * computer. Still run through powershell.exe (proven reachable, since
 * the primary attempt got a response at all) so the existing UTF-8 fix
 * for non-ASCII names and publishers applies here too. */
const REG_QUERY_SCRIPT = `
reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s 2>$null
reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s 2>$null
reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s 2>$null
`;

const HIVE_ALIASES = ['HKEY_LOCAL_MACHINE', 'HKEY_CURRENT_USER'];
const VALUE_LINE = /^\s+(\S+)\s+(REG_[A-Z_0-9]+)\s+(.*)$/;
const KEY_LINE = new RegExp(`^(${HIVE_ALIASES.join('|')})\\\\(.+)$`, 'i');

export async function listInstalledProgramsViaReg() {
  const text = await runPowerShellText(REG_QUERY_SCRIPT);
  if (!text) return [];
  return parseRegQueryOutput(text);
}

/** Exported for direct testing. `reg query /s` prints one blank-line-
 * separated block per subkey: the key's full path on its own line, then
 * one indented "Name    REG_TYPE    Value" line per value. A key with no
 * values (or none of the ones read here) produces no usable block and is
 * silently skipped, the same way Get-ItemProperty skips it. */
export function parseRegQueryOutput(text) {
  const blocks = text.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
  const programs = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const keyMatch = lines[0].trim().match(KEY_LINE);
    if (!keyMatch) continue;
    const hive = keyMatch[1].toUpperCase();
    const subpath = keyMatch[2];
    const values = {};
    for (const line of lines.slice(1)) {
      const m = line.match(VALUE_LINE);
      if (m) values[m[1]] = m[3].trim();
    }
    if (!values.DisplayName) continue;
    if (parseHexDword(values.SystemComponent) === 1) continue;
    programs.push({
      id: subpath.split('\\').pop(),
      name: values.DisplayName,
      publisher: values.Publisher,
      version: values.DisplayVersion,
      installDate: values.InstallDate,
      estimatedSizeKb: parseHexDword(values.EstimatedSize),
      uninstallString: values.UninstallString,
      installLocation: values.InstallLocation,
      quietUninstallString: values.QuietUninstallString,
      // Synthesized in the exact shape PowerShell's own PSPath uses, so
      // normalizeProgram's toPowerShellRegistryPath / architectureFrom
      // (both regex-matched against this string) work unchanged on a
      // program that came from this fallback instead of the primary path.
      psPath: `Microsoft.PowerShell.Core\\Registry::${hive}\\${subpath}`,
      displayIcon: values.DisplayIcon,
      urlInfoAbout: values.URLInfoAbout,
      helpLink: values.HelpLink
    });
  }
  return programs;
}

function parseHexDword(value) {
  if (typeof value !== 'string') return undefined;
  const n = parseInt(value, 16);
  return Number.isFinite(n) ? n : undefined;
}
