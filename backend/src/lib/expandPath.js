import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

/** Expands the environment-variable tokens and leading `~` a cleaners.json
 * path may contain. Deliberately supports only the handful of tokens the
 * rule set actually uses -- APPDATA/LOCALAPPDATA/SYSTEMROOT/PROGRAMFILES
 * variants are always real Windows env vars, never something a rule
 * author needs to invent. A token whose env var isn't set expands to ''
 * (matches non-Windows/misconfigured environments gracefully -- the
 * resulting path just won't exist, which scanRule already treats as 0
 * bytes, not an error). Exported and independently testable. */
export function expandPath(rawPath) {
  let expanded = rawPath
    .replace(/%APPDATA%/gi, process.env.APPDATA || '')
    .replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA || '')
    .replace(/%SYSTEMROOT%/gi, process.env.SYSTEMROOT || process.env.WINDIR || '')
    // %WINDIR% is the same folder under its other name, and Windows
    // accepts both everywhere. Left out originally, which made a rule
    // written with it fail silently: the token stayed in the string, the
    // path never matched, and the rule reported itself as "not installed"
    // rather than as broken.
    .replace(/%WINDIR%/gi, process.env.WINDIR || process.env.SYSTEMROOT || '')
    .replace(/%PROGRAMDATA%/gi, process.env.ProgramData || '')
    // "C:" with no trailing separator, which is how Windows itself sets it.
    // The Recycle Bin is the only rule that needs it, and it needs it
    // because the bin lives at the root of each volume rather than
    // anywhere under a profile.
    .replace(/%SYSTEMDRIVE%/gi, process.env.SystemDrive || (process.env.SYSTEMROOT || 'C:').slice(0, 2))
    .replace(/%PROGRAMFILES\(X86\)%/gi, process.env['ProgramFiles(x86)'] || '')
    .replace(/%PROGRAMFILES%/gi, process.env.ProgramFiles || '')
    // The rest are the names BleachBit's own cleaners use, so an imported
    // cleaner resolves them the way BleachBit does. A variable that is not
    // set expands to '' like the others: the path then matches nothing.
    .replace(/%USERPROFILE%/gi, process.env.USERPROFILE || '')
    .replace(/%TEMP%/gi, process.env.TEMP || process.env.TMP || '')
    .replace(/%COMMONAPPDATA%/gi, process.env.ProgramData || '')
    .replace(/%LOCALAPPDATALOW%/gi, process.env.LOCALAPPDATA ? join(dirname(process.env.LOCALAPPDATA), 'LocalLow') : '')
    .replace(/%WINDOWSSYSTEM%/gi, (process.env.SYSTEMROOT || process.env.WINDIR) ? join(process.env.SYSTEMROOT || process.env.WINDIR, 'System32') : '');
  if (expanded.startsWith('~')) {
    expanded = join(homedir(), expanded.slice(1).replace(/^[\\/]/, ''));
  }
  return expanded;
}
