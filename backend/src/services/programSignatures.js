import { statSync } from 'node:fs';
import { listInstalledPrograms } from './programs.js';
import { runPowerShellJson } from './powershell.js';
import { findMainExecutable } from './findMainExecutable.js';
import { iconSourceForProgram } from './iconSource.js';
import { parseUninstallerPath } from './uninstallerPath.js';

/** Whether each program's own files carry a valid digital signature, and
 * whose.
 *
 * Bulk Crap Uninstaller shows a certificate column, read by loading the
 * signer certificate out of the file and checking its chain. That never
 * checks the file against the signature: a binary changed after signing
 * still carries an intact certificate, and reads as verified. This asks
 * Windows' own WinVerifyTrust instead (Get-AuthenticodeSignature), which
 * hashes the file, checks the chain, and also finds the catalog signatures
 * Windows' own files use.
 *
 * Measured first on the dev machine: 130 programs, 124 with a file to ask
 * about, 102 distinct files. 85 valid, 15 unsigned (7-Zip, qBittorrent,
 * AutoHotkey, FileMaker -- and Prune itself), 15 seconds in one PowerShell.
 * Too slow for the list to wait on, so this is its own endpoint like the
 * versions and sizes, split across a few processes, and remembered per
 * file until the file changes.
 *
 * Which file: the same order the versions use -- the vendor's DisplayIcon
 * when it is an executable, then the program's main executable in its
 * folder -- and then its uninstaller, which is still the vendor's code.
 * Never a launcher's (a steam:// uninstall would report Valve for every
 * game) and never Windows' own tools (msiexec, rundll32), which would
 * report Microsoft for every MSI on the machine. */

// A bare "MsiExec.exe" counts too: that is how most MSI entries spell it.
const SYSTEM_TOOL = /\\windows\\(system32|syswow64)\\|(^|\\)(msiexec|rundll32|cmd)\.exe$/i;

/** The file whose signature stands for this program, or null. */
export async function signatureFileFor(program, { findExecutable = findMainExecutable } = {}) {
  const declared = iconSourceForProgram(program);
  if (declared && /\.exe$/i.test(declared.path) && !SYSTEM_TOOL.test(declared.path)) return declared.path;
  if (program.installLocation) {
    const executable = await findExecutable(program.installLocation, program.name).catch(() => null);
    if (executable && /\.exe$/i.test(executable) && !SYSTEM_TOOL.test(executable)) return executable;
  }
  if (typeof program.uninstallString === 'string' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(program.uninstallString) && !/\s[a-z][a-z0-9+.-]*:\/\//i.test(program.uninstallString)) {
    const { executable } = parseUninstallerPath(program.uninstallString);
    if (executable && !SYSTEM_TOOL.test(executable)) return executable;
  }
  return null;
}

/** Windows' status words, reduced to what the list says:
 *   valid     signed, the file matches, the chain is trusted
 *   unsigned  no signature at all
 *   broken    signed, but the file changed after signing (HashMismatch)
 *             or the signer is not trusted -- the case worth a red badge
 * Anything else (a format Windows cannot sign, an error reading it) is no
 * answer, and the row says nothing rather than guess. */
export function signatureStatus(windowsStatus) {
  switch (windowsStatus) {
    case 'Valid': return 'valid';
    case 'NotSigned': return 'unsigned';
    case 'HashMismatch':
    case 'NotTrusted':
      return 'broken';
    default: return null;
  }
}

/** The signer's name out of a certificate subject: its CN, else its O. */
export function signerName(subject) {
  if (typeof subject !== 'string') return '';
  const field = (key) => {
    const match = new RegExp(`(?:^|,\\s*)${key}=("(?:[^"]|"")*"|[^,]*)`).exec(subject);
    if (!match) return '';
    const value = match[1].trim();
    return value.startsWith('"') ? value.slice(1, -1).replace(/""/g, '"') : value;
  };
  return field('CN') || field('O');
}

const psLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

export function buildSignatureScript(paths) {
  return `
$ErrorActionPreference = 'SilentlyContinue'
$found = foreach ($p in @(${paths.map(psLiteral).join(', ')})) {
  $s = Get-AuthenticodeSignature -LiteralPath $p
  if ($s) { [PSCustomObject]@{ path = $p; status = [string]$s.Status; subject = [string]$s.SignerCertificate.Subject } }
}
ConvertTo-Json -Compress -InputObject @($found)
`;
}

const CHUNK = 30;
const PARALLEL = 4;

/** { path: { status, signer } } for every path Windows answered for. */
export async function readSignatures(paths, { run = runPowerShellJson } = {}) {
  const chunks = [];
  for (let i = 0; i < paths.length; i += CHUNK) chunks.push(paths.slice(i, i + CHUNK));
  const results = {};
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      let rows;
      try { rows = await run(buildSignatureScript(chunk), { timeoutMs: 120000, retries: 0 }); } catch { rows = []; }
      for (const row of Array.isArray(rows) ? rows : rows ? [rows] : []) {
        const status = signatureStatus(row?.status);
        if (status && typeof row.path === 'string') {
          results[row.path] = { status, ...(status !== 'unsigned' ? { signer: signerName(row.subject) } : {}) };
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker));
  return results;
}

/* Remembered per file, keyed on its size and modification time: a program
 * update rewrites its executable, and that is exactly when the answer can
 * change. */
const byFile = new Map();
const fileKey = (path) => {
  try {
    const s = statSync(path);
    return `${path.toLowerCase()}|${s.size}|${s.mtimeMs}`;
  } catch {
    return null;
  }
};

/** { programId: { status, signer? } }. A program with no file to ask about,
 * or one Windows gave no answer for, is absent. */
export async function resolveSignatures(programs, { read = readSignatures, findExecutable } = {}) {
  const fileOf = {};
  for (const program of programs) {
    const file = await signatureFileFor(program, findExecutable ? { findExecutable } : undefined);
    if (file) fileOf[program.id] = file;
  }
  const keys = {};
  const missing = [];
  for (const file of new Set(Object.values(fileOf))) {
    const key = fileKey(file);
    if (!key) continue;
    keys[file] = key;
    if (!byFile.has(key)) missing.push(file);
  }
  if (missing.length) {
    const fresh = await read(missing);
    for (const file of missing) if (fresh[file]) byFile.set(keys[file], fresh[file]);
  }
  const result = {};
  for (const [id, file] of Object.entries(fileOf)) {
    const answer = keys[file] && byFile.get(keys[file]);
    if (answer) result[id] = answer;
  }
  return result;
}

let inFlight = null;

/** For the route: every installed program, one pass at a time. */
export async function getProgramSignatures() {
  if (!inFlight) {
    inFlight = listInstalledPrograms()
      .then((programs) => resolveSignatures(programs))
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** Testing seam -- the cache is process-wide. */
export function clearSignatureCache() {
  byFile.clear();
  inFlight = null;
}
