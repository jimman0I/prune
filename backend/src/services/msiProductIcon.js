import { runPowerShellJson } from './powershell.js';

/** The icon an MSI product registered with Windows Installer.
 *
 * The Applications tab showed a lettered tile for 28 of 129 programs, and
 * 22 of those had no icon source at ALL -- no DisplayIcon, no
 * InstallLocation, and an uninstall string that is nothing but
 * `MsiExec.exe /X{GUID}`. Every one of the three existing sources
 * correctly declined them, so they fell through to the letter.
 *
 * They are not iconless, though. Windows Installer keeps its own record
 * of a product's icon under
 * `HKLM\SOFTWARE\Classes\Installer\Products\<packed code>\ProductIcon`,
 * pointing at a file it cached in C:\Windows\Installer when the package
 * was installed. Five of the fifteen sampled here have one -- Node.js's
 * real hexagon, Everything's, File Converter's, XNA's and Epic Online
 * Services' -- and the ten that do not are the Visual C++
 * redistributables and friends, which genuinely have no icon anywhere.
 *
 * Deliberately NOT a fallback to the generic Windows Installer glyph for
 * those ten. iconSource.js already refused msiexec.exe as a source for
 * exactly that reason -- it hands every MSI-installed program the same
 * picture, which reads as a bug rather than a fallback -- and the same
 * objection retires the ".msi" file-type icon, which is that same glyph.
 * A lettered tile carries the program's own initial; a shared glyph
 * carries nothing.
 */

/** The product code out of an msiexec uninstall string, upper-cased.
 *
 * Both switch forms occur on this machine: `/X` on the redistributables
 * and `/I` on GameInput and Wolow Companion. Upper-cased because the
 * packed key Windows Installer stores is upper-case, and the registry
 * happens to be forgiving about it while string comparisons here are
 * not. */
export function productCodeFrom(uninstallString) {
  const text = String(uninstallString || '');
  if (!/(^|[\\/])msiexec(\.exe)?\b/i.test(text)) return null;

  const match = /\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/i.exec(text);
  return match ? match[0].toUpperCase() : null;
}

/** A product code in the form Windows Installer keys its registry by.
 *
 * Not a hash and not an encoding anyone would guess: the first three
 * GUID fields are reversed whole, and the last two are reversed in pairs
 * -- which is the same little-endian byte order the GUID has in memory,
 * written out as hex.
 *
 * Returns null for anything that is not a product code, and that guard is
 * load-bearing rather than defensive: the result is pasted straight into
 * a registry path, so a value that is not exactly 32 hex characters has
 * no business getting there. */
export function packProductCode(productCode) {
  const text = String(productCode || '').trim();
  const match = /^\{([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\}$/i.exec(text);
  if (!match) return null;

  const [, a, b, c, d, e] = match.map((part) => part.toUpperCase());
  const reverse = (s) => [...s].reverse().join('');
  const swapPairs = (s) => s.replace(/(.)(.)/g, '$2$1');

  return reverse(a) + reverse(b) + reverse(c) + swapPairs(d) + swapPairs(e);
}

/** Looks up { productCode: { path, index } } for the codes given.
 *
 * A ProductIcon naming a file that is no longer on disk is common --
 * C:\Windows\Installer gets cleaned out by disk tools and by repairs --
 * so existence is checked here rather than being discovered later as a
 * failed extraction. Handing on a dead path would cost the row its
 * lettered tile and give it nothing back. */
export async function getMsiProductIcons(productCodes) {
  const packed = new Map();
  for (const code of productCodes || []) {
    const key = packProductCode(code);
    if (key) packed.set(key, code);
  }
  if (packed.size === 0) return {};

  const literals = [...packed.keys()].map((key) => `'${key}'`).join(',');
  const script = `
$out = @{}
foreach ($key in @(${literals})) {
  $path = "HKLM:\\SOFTWARE\\Classes\\Installer\\Products\\$key"
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $icon = (Get-ItemProperty -LiteralPath $path -ErrorAction SilentlyContinue).ProductIcon
  if (-not $icon) { continue }
  $out[$key] = [string]$icon
}
ConvertTo-Json -InputObject $out -Compress -Depth 3
`;

  let raw;
  try {
    raw = await runPowerShellJson(script, { timeoutMs: 20000 });
  } catch {
    // Losing this costs 22 rows their icon and nothing else. The other
    // 101 come from sources that never touch this key.
    return {};
  }
  if (!raw) return {};

  const { existsSync } = await import('node:fs');
  const sources = {};
  for (const [key, value] of Object.entries(raw)) {
    const code = packed.get(key);
    if (!code) continue;

    // Same "path,index" shape as a DisplayIcon, and the same rule: the
    // index is only a comma followed by digits at the very END, because a
    // comma is legal inside a Windows path.
    const text = String(value).trim().replace(/^"|"$/g, '');
    const indexMatch = /,\s*(-?\d+)\s*$/.exec(text);
    const path = (indexMatch ? text.slice(0, indexMatch.index) : text).trim();
    if (!path || !existsSync(path)) continue;

    sources[code] = { path, index: indexMatch ? Number(indexMatch[1]) : 0 };
  }
  return sources;
}
