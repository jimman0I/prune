import { runPowerShellJson } from './powershell.js';

/** GOG records every installed game under its own registry key, with the
 * folder it lives in.
 *
 * Deliberately the registry and not Galaxy's database. Galaxy keeps its
 * catalogue in an SQLite file, and reading that would mean adding a
 * native dependency to this project for one launcher -- while the
 * registry keys are present for Galaxy AND for GOG's offline installers,
 * which Galaxy's database doesn't cover at all.
 *
 * Both hives are read: 32-bit GOG builds land in WOW6432Node and 64-bit
 * ones don't, and a machine can have games from both. */
const GOG_QUERY = `
$paths = @(
  'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\*',
  'HKLM:\\SOFTWARE\\GOG.com\\Games\\*'
)
$games = Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.gameName -or $_.path } |
  ForEach-Object {
    [PSCustomObject]@{
      gameId = [string]$_.gameID
      gameName = [string]$_.gameName
      path = [string]$_.path
      workingDir = [string]$_.workingDir
    }
  }
ConvertTo-Json -InputObject @($games) -Compress -Depth 3
`;

/** Normalizes one raw registry row into a usable app, or null.
 *
 * There is no size in these keys -- GOG records where the game is, not
 * how big it is -- so the caller measures the folder. That's safe here in
 * a way it isn't for Steam or Ubisoft: each GOG game gets its own
 * directory, so measuring one never sweeps up another's bytes. */
export function normalizeGogGame(raw) {
  if (!raw) return null;
  const folder = (raw.path || raw.workingDir || '').trim();
  if (!folder) return null;
  return {
    gameId: raw.gameId || null,
    name: raw.gameName || null,
    installLocation: folder.replace(/\//g, '\\').replace(/\\+$/, '')
  };
}

/** Every GOG game this machine has installed.
 *
 * Returns [] when GOG isn't installed, which is not an error. */
export async function getGogApps() {
  let raw;
  try {
    raw = await runPowerShellJson(GOG_QUERY);
  } catch {
    return [];
  }
  if (!raw) return [];

  // PowerShell collapses a single-element array to a bare object.
  const rows = Array.isArray(raw) ? raw : [raw];
  return rows.map(normalizeGogGame).filter(Boolean);
}
